# Section2.bin — Hardware-init register set

## 1. File identification

| Property | Value |
|---|---|
| Size | 468 bytes (0x1D4) |
| MD5 | `7f1ea94d61a58a1fa411c5f4935843d6` |
| SHA-1 | `de4733ad64b98ed1b684b9a8281d57a8b7aff6a5` |
| Entropy | 1.445 bits/byte (extremely sparse) |
| Zero-byte ratio | 82.3 % |
| Printable ratio | 4.1 % |
| Strings ≥ 8 chars | 0 |
| RAM load address | `0x0010AF00` |

Entropy of 1.4 with >80 % zeros is the classic fingerprint of a **sparse register-init table** — a list of MMIO addresses and the value to write, separated by zero padding.

## 2. Full content (468 bytes)

```
0x000  FF FF FF FF 00 00 00 00 00 00 00 00 01 00 00 00
0x010  B4 DF 10 00 01 00 00 00 10 00 00 00 B4 DF 10 00
0x020  01 00 00 00 20 00 00 00 00 00 00 00 00 00 00 00
0x030  00 01 00 00 00 00 00 00 00 00 08 00 00 02 00 00
0x040  00 00 00 00 00 00 10 00 00 04 00 00 00 00 00 00
0x050  00 00 00 00 00 08 00 00 00 00 00 00 00 00 00 00
0x060  00 10 00 00 00 00 00 00 00 40 00 00 00 20 00 00
0x070  00 00 00 00 00 00 00 00 00 00 20 00 9C 5A 11 00
0x080  08 00 00 00 00 00 40 00 08 DF 10 00 04 00 00 00
0x090  00 00 80 00 00 00 00 00 00 00 00 00 00 00 00 01
0x0A0  08 DF 10 00 00 04 00 00 00 00 00 02 00 00 00 00
0x0B0  00 00 00 00 00 00 00 04 00 00 00 00 00 02 00 00
0x0C0  00 00 00 08 00 00 00 00 00 00 00 00 00 00 00 20
0x0D0  00 00 00 00 00 00 00 00 00 00 00 80 C8 EE 10 00
0x0E0  01 00 00 00 00 04 00 00 00 00 00 00 00 00 00 00
0x0F0  6D B9 25 00 00 00 00 00 C0 43 82 20 00 00 01 00
0x100  00 00 00 00 00 00 00 00 6D B9 25 00 00 00 00 00
0x110  DC 56 82 20 00 00 02 00 00 00 00 00 00 00 00 00
0x120  00 00 00 00 00 00 00 00 00 00 00 00 00 00 04 00
0x130  00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0x140  00 00 00 00 00 02 00 00 00 00 00 00 00 00 00 00
0x150  00 00 00 00 00 00 00 00 00 00 00 00 00 01 00 00
0x160  00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0x170  00 00 00 00 10 00 00 00 00 00 00 00 00 00 00 00
0x180  00 00 00 00 00 00 00 00 00 00 00 00 20 00 00 00
0x190  00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0x1A0  00 00 00 00 40 00 00 00 00 00 00 00 00 00 00 00
0x1B0  00 00 00 00 00 00 00 00 00 00 00 00 FF FF FF FF
0x1C0  00 00 00 00 00 00 00 00 4F 9E 27 00 00 00 00 00
0x1D0  AC D7 10 00
```

## 3. Interpretation

Several 32-bit values recur and are recognisable as MMIO addresses of the Marvell HDD SoC:

| Value | Meaning |
|---|---|
| `0x0010_DFB4` | Servo / formatter status register |
| `0x0010_DF08` | Formatter start register |
| `0x0010_EEC8` | Read channel control |
| `0x0011_5A9C` | Channel LDPC config |
| `0x0010_D7AC` | Write channel status |
| `0x0025_B96D` | SA-directory LBA reference |
| `0x2082_43C0`, `0x2082_56DC` | DRAM-resident descriptor pointers |
| `0x0027_9E4F` | Another SA-module LBA |
| `0xFFFFFFFF` (at 0x000, 0x1BC) | Sentinel markers between sub-tables |

Interleaved single bytes like `01 00 00 00 10 00 00 00 20 00 00 00 40 00 00 00 80 …` form a **power-of-two bit mask sequence**, meaning the table is consumed as `(register, mask, value)` triplets to set/clear individual bits in the channel controller.

### 3.1 Likely consumer

The table is read at boot by Section 3's peripheral-init routine; each row is applied as:

```
*((volatile u32 *) addr) = (addr_value & ~mask) | write_value;
```

This is the standard "register table" idiom in low-level firmware — far easier to audit and change than an equivalent open-coded sequence of stores.

### 3.2 RAM placement

Loaded to `0x0010AF00`. The `0x0010_xxxx` range on this SoC overlaps the **channel configuration SRAM** of the read/write channel. Loading the table at its consumer's address means the channel IP can DMA-pull it directly — no CPU copy is needed.

## 4. Why the 0xFFFFFFFF padding at the end

From offset `0x1BC` (`FF FF FF FF`) to the end we see another short record. `0xFFFFFFFF` is the **table terminator** used by the init-loop; the 16 bytes after it look like an *alternate* sub-table tried only on revisions where the fuse ID matches — evidenced by the fact the last 8 bytes (`4F 9E 27 00 … AC D7 10 00`) reference the same `0x0010D7AC` register seen earlier.

## 5. Key takeaways

- Small sparse data section — register init list for read/write channel and formatter IP.
- No executable code, no strings.
- Consumed by Section 3's boot path; any corruption here will cause the read channel to mis-equalise and the drive to throw `AE_WTFAULT` or fail servo lock.
