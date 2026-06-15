# 80-Bootmanager.bin — Boot Manager module (ID 0x80)

## 1. File identification

| Property | Value |
|---|---|
| Size | 18 344 bytes (0x47A8) |
| MD5 | `0287a78e8320988e55e67f416ac68b35` |
| SHA-1 | `beff315181f6b7dfbb28aa02ae16971c37167798` |
| Entropy (whole file) | 6.907 bits/byte (compiled ARM code + sparse tables) |
| Printable ratio | 32.5 % |
| Zero-byte ratio | 8.1 % |
| 0xFF ratio | 1.5 % |

## 2. Header (WD generic module framing)

```
Offset  Value          Meaning
0x00    A4 47 00 00    length      = 0x000047A4  (file size − 4)
0x04    80 00 00 00    module_id   = 0x80        (boot manager)
0x08    "BMGR"         signature
0x0C    87 01 7F C6    header CRC  = 0xC67F0187
0x10    00 00 01 00    flags       = 0x00010000
0x14    00 00 00 00    reserved
0x20    02 00 00 00    section_count = 2
0x28    00 00 00 00    reserved
0x2C    2C 61 18 C3    aux checksum = 0xC318612C
```

Bytes `0x30 … 0xFF` are padded with 0x00.

## 3. Section table (starts at 0x100)

Entries are 20 bytes each (`reserved, offset, size, crc32, ram_load_addr`):

| # | File offset | Size | CRC32 | RAM load | Purpose |
|---|---:|---:|---|---:|---|
| 0 | `0x0000012C` | `0x000024C8` | `E8FA15A9` | `0x0002DA28` | Early-boot / init code |
| 1 | `0x000025F4` | `0x000021B4` | `FE3E536A` | `0x00019850` | Boot-manager private stage-2 |

`Section 0 is identical (CRC + content) to Section0.bin` and to the first CODF section. The bootmanager carries its own uncompressed copy so the ROM stage has something to run before the LHA4K decompressor is available.

```
bm[0x12C : 0x12C + 0x24C8] == Section0.bin   # exact match, verified byte-for-byte
```

## 4. Section 0 @ 0x12C (also in the CODF module)

First bytes show classic ARM-Thumb prologue after a 4-byte `FF FF FF FF` pad:

```
0x12C: FF FF FF FF                               ; padding
0x130: 2D E9 F0 41  PUSH  {r4-r8, lr}            ; function entry (Thumb-2)
0x134: 04 00 1E D0  BEQ   ...
0x138: 1D 48        LDR   r0, [pc, #0x74]
0x13A: 1E 4E        LDR   r6, [pc, #0x78]
0x13C: 01 FB 00 F7  MLA   r7, r1, r0, r7
```

The entropy of this 9 416-byte region is 6.95 — consistent with pure ARMv7-M / Thumb-2 code. Functions seen immediately after prologue: `BFF35F8F DSB`, `BFF34F8F DMB`, `BFF36F8F ISB` (all ARM Cortex-M memory barriers) — confirms **Cortex-M (Thumb-2 only)** target core, i.e. the Marvell HDD SoC service processor.

## 5. Section 1 @ 0x25F4

```
0x25F4: FE 48 70 B5 FE 4D 03 69 00 20 C0 EB C0 02 05 EB
```

`70 B5` = `PUSH {r4-r6, lr}` — another Thumb function. This block is the bootmanager's stage-2 code that lives at RAM `0x19850` and is responsible for:

- CRC-validating each section it is about to load,
- decompressing the CODF module (ID 0x82) from the disk's service area,
- relocating the decompressed sections to their RAM targets,
- jumping to Section 3's entry point.

Evidence for those roles, beyond the address layout, is the presence of repeated `BFF35F8F` / `BFF34F8F` barrier instructions and a PC-relative table whose values equal the other sections' RAM load addresses.

## 6. Relationship to the other files

| Provides | Where it comes from |
|---|---|
| Shared Section 0 (CRC `E8FA15A9`) | duplicated in CODF as Section 0 |
| BMGR Section 1 (CRC `FE3E536A`) | unique to BMGR — **does not exist in CODF** |

Execution order on the drive's power-up:

1. SoC mask ROM reads the bootmanager from the disk service area.
2. ROM validates the BMGR header CRC.
3. BMGR Section 0 runs from `0x2DA28`, initialises clock/DRAM/flash.
4. BMGR Section 1 runs from `0x19850`, pulls in the CODF (`0x82`) module, decompresses it.
5. Control transfers into Section 3 (main firmware at `0x240000`).

## 7. Integrity

Recomputing CRC32 (poly `0xEDB88320`) over each section body reproduces the CRC fields in the section table, so the module is internally consistent and not truncated.

## 8. Key takeaways

- This is a **standalone, uncompressed** boot manager — no compression is applied to BMGR modules by design so that the ROM can execute them directly.
- It shares its first section verbatim with the compressed module; only Section 1 is unique.
- Target CPU: ARM Cortex-M (Thumb-2) — the WD service processor on the Marvell R38Q/W38Q controller.
