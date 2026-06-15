import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import { join } from 'path'

vi.mock('fs')
const mockedFs = vi.mocked(fs)

import {
  computeWdChecksum,
  writeWdChecksum,
  fillTailWithZeros,
  CHECKSUM_MAGIC,
  CHECKSUM_OFFSET,
} from './checksum'

function buildBuffer(words: number[]): Buffer {
  const buf = Buffer.alloc(words.length * 4)
  for (let i = 0; i < words.length; i++) buf.writeUInt32LE(words[i] >>> 0, i * 4)
  return buf
}

describe('computeWdChecksum (pure)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('throws on buffers smaller than 16 bytes', () => {
    expect(() => computeWdChecksum(Buffer.alloc(15))).toThrow(/too small/i)
  })

  it('returns CHECKSUM_MAGIC when all other words sum to zero', () => {
    // 4 words; field at index 3 (offset 0x0C) is ignored.
    // Words 0..2 are zero, ignored field is anything → expected = MAGIC - 0 = MAGIC.
    const buf = buildBuffer([0, 0, 0, 0xdeadbeef])
    expect(computeWdChecksum(buf)).toBe(CHECKSUM_MAGIC)
  })

  it('ignores existing bytes in the checksum field', () => {
    const withField = buildBuffer([1, 2, 3, 0x11111111])
    const withoutField = buildBuffer([1, 2, 3, 0xffffffff])
    expect(computeWdChecksum(withField)).toBe(computeWdChecksum(withoutField))
  })

  it('produces a checksum that makes the total u32 LE sum equal CHECKSUM_MAGIC', () => {
    const buf = buildBuffer([0x12345678, 0x9abcdef0, 0xdeadbeef, 0, 0x55667788, 0x99aabbcc])
    const crc = computeWdChecksum(buf)
    buf.writeUInt32LE(crc, CHECKSUM_OFFSET)
    let sum = 0
    for (let i = 0; i < buf.length; i += 4) sum = (sum + buf.readUInt32LE(i)) >>> 0
    expect(sum).toBe(CHECKSUM_MAGIC)
  })

  it('virtually zero-pads a tail that is not a multiple of 4', () => {
    // 17-byte buffer: 4 LE words + 1 trailing byte. The 5th "word" is 0x00000042.
    const base = buildBuffer([0, 0, 0, 0])
    const withTail = Buffer.concat([base, Buffer.from([0x42])])
    const crc = computeWdChecksum(withTail)
    // Expected sum (field zeroed) = 0 + 0 + 0 + 0x42 = 0x42
    expect(crc).toBe((CHECKSUM_MAGIC - 0x42) >>> 0)
  })

  describe('against real fixture files', () => {
    const fixtures = [
      { name: '089_FIMG.rpm', stored: 0x1bbda1c4 },
      { name: '089_FIMG.bin', stored: 0x1bbda1c4 },
      { name: '80-Bootmanager.bin', stored: 0xc67f0187 },
      { name: '82-Kompresovan modul.bin', stored: 0x4535b0c3 },
    ]

    for (const fx of fixtures) {
      it(`matches stored checksum for ${fx.name}`, async () => {
        const realFs = await vi.importActual<typeof import('fs')>('fs')
        const fixturePath = join(__dirname, '..', '..', 'testiranje', 'files', fx.name)
        const data = realFs.readFileSync(fixturePath)
        expect(data.readUInt32LE(CHECKSUM_OFFSET)).toBe(fx.stored)
        expect(computeWdChecksum(data)).toBe(fx.stored)
      })
    }
  })
})

describe('writeWdChecksum (IO)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('reads the file, computes, and writes 4 bytes at offset 0x0C', () => {
    const file = buildBuffer([0x10, 0x20, 0x30, 0, 0x40, 0x50])
    const readFileSync = mockedFs.readFileSync as unknown as ReturnType<typeof vi.fn>
    readFileSync.mockReturnValue(file)
    const fd = 99
    mockedFs.openSync.mockReturnValue(fd)
    mockedFs.writeSync.mockReturnValue(4)

    const expected = computeWdChecksum(file)
    const returned = writeWdChecksum('/path/to/fw.bin')

    expect(returned).toBe(expected)
    expect(mockedFs.openSync).toHaveBeenCalledWith('/path/to/fw.bin', 'r+')

    const writeArgs = mockedFs.writeSync.mock.calls[0] as unknown as [
      number,
      Buffer,
      number,
      number,
      number,
    ]
    const [calledFd, calledBuf, , , calledPos] = writeArgs
    expect(calledFd).toBe(fd)
    expect(calledPos).toBe(CHECKSUM_OFFSET)
    const expectedBuf = Buffer.alloc(4)
    expectedBuf.writeUInt32LE(expected, 0)
    expect(calledBuf).toEqual(expectedBuf)
    expect(mockedFs.closeSync).toHaveBeenCalledWith(fd)
  })

  it('closes the fd even when writeSync throws', () => {
    const readFileSync = mockedFs.readFileSync as unknown as ReturnType<typeof vi.fn>
    readFileSync.mockReturnValue(buildBuffer([1, 2, 3, 0, 4]))
    const fd = 7
    mockedFs.openSync.mockReturnValue(fd)
    mockedFs.writeSync.mockImplementation(() => {
      throw new Error('disk full')
    })

    expect(() => writeWdChecksum('/fw.bin')).toThrow('disk full')
    expect(mockedFs.closeSync).toHaveBeenCalledWith(fd)
  })
})

