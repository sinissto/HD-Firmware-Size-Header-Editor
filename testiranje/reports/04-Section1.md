# Section1.bin — TCM lookup / module-LBA index table

## 1. File identification

| Property | Value |
|---|---|
| Size | 7 536 bytes (0x1D70) |
| MD5 | `f0dfe106a2b7960b2dbc2813db7904b0` |
| SHA-1 | `ef3eee1eb25976ed62fed23f869993d8c0e82f69` |
| Entropy | 4.505 bits/byte (highly structured data) |
| Zero-byte ratio | 46.2 % |
| Unique ≥ 8-char strings | 1 (just `"0123456789ABCDEF"`) |
| RAM load address | `0x20488000` — **tightly-coupled memory (TCM)** |

The entropy of 4.5 with 46 % zero bytes is the classic fingerprint of a fixed-layout data/lookup table, not code.

## 2. RAM placement — tightly-coupled memory

The RAM load address `0x20488000` is far away from the other sections (which live at `0x00000000 … 0x002DFFFF`). On Marvell's WD controller SoCs, addresses of the form `0x2040_xxxx … 0x208F_xxxx` are the **TCM** (tightly-coupled memory) of the Cortex-M service processor. TCM is prized for zero-wait-state access, so WD reserves it for:

- small Huffman / CRC / hex-conversion lookup tables,
- servo interrupt handlers needing deterministic timing,
- DMA descriptor pools.

Section 1's content is consistent with the first role.

## 3. Structure

### 3.1 Header @ 0x00: hex-conversion lookup

```
0x0000  30 31 32 33 34 35 36 37 38 39 41 42 43 44 45 46   "0123456789ABCDEF"
```

A 16-byte ASCII table used by the firmware to print nibble-to-ASCII (sprintf-style hex conversion) in interrupt context without pulling in a full `printf`.

### 3.2 Memory-region descriptor table @ 0x10–0x7F

112 bytes of u32 pairs, little-endian:

```
0x10  0x1200_0000   (region base)
0x14  0x1200_0840   (region end / length)
0x18  0x1201_0000
0x1C  0x1201_2700
0x20  0x1201_8000
0x24  0x1201_86C0
0x28  0x1202_0000
0x2C  0x1202_3E80
0x30  0x1203_0000
0x34  0x1203_1000
0x38  0x1204_0000
0x3C  0x1204_4000
0x40  0x1205_0000
0x44  0x1205_4000
0x48  0x1204_8000
0x4C  0x1204_C000
0x50  0x1204_F000
0x54  0x1204_F800
0x58  0x1205_8000
0x5C  0x1205_C000
0x60  0x1206_0000
0x64  0x1206_2000
0x68  0x1207_0000
0x6C  0x1207_1000
0x70  0x120A_0000
0x74  0x120A_2000
0x78  0xFFFFFFFF    (terminator)
0x7C  0xFFFFFFFF
```

The `0x12xx_xxxx` addresses are Marvell's **controller MMIO window** on R38Q/W38Q SoCs (Servo DSP registers, Formatter/WCI registers, Buffer Manager, DRAM Controller, etc.). Each pair is a `(base, end)` range that the firmware memsets/protects during boot. The table terminates with `0xFFFFFFFF 0xFFFFFFFF`.

### 3.3 Module-LBA index table @ 0x80 – 0x1D6F

Starting at `0x80`, 12-byte records of the form:

```
u32  attributes
u32  zero
u32  disk_LBA (×512 bytes)
```

First few entries:

```
0x0080  attr=0x14820000   zero=0         LBA=0x0024FB0B
0x008C  attr=0x14820000   zero=0         LBA=0x00005175
0x0098  attr=0x14820000   zero=0         LBA=0x00258D9D
0x00A4  attr=0x14820000   zero=0         LBA=0x00258F61
0x00B0  attr=0x14820000   zero=0         LBA=0x0025B96D
```

These are absolute LBA pointers into the drive's **Service Area** (SA) modules — the hidden tracks outside the user-addressable space that store per-drive calibration, firmware, defect lists, SMART counters and event logs.

WD's SA module directory ("Module Directory" / "Dir module 1") is exactly this shape: attribute word, padding, absolute LBA. The list contains ~620 slots (7536 – 0x80 ≈ 7296, ÷12 ≈ 608 entries), which matches the typical number of SA modules on a WD drive of this generation.

## 4. Why keep this in TCM

Servicing a host command such as `SMART READ LOG` or `READ BUFFER` needs to resolve a *module ID → disk LBA* mapping in a handful of cycles on the hot-path. Putting the directory in TCM guarantees 1-cycle reads; RAM or NAND reads would blow the servo-tick budget.

## 5. Key takeaways

- Pure data section (entropy 4.5, printable 20 %), no executable code.
- Loaded into TCM (`0x20488000`) for fastest access by ISRs and hot-path resolvers.
- Contains three sub-tables: hex-nibble ASCII lookup, MMIO region ranges, and the drive's Service-Area module directory.
- Changing any of these fields risks bricking the drive — they are consumed by code in Section 3 that computes LBAs for every SMART / log / parameter access.
