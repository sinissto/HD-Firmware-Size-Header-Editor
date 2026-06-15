import * as fs from 'fs'
import log from 'electron-log'

/**
 * Western Digital firmware whole-file checksum.
 *
 * The 4-byte field at offset 0x0C is computed so that the sum of all u32
 * little-endian words of the file (mod 2^32) equals the magic constant
 * 0xAA55AA55. Verified against all reference test files (089_FIMG, BMGR,
 * CODF) — see testiranje/reports/08-CRC_Analysis.md and the implementation
 * report for details.
 */
export const CHECKSUM_MAGIC = 0xaa55aa55
export const CHECKSUM_OFFSET = 0x0c

/**
 * Pure computation: returns the u32 value that, written at offset 0x0C,
 * makes the LE u32 word sum of the whole file equal CHECKSUM_MAGIC.
 *
 * The bytes currently at offset 0x0C..0x0F are ignored (treated as zero) so
 * the function can be called whether the field is already filled or not.
 * Files whose size is not a multiple of 4 are virtually zero-padded for the
 * sum only — the file itself is not modified by this function.
 *
 * @throws if buf is shorter than 16 bytes.
 */
export function computeWdChecksum(buf: Buffer): number {
  if (buf.length < CHECKSUM_OFFSET + 4) {
    throw new Error(`File too small for checksum: ${buf.length} bytes (need >= 16)`)
  }

  const wordCount = Math.ceil(buf.length / 4)
  let sum = 0
  for (let i = 0; i < wordCount; i++) {
    const off = i * 4
    if (off === CHECKSUM_OFFSET) continue
    let word: number
    if (off + 4 <= buf.length) {
      word = buf.readUInt32LE(off)
    } else {
      const tail = Buffer.alloc(4)
      buf.copy(tail, 0, off, buf.length)
      word = tail.readUInt32LE(0)
    }
    sum = (sum + word) >>> 0
  }
  return (CHECKSUM_MAGIC - sum) >>> 0
}

/**
 * Reads the file, computes the WD checksum, and writes the 4-byte LE result
 * at offset 0x0C. Only those 4 bytes are touched on disk.
 *
 * @returns the checksum value that was written.
 */
export function writeWdChecksum(filePath: string): number {
  const buf = fs.readFileSync(filePath)
  const crc = computeWdChecksum(buf)

  const out = Buffer.alloc(4)
  out.writeUInt32LE(crc, 0)

  log.info(`Writing WD checksum: crc=0x${crc.toString(16).toUpperCase().padStart(8, '0')}, path=${filePath}`)

  const fd = fs.openSync(filePath, 'r+')
  try {
    fs.writeSync(fd, out, 0, 4, CHECKSUM_OFFSET)
  } finally {
    fs.closeSync(fd)
  }
  return crc
}

/**
 * Reads the size header (u32 LE at offset 0) and zero-fills the file from
 * byte (headerValue + 4) to EOF. By convention this header stores
 * file_size - 4, so for an already-trimmed file nothing is written.
 *
 * @returns the header value read and the count of bytes zeroed.
 * @throws if the file is < 4 bytes or the header implies content larger than the file.
 */
export function fillTailWithZeros(filePath: string): { headerValue: number; zeroedBytes: number } {
  const size = fs.statSync(filePath).size
  if (size < 4) {
    throw new Error(`File too small to read size header: ${size} bytes (need >= 4)`)
  }

  const fd = fs.openSync(filePath, 'r+')
  try {
    const headerBuf = Buffer.alloc(4)
    fs.readSync(fd, headerBuf, 0, 4, 0)
    const headerValue = headerBuf.readUInt32LE(0)

    const startOffset = headerValue + 4
    if (startOffset > size) {
      throw new Error(
        `Header value (${headerValue}) implies content larger than file (${size} bytes)`,
      )
    }

    const zeroLength = size - startOffset
    if (zeroLength === 0) {
      log.info(`Fill-zeros: no tail to zero, file already trimmed (${filePath})`)
      return { headerValue, zeroedBytes: 0 }
    }

    const CHUNK = 64 * 1024
    const zeros = Buffer.alloc(Math.min(CHUNK, zeroLength))
    let written = 0
    while (written < zeroLength) {
      const remaining = zeroLength - written
      const writeLen = Math.min(zeros.length, remaining)
      fs.writeSync(fd, zeros, 0, writeLen, startOffset + written)
      written += writeLen
    }

    log.info(`Fill-zeros: wrote ${zeroLength} zero bytes from offset ${startOffset} (${filePath})`)
    return { headerValue, zeroedBytes: zeroLength }
  } finally {
    fs.closeSync(fd)
  }
}
