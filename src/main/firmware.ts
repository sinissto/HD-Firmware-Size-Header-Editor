import * as fs from 'fs'
import log from 'electron-log'

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
