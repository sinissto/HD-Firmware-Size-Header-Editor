# CRC (Cyclic Redundancy Check) Analysis

## Where CRC fields live

The module framing (common to both `80-Bootmanager.bin` and `82-Kompresovan modul.bin`) contains **two checksum fields** in the first 0x100 bytes:

| Offset | Field             | Example (BMGR) |
| ------ | ----------------- | -------------- |
| `0x0C` | `header_checksum` | `0xC67F0187`   |
| `0x2C` | `aux_checksum`    | `0xC318612C`   |

Then, for every section loaded at runtime, there is a dedicated CRC field inside each **20-byte section-table entry** at `0x100`:

```
Section entry layout (20 bytes):
  u32  reserved
  u32  offset          (decompressed-space offset)
  u32  size
  u32  crc32           ← integrity check of the decompressed section body
  u32  ram_load_addr
```

---

## Two distinct CRC algorithms are in play

### 1. Section-body CRCs in `80-Bootmanager.bin` — standard CRC-32

Confirmed by recomputing CRC32 (poly `0xEDB88320`) over each section body — reproduces the CRC fields in the section table exactly.

This is the **standard ISO 3309 / zlib / Ethernet CRC-32**:

| Parameter         | Value                                         |
| ----------------- | --------------------------------------------- |
| Polynomial        | `0xEDB88320` (reflected form of `0x04C11DB7`) |
| Init value        | `0xFFFFFFFF`                                  |
| Input reflection  | yes (byte-by-byte, LSB-first)                 |
| Output reflection | yes                                           |
| Final XOR         | `0xFFFFFFFF`                                  |

Standard `crc32()` calls can verify BMGR section bodies directly.

### 2. Section-body CRCs in `82-Kompresovan modul.bin` (CODF) — different variant

The CODF section CRCs **do not match** standard zlib CRC-32:

| Section | zlib CRC-32 (`0xEDB88320`) | Stored CODF CRC |
| ------- | -------------------------- | --------------- |
| 0       | `0xAFAB5047`               | `0xE8FA15A9`    |
| 1       | `0xAE948106`               | `0xCEA926D6`    |
| 2       | `0x2A8A0E0B`               | `0xAFE746A0`    |
| 3       | `0x5090FE09`               | `0xC3F8A128`    |
| 4       | `0xEA6D60CC`               | `0x6FA0B5B1`    |

Two candidate algorithms identified:

**Candidate A — "MPEG-2 / BZIP2" CRC-32:**

| Parameter         | Value                                              |
| ----------------- | -------------------------------------------------- |
| Polynomial        | `0x04C11DB7` (non-reflected, big-endian bit order) |
| Init              | `0xFFFFFFFF`                                       |
| Input reflection  | no                                                 |
| Output reflection | no                                                 |
| Final XOR         | `0x00000000`                                       |

**Candidate B — WDC byte-wise sum + rotate:**  
A proprietary WD checksum seen on older WD platforms — byte-accumulate with a rotate-left step, not a true LFSR polynomial. Less likely given the 32-bit field width.

---

## Summary table

| Context                | Polynomial                       | Reflected | Init         | XOR out      | Status                                   |
| ---------------------- | -------------------------------- | --------- | ------------ | ------------ | ---------------------------------------- |
| BMGR section bodies    | `0xEDB88320`                     | yes       | `0xFFFFFFFF` | `0xFFFFFFFF` | **confirmed**                            |
| CODF section bodies    | `0x04C11DB7` (or WDC sum-rotate) | no        | `0xFFFFFFFF` | `0x00000000` | **likely — not yet confirmed from code** |
| Module header (`0x0C`) | unknown                          | —         | —            | —            | not yet investigated                     |

---

## How to resolve the CODF CRC algorithm

The definitive answer requires lifting the checksum routine from **BMGR Section 1** (RAM `0x19850`) — that code CRC-validates each section before loading it, so the algorithm is embedded there in ARMv7-M Thumb-2 instructions.

Steps:

1. Disassemble BMGR Section 1 (`80-Bootmanager.bin` offset `0x25F4`, size `0x21B4`).
2. Locate the validation loop — Look for a loop that reads 4-byte chunks and XORs with a 256-entry table (standard CRC-32 table lookup), or a bit-by-bit poly multiplication.
3. Check the table seed: if entry `[1]` is `0x04C11DB7` → non-reflected variant; if `0x77073096` → standard zlib variant.
4. Alternatively, test Candidate A directly against the known values — crc32(data, poly=0x04C11DB7, init=0xFFFFFFFF, refin=False, refout=False, xorout=0x00) applied to each SectionN.bin should match the stored CODF CRC fields if that is the right variant.

---

## Key takeaways

- BMGR uses **standard zlib CRC-32** (`0xEDB88320`) — confirmed, cross-checked against known section bodies.
- CODF uses a **different CRC-32 variant**, most likely the non-reflected `0x04C11DB7` polynomial (MPEG-2/BZIP2 family).
- The CRC covers the **decompressed section body** in both cases — not the compressed bytes in the file.
- Module header CRC (`0x0C`) uses an as-yet-unidentified algorithm; resolving it requires the same BMGR Section 1 disassembly.
