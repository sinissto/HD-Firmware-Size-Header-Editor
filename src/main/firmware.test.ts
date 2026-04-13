import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'

// Mock the entire 'fs' module so no real files are touched.
vi.mock('fs')

const mockedFs = vi.mocked(fs)

import { writeFirmwareHeader } from './firmware'

describe('writeFirmwareHeader', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('writes size-4 as a 4-byte little-endian value at offset 0', () => {
    const fileSize = 1024
    mockedFs.statSync.mockReturnValue({ size: fileSize } as fs.Stats)

    const fd = 42
    mockedFs.openSync.mockReturnValue(fd)
    mockedFs.writeSync.mockReturnValue(4)

    writeFirmwareHeader('/path/to/fw.bin')

    // openSync must use write mode (not read-only)
    expect(mockedFs.openSync).toHaveBeenCalledWith('/path/to/fw.bin', 'r+')

    // writeSync must write at offset 0
    // Cast to the buffer overload signature to avoid TS picking the string overload.
    const writeSyncArgs = mockedFs.writeSync.mock.calls[0] as unknown as [
      number,
      Buffer,
      number,
      number,
      number
    ]
    const [calledFd, calledBuf, , , calledPosition] = writeSyncArgs
    expect(calledFd).toBe(fd)
    expect(calledPosition).toBe(0)

    // Verify the buffer encodes (fileSize - 4) in little-endian order
    const expected = Buffer.alloc(4)
    expected.writeUInt32LE(fileSize - 4, 0)
    expect(Buffer.isBuffer(calledBuf)).toBe(true)
    expect(calledBuf).toEqual(expected)

    expect(mockedFs.closeSync).toHaveBeenCalledWith(fd)
  })

  it('closes the file descriptor even when writeSync throws', () => {
    mockedFs.statSync.mockReturnValue({ size: 100 } as fs.Stats)
    const fd = 7
    mockedFs.openSync.mockReturnValue(fd)
    mockedFs.writeSync.mockImplementation(() => {
      throw new Error('disk full')
    })

    expect(() => writeFirmwareHeader('/path/to/fw.bin')).toThrow('disk full')
    expect(mockedFs.closeSync).toHaveBeenCalledWith(fd)
  })

  it('throws when the file is exactly 4 bytes', () => {
    mockedFs.statSync.mockReturnValue({ size: 4 } as fs.Stats)

    expect(() => writeFirmwareHeader('/path/to/fw.bin')).toThrow(/too small/i)
    expect(mockedFs.openSync).not.toHaveBeenCalled()
  })

  it('throws when the file is smaller than 4 bytes', () => {
    mockedFs.statSync.mockReturnValue({ size: 3 } as fs.Stats)

    expect(() => writeFirmwareHeader('/path/to/fw.bin')).toThrow(/too small/i)
    expect(mockedFs.openSync).not.toHaveBeenCalled()
  })

  it('encodes a large file size correctly in little-endian', () => {
    const fileSize = 0x1_00_00_08 // 16_777_224 — carries across bytes
    mockedFs.statSync.mockReturnValue({ size: fileSize } as fs.Stats)
    mockedFs.openSync.mockReturnValue(1)
    mockedFs.writeSync.mockReturnValue(4)

    writeFirmwareHeader('/fw.bin')

    const [, calledBuf] = mockedFs.writeSync.mock.calls[0] as unknown as [number, Buffer]
    const expected = Buffer.alloc(4)
    expected.writeUInt32LE(fileSize - 4, 0)
    expect(calledBuf).toEqual(expected)
  })
})
