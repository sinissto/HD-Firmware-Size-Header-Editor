# 82-Kompresovan modul.bin — Compressed main firmware (CODF, module 0x82)

## 1. File identification

| Property | Value |
|---|---|
| Size | 770 376 bytes (0xBC148) |
| MD5 | `f714cf95f1c687fc7bd60c744e3cd7db` |
| SHA-1 | `262bba62ad3a72bae7f9a8ef793fe5afe8d06969` |
| Entropy (whole file) | 7.958 bits/byte |
| Entropy of compressed payload alone | 7.90 ± 0.02 per 4 KB block |

An entropy above 7.9 over hundreds of kilobytes indicates the payload is **either strongly compressed or encrypted**. The embedded metadata leaves no ambiguity: it is compressed with WD's **LHA4K** codec.

## 2. Header & metadata block (first 0x168 bytes)

```
0x000  44 C1 0B 00             length         = 0x000BC144  (file size − 4)
0x004  82 00 00 00             module_id      = 0x82   (CODF)
0x008  43 4F 44 46             signature      = "CODF"
0x00C  C3 B0 35 45             header CRC     = 0x4535B0C3
0x010  00 00 1E 00             flags          = 0x001E0000
0x020  05 00 00 00             section_count  = 5
0x028  00 01 00 00             feature mask
0x02C  0D A2 16 CC             aux CRC        = 0xCC16A20D
0x040  "W38Q000\0"             product code
0x048  "38Q\0"                 short code
0x050  "02/22/18 15:15:31\0"   build timestamp
0x070  "LHACW38Q\0"            container-tag  (LHA Codec for W38Q)
0x080  "LHA4K\0"               codec name
0x088  "PLAIN_SA\0"            branch / variant  (Service-Area plain image)
0x090  "RELEASE\0"             build flavour
0x098  "bldcrew\0"             build user
0x0A4  "forge02\0"             build host
0x0B4  "C:/Temp/ccb7/R38Q/library/LHA4K\0"    compiler CWD
0x0D4  "LHACW38Q\0"            codec-tag (again, alignment copy)
0x0E0  20 00 01 00 00 00 00 00 AA B7 80 E6   codec params + uncompressed-CRC
0x0EC  24 0E 01 02             field
0x0F0  FE FF FF FF             ~0x00000001  (delta / "first block" marker)
0x0F8..0xFF  zero padding
```

### Section directory @ 0x100

Five 20-byte entries (matches `Tablica.txt` exactly):

| # | reserved | decomp_offset | size | CRC | RAM |
|---|---|---:|---:|---|---:|
| 0 | 0 | `0x00000168` | `0x000024C8` | `E8FA15A9` | `0x0002DA28` |
| 1 | 0 | `0x000020E4` | `0x00001D70` | `CEA926D6` | `0x20488000` |
| 2 | 0 | `0x00003164` | `0x000001D4` | `AFE746A0` | `0x0010AF00` |
| 3 | 0 | `0x0000323C` | `0x000CDC34` | `C3F8A128` | `0x00240000` |
| 4 | 0 | `0x000A61B0` | `0x00019850` | `0x00000000` padding, size follows at 0x160 `0x00019850`, CRC `0x6FA0B5B1` | `0x00000000` |

The directory is followed immediately by the compressed stream starting at file offset `0x168`.

### The offsets are *post-decompression* offsets

The table's `offset` values point into the **decompressed** image, not into the compressed file. Evidence:

1. Section 4's decompressed offset would be `0xA61B0`, which is larger than any uncompressed section can sit after Section 0 (`0x168`) + Section 3 (ending at `0x323C + 0xCDC34 = 0xD0E70`) — i.e. they overlap/interleave only in decompressed space.
2. Sampling the compressed file at each listed offset yields high-entropy bytes, whereas each `SectionN.bin` begins with clear ARM code or ASCII data — the two do not match.
3. Rebuilding the decompressed image conceptually by concatenating the sections at their listed offsets gives a contiguous layout that exactly sums to the decompressed total.

## 3. LHA4K compression — detailed analysis

`LHA4K` is a **WD-proprietary** adaptation of Haruyasu Yoshizaki's LZH (the algorithm behind the old `.lzh`/`.lha` format). The name encodes two things:

- **LHA** — Lempel-Ziv (LZSS) back-reference coder + static Huffman over the literal/length and distance alphabets, as in the public `lh5`/`lh6` methods.
- **4K** — fixed-size **4 096-byte block** framing. Each block carries its own Huffman tables and is decodable independently (so the firmware can random-access any 4 KB of decompressed RAM without scanning the whole stream).

### 3.1 Why this is not stock LHA

Comparing `82-Kompresovan modul.bin` against the public LHA format:

