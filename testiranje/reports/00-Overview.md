# Firmware Set Overview

## Provenance

All `.bin` files in this directory belong to a single **Western Digital hard-disk firmware image**. The controller family is internally designated **W38Q / R38Q** (a Marvell-based WD platform used roughly 2017–2019). The build metadata embedded in `82-Kompresovan modul.bin` is:

| Field | Value |
|---|---|
| Product code | `W38Q000` |
| Build timestamp | `02/22/18 15:15:31` (Feb 22, 2018) |
| Build user | `bldcrew` |
| Build host | `forge02` |
| Source tree | `C:/Temp/ccb7/R38Q/library/LHA4K` |
| Branch | `PLAIN_SA / RELEASE` |
| Compressor | `LHA4K` (WD-proprietary LHA variant, 4 KB block) |
| Container tag | `LHACW38Q` |

## File inventory

| File | Size | Type | Role |
|---|---:|---|---|
| `80-Bootmanager.bin` | 18 344 | BMGR module (ID 0x80) | Boot manager (ROM-launched) |
| `82-Kompresovan modul.bin` | 770 376 | CODF module (ID 0x82) | Compressed main firmware package |
| `Section0.bin` | 9 416 | Decompressed section | Early boot/init (shared w/ BMGR) |
| `Section1.bin` | 7 536 | Decompressed section | Hex/ASCII lookup + table |
| `Section2.bin` | 468 | Decompressed section | Small configuration block |
| `Section3.bin` | 842 804 | Decompressed section | Main controller firmware + code |
| `Section4.bin` | 104 528 | Decompressed section | ARM vector table + low-RAM code |
| `Tablica.txt` | 398 | Text | Section directory of the CODF module |

## Module framing (common to BMGR and CODF)

Both module files share the same 0x100-byte front-matter + section-table layout used throughout WD firmware:

```
+0x00  u32  length           (file size − 4)
+0x04  u32  module_id         (0x80 = BMGR, 0x82 = CODF)
+0x08  char[4] signature      ("BMGR" or "CODF")
+0x0C  u32  header_checksum
+0x10  u16  flags
+0x20  u32  section_count
+0x40  text metadata block    (only populated in CODF)
+0x100 Section_Entry[N]       20 bytes each:
         u32 reserved, u32 offset, u32 size, u32 crc32, u32 ram_load_addr
```

## Tablica.txt validation

`Tablica.txt` is the section directory for the **CODF** module. Each entry's CRC and RAM address are confirmed against the table at `0x100` of `82-Kompresovan modul.bin`:

| # | Offset | Size | RAM | CRC | Matches file |
|---|---:|---:|---:|---|---|
| 0 | `0x00000168` | `0x000024C8` | `0x0002DA28` | `E8FA15A9` | `Section0.bin` ✓ |
| 1 | `0x000020E4` | `0x00001D70` | `0x20488000` | `CEA926D6` | `Section1.bin` ✓ |
| 2 | `0x00003164` | `0x000001D4` | `0x0010AF00` | `AFE746A0` | `Section2.bin` ✓ |
| 3 | `0x0000323C` | `0x000CDC34` | `0x00240000` | `C3F8A128` | `Section3.bin` ✓ |
| 4 | `0x000A61B0` | `0x00019850` | `0x00000000` | `6FA0B5B1` | `Section4.bin` ✓ |

The byte sizes in the table match each `SectionN.bin` byte-for-byte, so `SectionN.bin` are the **decompressed outputs** of the CODF payload (not slices of the compressed file — the compressed bytes at those offsets are high-entropy LHA4K streams, not the ARM code we see in the `.bin` files).

## Memory map (RAM load addresses)

Combining the two tables gives the runtime memory layout the controller assembles before jumping to firmware:

```
 0x00000000 ─ Section4 (ARM vectors + data-path core image,   0x19850)   ◂ ARM-state
 0x00019850 ─ BMGR Section 1 (boot-manager private code,      0x021B4)   ◂ Thumb-2
 0x0002DA28 ─ Section0 / BMGR Section 0 (shared early-boot,   0x024C8)   ◂ Thumb-2
 0x0010AF00 ─ Section2 (channel register-init table,          0x001D4)   ◂ data
 0x00240000 ─ Section3 (MAIN controller firmware,             0xCDC34)   ◂ Thumb-2
 0x20488000 ─ Section1 (TCM module-directory lookup,          0x01D70)   ◂ data
```

## Dual-core architecture

Section 4 begins with a **classical ARM exception-vector table** (eight 32-bit `B`/`BLX` instructions at offsets 0x00–0x1C), while Sections 0 and 3 are built exclusively of Thumb-2 instructions that are **ARMv7-M-only** (`CBZ`, `IT`, `MOVW/MOVT`). The firmware therefore targets **two processor cores**:

| Core | ISA | Executes | Responsibilities |
|---|---|---|---|
| Service / Servo CPU | ARMv7-M (Thumb-2 only) | Sections 0, 3 + BMGR + TCM (Sec1) + reg-init (Sec2) | Servo, TFC, SMART, SA-dispatch |
| Data-path / Host CPU | ARMv7-R or -A (ARM + Thumb interworking) | Section 4 (RAM 0x0) | Host interface, buffer mgmt, inter-core mailbox |

The two cores exchange data through shared-memory blocks tagged with `0xDEADxxxx` sentinels (19 such tags are visible in the first 0x60 bytes of Section 4).

## Compression (LHA4K) — summary

- Algorithm: **LHA4K**, WD's proprietary variant of Haruyasu Yoshizaki's LZH, operating on **4 KB windows/blocks**.
- Container tag: `LHACW38Q` (LHA-Codec for W38Q).
- The compressed payload begins at offset `0x168` of `82-Kompresovan modul.bin` and runs to end-of-file, with entropy **7.96 bits/byte** (effectively incompressible further).
- The per-section "offset" values in the section table are **offsets into the decompressed image**, not into the compressed stream (see report for `82-Kompresovan modul.bin` for evidence).
- LHA4K is not interoperable with stock LHA / `lha`/`lhasa` tools — it uses a custom header, no filename field, and a modified Huffman preload. Full reversal is covered in the dedicated report.

## Per-file reports

- `01-80-Bootmanager.md`
- `02-82-Kompresovan_modul.md`
- `03-Section0.md`
- `04-Section1.md`
- `05-Section2.md`
- `06-Section3.md`
- `07-Section4.md`