describe('fillTailWithZeros (IO)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('reads the header, then writes zeros from headerValue+4 to EOF', () => {
    const fileSize = 100
    const headerValue = 60 // valid content ends at byte 64 → zero 36 bytes
    mockedFs.statSync.mockReturnValue({ size: fileSize } as fs.Stats)
    const fd = 11
    mockedFs.openSync.mockReturnValue(fd)
    mockedFs.readSync.mockImplementation(
      ((_fd: number, buf: Buffer) => {
        buf.writeUInt32LE(headerValue, 0)
        return 4
      }) as unknown as typeof fs.readSync,
    )
    mockedFs.writeSync.mockReturnValue(0)

    const result = fillTailWithZeros('/fw.bin')

    expect(result).toEqual({ headerValue, zeroedBytes: 36 })
    // Single chunk write at offset 64, length 36, all zeros
    const writeArgs = mockedFs.writeSync.mock.calls[0] as unknown as [
      number,
      Buffer,
      number,
      number,
      number,
    ]
    const [calledFd, calledBuf, , length, position] = writeArgs
    expect(calledFd).toBe(fd)
    expect(position).toBe(64)
    expect(length).toBe(36)
    expect(calledBuf.length).toBe(36)
    expect(calledBuf.every((b) => b === 0)).toBe(true)
    expect(mockedFs.closeSync).toHaveBeenCalledWith(fd)
  })

  it('returns zeroedBytes=0 when header already implies whole-file content', () => {
    const fileSize = 16
    const headerValue = 12 // 12 + 4 = 16 → no tail to zero
    mockedFs.statSync.mockReturnValue({ size: fileSize } as fs.Stats)
    mockedFs.openSync.mockReturnValue(5)
    mockedFs.readSync.mockImplementation(
      ((_fd: number, buf: Buffer) => {
        buf.writeUInt32LE(headerValue, 0)
        return 4
      }) as unknown as typeof fs.readSync,
    )

    const result = fillTailWithZeros('/fw.bin')

    expect(result).toEqual({ headerValue, zeroedBytes: 0 })
    expect(mockedFs.writeSync).not.toHaveBeenCalled()
  })

  it('throws when the header value implies content larger than the file', () => {
    mockedFs.statSync.mockReturnValue({ size: 64 } as fs.Stats)
    mockedFs.openSync.mockReturnValue(5)
    mockedFs.readSync.mockImplementation(
      ((_fd: number, buf: Buffer) => {
        buf.writeUInt32LE(100, 0)
        return 4
      }) as unknown as typeof fs.readSync,
    )

    expect(() => fillTailWithZeros('/fw.bin')).toThrow(/larger than file/i)
    expect(mockedFs.closeSync).toHaveBeenCalledWith(5)
  })

  it('throws when the file is smaller than 4 bytes', () => {
    mockedFs.statSync.mockReturnValue({ size: 3 } as fs.Stats)
    expect(() => fillTailWithZeros('/fw.bin')).toThrow(/too small/i)
    expect(mockedFs.openSync).not.toHaveBeenCalled()
  })

  it('writes in chunks for large tails', () => {
    const fileSize = 200_000
    const headerValue = 96 // tail = 200_000 - 100 = 199_900 bytes, multiple chunks
    mockedFs.statSync.mockReturnValue({ size: fileSize } as fs.Stats)
    mockedFs.openSync.mockReturnValue(1)
    mockedFs.readSync.mockImplementation(
      ((_fd: number, buf: Buffer) => {
        buf.writeUInt32LE(headerValue, 0)
        return 4
      }) as unknown as typeof fs.readSync,
    )
    mockedFs.writeSync.mockReturnValue(0)

    const result = fillTailWithZeros('/fw.bin')

    expect(result.zeroedBytes).toBe(fileSize - headerValue - 4)
    // Sum of lengths across all writeSync calls equals expected
    const totalWritten = mockedFs.writeSync.mock.calls.reduce((acc, call) => {
      const length = (call as unknown as [number, Buffer, number, number, number])[3]
      return acc + length
    }, 0)
    expect(totalWritten).toBe(result.zeroedBytes)
  })
})