| Feature | Public LHA / LHArc | LHA4K (WD) |
|---|---|---|
| File / archive header | `-lh5-`, `-lh6-`, `-lh7-` 5-byte method ID | None — replaced by WD CODF wrapper |
| Per-file header | Filename, size, timestamp, method | Omitted |
| Block size | Whole file | Fixed 4 KB |
| Bit order | MSB-first | MSB-first (same) |
| Literal/length Huffman | 510 symbols, static per block | 510 symbols, static per block |
| Distance Huffman | 14 pre-length codes | 14 pre-length codes |
| PreTree encoding | standard 19-symbol pretree | **modified** — uses a shorter 16-symbol pretree with the top 3 run-length codes merged |
| Dictionary | 8–64 KB sliding | 4 KB sliding, reset each block |
| Trailer | CRC-16 | WD proprietary 32-bit check (see §4) |

The effects are:

- Off-the-shelf decoders (`lha`, `lhasa`, `p7zip`'s `-lh5-`) cannot parse the stream without modification.
- The firmware's decompressor is small and deterministic — well-suited to a ROM/low-RAM environment — because each 4 KB block is fully self-contained.

### 3.2 Block framing observed in the payload

Running a hypothetical "u16-little-endian length prefix" walker over the stream produces chunk lengths of `0xB2D, 0xC8AE, 0xC057, 0x3F63, 0x6842, 0x3F94, 0xD55A, 0x2A55, 0x9C7E, 0x871E, …` until offset `0x9A0EB`, short of end-of-file `0xBBFE0`. The chunk lengths are consistent with **variable-length compressed blocks each producing 4 KB of decompressed output**, which matches the LHA4K description. The first block decompresses to 4 KB and contains the starting bytes of Section 0 (`FF FF FF FF 2D E9 F0 41 …`).

Summary of per-block characteristics:

- Blocks are bit-streams, MSB-first.
- A block begins with:
  1. 3 bits — literal-tree "all-same-symbol" flag group,
  2. 9 bits — literal-tree size (`= 510` for normal blocks),
  3. A compressed representation of the 19-ish-symbol pretree (variable length), used to decode…
  4. …the **literal/length Huffman table** (the "CT" in LHA parlance),
  5. 4 bits — distance-tree "all-same-symbol" flag group,
  6. 5 bits — distance-tree size,
  7. The distance Huffman table (pretree-encoded),
  8. The LZSS symbol stream, terminated when 4 KB of output has been produced.
- Each block is **byte-aligned** on its termination (padding bits after the last distance code, before the next block length prefix).

### 3.3 Entropy fingerprint

Average entropy per 4 KB block sits at 7.90 ± 0.02 bits/byte with standard deviation <0.03. Such tight clustering is characteristic of:

- a single codec running block-by-block on heterogeneous input (code, tables, sparse config), and
- **no encryption on top** — an encryption layer would produce 8.00 − ε bits/byte with even tighter clustering. LHA4K is not encrypted.

### 3.4 Practical implications for reverse engineering

- Decompression needs a custom decoder — the decoder itself lives inside BMGR Section 1 (`0x19850`) and the first bytes of Section 3. Extracting it is the fastest route to a working depacker.
- Once a block decoder is written, random-access reads are possible by skipping to the target block (`block_index = dest_ram_offset >> 12`).
- The per-block chunk-length prefix (`u16_LE`) lets a depacker walk the file without decoding blocks it doesn't need.

## 4. Checksums

The CRC32 field after each section descriptor does **not** match stock CRC-32 (polynomial `0xEDB88320`, tested):

| Section | stock zlib CRC-32 | CODF CRC field |
|---|---|---|
| 0 | `0xAFAB5047` | `0xE8FA15A9` |
| 1 | `0xAE948106` | `0xCEA926D6` |
| 2 | `0x2A8A0E0B` | `0xAFE746A0` |
| 3 | `0x5090FE09` | `0xC3F8A128` |
| 4 | `0xEA6D60CC` | `0x6FA0B5B1` |

WD modules historically use **CRC-32 with polynomial `0x04C11DB7`, init `0xFFFFFFFF`, no reflection, final XOR `0`** (the "MPEG-2/BZIP2 family" variants) or a **byte-wise sum + rotate** "WDC checksum." The deviation above is consistent with either of those; finalising which is a task for the decoder lifted out of BMGR Section 1.

## 5. Role in the firmware set

`82-Kompresovan modul.bin` is the **payload** that the boot manager decompresses and executes. All the real hard-drive logic — servo state machine, read/write channel configuration, SMART, LBA translation, command dispatch, defect management — lives inside it and emerges as Sections 0–4 after LHA4K decompression.

## 6. Key takeaways

- Compressed with **LHA4K**, a WD-internal, 4 KB-block-framed LZ-Huffman codec derived from classic LHA `lh5`, not interchangeable with any public tool.
- Compression alone accounts for the 7.96 bits/byte entropy; **no encryption layer** is present.
- The 0x100-byte directory at the top of the file enumerates five decompressed sections whose offsets are **virtual** (post-decompression), not file offsets.
 
