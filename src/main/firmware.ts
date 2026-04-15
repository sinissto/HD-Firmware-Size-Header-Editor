import * as fs from 'fs'
import { basename, dirname, join } from 'path'
import log from 'electron-log'
import type { BatchResult, FileResult } from './firmwareTypes'

/**
 * Writes a 4-byte little-endian length header at offset 0 of the given file.
 * The stored value is (file_size - 4).
 *
 * Uses openSync + writeSync so only the first 4 bytes are touched — the rest
 * of the file is never rewritten.
 *
 * @throws {Error} if the file is 4 bytes or smaller.
 */
export function writeFirmwareHeader(filePath: string): void {
  const size = fs.statSync(filePath).size

  if (size <= 4) {
    throw new Error(`File too small: ${size} bytes (must be > 4 bytes)`)
  }

  const headerValue = size - 4
  const buf = Buffer.alloc(4)
  buf.writeUInt32LE(headerValue, 0)

  log.info(`Writing firmware header: size=${size}, headerValue=${headerValue}, path=${filePath}`)

  const fd = fs.openSync(filePath, 'r+')
  try {
    fs.writeSync(fd, buf, 0, 4, 0)
  } finally {
    fs.closeSync(fd)
  }
}

/**
 * Copies a folder to a sibling directory named `<folderName>_EDITED`.
 * If the destination already exists it is removed first.
 *
 * @returns The absolute path of the newly created `_EDITED` folder.
 * @throws If the copy operation fails (permissions, disk space, etc.)
 */
export function copyFolderToEdited(sourcePath: string): string {
  const destPath = join(dirname(sourcePath), basename(sourcePath) + '_EDITED')

  if (fs.existsSync(destPath)) {
    log.warn(`Overwriting existing _EDITED folder: ${destPath}`)
    fs.rmSync(destPath, { recursive: true, force: true })
  }

  fs.cpSync(sourcePath, destPath, { recursive: true })
  log.info(`Copied ${sourcePath} -> ${destPath}`)
  return destPath
}

/**
 * Returns paths of all top-level .bin files in the given folder, sorted alphabetically.
 */
export function scanBinFiles(folderPath: string): string[] {
  return fs
    .readdirSync(folderPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.bin'))
    .map((entry) => join(folderPath, entry.name))
    .sort()
}

/**
 * Copies the source folder to `<folderName>_EDITED`, then writes the firmware
 * header into every .bin file found in the copy.
 *
 * Never throws — all errors are captured in the returned BatchResult.
 */
export function processBatchFolder(sourceFolderPath: string): BatchResult {
  log.info(`Batch processing started: ${sourceFolderPath}`)

  // Phase 1 — validate source
  let stat: fs.Stats
  try {
    stat = fs.statSync(sourceFolderPath)
  } catch (e) {
    return {
      status: 'error',
      editedFolderPath: '',
      files: [],
      fatalError: `Cannot access folder: ${(e as Error).message}`,
    }
  }
  if (!stat.isDirectory()) {
    return {
      status: 'error',
      editedFolderPath: '',
      files: [],
      fatalError: 'Selected path is not a directory',
    }
  }

  // Phase 2 — copy to _EDITED
  let editedFolderPath: string
  try {
    editedFolderPath = copyFolderToEdited(sourceFolderPath)
  } catch (e) {
    return {
      status: 'error',
      editedFolderPath: '',
      files: [],
      fatalError: `Failed to copy folder: ${(e as Error).message}`,
    }
  }

  // Phase 3 — scan for .bin files in the copy
  let binFiles: string[]
  try {
    binFiles = scanBinFiles(editedFolderPath)
  } catch (e) {
    return {
      status: 'error',
      editedFolderPath,
      files: [],
      fatalError: `Failed to scan for .bin files: ${(e as Error).message}`,
    }
  }

  if (binFiles.length === 0) {
    return {
      status: 'error',
      editedFolderPath,
      files: [],
      fatalError: 'No .bin files found in the selected folder',
    }
  }

  // Phase 4 — process each file
  const files: FileResult[] = binFiles.map((filePath) => {
    const fileName = basename(filePath)
    try {
      const size = fs.statSync(filePath).size
      writeFirmwareHeader(filePath)
      log.info(`Batch: wrote header for ${fileName}`)
      return { fileName, status: 'success', size, headerValue: size - 4 }
    } catch (e) {
      log.warn(`Batch: failed for ${fileName}: ${(e as Error).message}`)
      return { fileName, status: 'error', error: (e as Error).message }
    }
  })

  const hasError = files.some((f) => f.status === 'error')
  const hasSuccess = files.some((f) => f.status === 'success')
  const status: BatchResult['status'] = !hasError ? 'success' : hasSuccess ? 'partial' : 'error'

  log.info(`Batch complete: ${status}, ${files.length} files`)
  return { status, editedFolderPath, files }
}
