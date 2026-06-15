# Section4.bin — ARM exception vector table + low-RAM code (second core)

## 1. File identification

| Property | Value |
|---|---|
| Size | 104 528 bytes (0x19850) |
| MD5 | `88f9d774f2507ad3bb08cff43dccaebf` |
| SHA-1 | `cecaa6b7a4b33b931ac566d8ae4fd885fa5f8ca6` |
| Entropy | 7.078 bits/byte |
| Printable ratio | 31.9 % |
| Zero-byte ratio | 6.3 % |
| Unique strings ≥ 8 chars | 35 (none meaningful — all code fragments) |
| RAM load address | `0x00000000` |

## 2. First 64 bytes — classical-ARM exception vector table

Loaded at address `0x00000000`, so this section IS the processor's **vector table**:

```
0x00   57 35 00 FA      BLX  0x0000D564      ; Reset       → Thumb target
0x04   6C 35 00 EA      B    0x0000D5BC      ; Undefined
0x08   72 35 00 EA      B    0x0000D5D8      ; SWI / SVC
0x0C   81 35 00 EA      B    0x0000D618      ; Prefetch Abort
0x10   8A 35 00 EA      B    0x0000D640      ; Data Abort
0x14   98 35 00 EA      B    0x0000D67C      ; reserved
0x18   9D 35 00 EA      B    0x0000D694      ; IRQ
0x1C   B5 35 00 EA      B    0x0000D6F8      ; FIQ
```

This is the **classical ARM** (ARMv5/6/7-A or -R) vector table — 8 entries of 32-bit ARM branch instructions. The fact that the reset vector is `BLX` (`0xFA…`) rather than `B` means the reset handler is **Thumb-mode** code (the low bit of the target address is set) — this is the standard ARM/Thumb interworking boot convention.

Presence of **classical ARM state** instructions (vs. only Thumb-2) is significant: it rules out a pure Cortex-M target for this section. Section 4 therefore runs on a **different CPU** from Sections 0 and 3.

## 3. Architectural implication — dual-core controller

WD R38Q/W38Q-class controllers built by Marvell contain (at least) two processor cores:

| Core | ISA | Role | Firmware sections |
|---|---|---|---|
| Service / servo processor | ARMv7-M (Thumb-2 only) | servo, TFC, SMART, SA dispatcher, low-level init | Sections 0, 2, 3 + BMGR |
| Data-path / host processor | ARMv7-R or ARMv7-A (ARM + Thumb interworking) | host command translation, cache management, DRAM buffer pool | **Section 4** |

The low-RAM exception table in Section 4 is what the data-path core sees at reset. Putting two distinct firmware images into one container with different RAM addresses (`0x00000000` here vs `0x00240000` for Section 3) is how WD ships a dual-core system in one CODF module.

## 4. Post-vector data (0x20 — 0x60): boot-handoff descriptors

```
0x20  04 00 00 00                   ; magic / sync-counter = 4
0x24  00 00 00 00                   ; reserved
0x28  6C 3B AD DE                   ; 0xDEAD_3B6C marker
0x2C  00 02 00 00                   ; 0x0200   (region size in 4K?)
0x30  EE 07 AD DE                   ; 0xDEAD_07EE marker
0x34  05 00 00 00                   ; magic 5
0x38  78 3F AD DE                   ; 0xDEAD_3F78 marker
0x3C  01 3E FD 6B                   ; 0x6BFD_3E01 marker (scrambled)
0x40  AD DE AD DE                   ; 0xDEAD_DEAD — stack canary
0x44..0x5F  AD DE AD DE  ×7         ; more DEADDEAD fill
```

`0xDEADxxxx` tags are a well-known WD idiom used for:

- **fill/canary bytes** in uninitialised stack/heap pages,
- **sanity markers** embedded in inter-core shared-memory descriptors so one core can detect when the other has corrupted the block.

Counting: 19 occurrences of `0xDEAD` (LE) in Section 4. Most cluster here near the top of the vector table and in a shared-memory header — consistent with the **inter-core mailbox** region that the two processors use to synchronise.

## 5. Code body (0x60 onwards)

From `0x60` onwards the section is solid ARM/Thumb code. A typical handler starts:

```
0x60  55 48        LDR  r0, [pc, #0x154]    ; Thumb-2 literal pool
0x62  D0 F8 C8 02  LDR.W r0, [r0, #0x2C8]
0x66  C0 F3 00 30  UBFX r0, r0, #0, #0x1+1
0x6A  00 28        CMP  r0, #0
0x6C  00 D0        BEQ  +0
0x6E  01 20        MOVS r0, #1
0x70  70 47        BX   lr
```

Notable in the handlers found:

- Several `BFI` / `UBFX` uses (bit-field insert/extract) — typical of register decode helpers.
- `MRS` / `MSR` system-register moves (seen in byte patterns) — privileged mode, consistent with a Cortex-R/A supervising system.
- Calls to a function near `0x0000D564` (the reset handler target) include long `BL` encodings across the 2 KB+ range, consistent with a single flat image.

No classical "libc" strings (`printf`, `sprintf`, etc.), which means this core runs a stripped-down firmware runtime — only the minimum to service the host interface and talk to the other core via the shared mailbox.

## 6. Absence of meaningful strings

The 35 "strings" ≥ 8 chars are not human-readable messages — they are bytes of Thumb-2 code that happen to be ASCII-ish (e.g. `)FHF\n`, `BF!F(Ft`). This is normal for tightly-compiled ARM firmware that uses numeric event codes rather than strings for logging.

## 7. Key takeaways

- Section 4 is the **low-RAM image for the *other* CPU core** — it starts with a classical ARM exception vector table at address `0x00000000`.
- Its presence next to the purely-Thumb Sections 0 and 3 confirms the drive is a **dual-core design**: Cortex-M service processor + Cortex-R/A data-path processor.
- Inter-core synchronisation uses `0xDEADxxxx` tagged shared-memory blocks placed immediately after the vector table.
- The section contains exception handlers, a boot handoff area, and mailbox-management code — nothing host-addressable and no SMART / servo logic (those live in Section 3).
