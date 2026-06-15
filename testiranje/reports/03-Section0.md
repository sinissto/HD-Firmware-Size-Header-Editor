# Section0.bin — Shared early-boot code

## 1. File identification

| Property | Value |
|---|---|
| Size | 9 416 bytes (0x24C8) |
| MD5 | `811ce8d7ea5944119fb0020a2db06121` |
| SHA-1 | `4e678c8c55b69b6de2063f97e1a3c92ea8d60c63` |
| Entropy | 6.946 bits/byte (pure ARM code) |
| Printable / zero / 0xFF ratios | 31.6 % / 7.4 % / 1.9 % |

## 2. Source / origin

This file is **exactly identical** to the first section of `80-Bootmanager.bin` (offset `0x12C`, size `0x24C8`, CRC `0xE8FA15A9`). It is also the first decompressed section of `82-Kompresovan modul.bin` (per the CODF directory). WD ships the same early-boot code in both modules so that:

- the mask ROM can run it before any depacker exists, and
- the runtime image can reload it after relocation.

Verified by a byte-for-byte compare:

```
bm[0x12C : 0x12C + 0x24C8]  ==  Section0.bin   → True (both files)
```

## 3. RAM mapping

Loaded at `0x0002DA28` (per the section table). The low RAM region `0x0000_0000 … 0x0008_0000` is the SoC's SRAM; Section 4 sits at `0x0`, BMGR private code at `0x19850`, and this block at `0x2DA28`.

## 4. Code observations

### 4.1 First bytes

```
0x0000  FF FF FF FF                              ; 4 bytes alignment/pad
0x0004  2D E9 F0 41  PUSH  {r4-r8, lr}           ; Thumb-2, AAPCS prologue
0x0008  04 00        MOVS  r4, r0
0x000A  1E D0        BEQ   +0x3C
0x000C  1D 48        LDR   r0, [pc, #0x74]       ; loads a parameter table pointer
0x000E  1E 4E        LDR   r6, [pc, #0x78]
0x0010  01 FB 00 F7  MLA   r7, r1, r0, r7        ; 32-bit multiply-accumulate
```

This is a Cortex-M (Thumb-2-only) function prologue. `MLA` is only encoded in Thumb-2 / ARMv7-M, so the target core is **ARM Cortex-M3/M4** class — consistent with Marvell's service-processor core on HDD controllers of the 2017-2019 generation.

### 4.2 Cortex-M barriers

```
BF F3 5F 8F    DSB SY
BF F3 4F 8F    DMB SY
BF F3 6F 8F    ISB SY
```

Present at several call sites. Used for:

- synchronising after writes to MMIO clock/PLL registers,
- flushing before handing off to another core or to a DMA engine.

### 4.3 Constant pool

Bytes `0x86 … 0xBF` contain PC-relative constants:

```
0x0086  A0 86 01 00     → 0x000186A0 (100 000 — likely a clock-in-Hz constant)
0x008A  80 F5 00 13     → 0x1300F580 (MMIO address, NAND or host IF)
0x008E  00 A3 E1 11     → 0x11E1A300 (≈300 MHz — clock value)
0x0092  00 E1 F5 05     → 0x05F5E100 (100 000 000 — 100 MHz)
```

These match the initialisation constants you would expect during DRAM/PLL/Channel bring-up on a HDD controller, and place Section 0 in the role of **clock, PLL, SRAM and low-level peripheral init** before the main firmware starts.

## 5. Entry-point hypothesis

Given that BMGR's section table lists Section 0 first and at RAM `0x0002DA28`, and that the BMGR's own code just below (`0x19850`) jumps into addresses inside this block, Section 0 likely contains:

- `init_clocks()` — PLL programming based on the fuses read by BMGR,
- `init_ddr()` — SDRAM controller configuration (uses the MMIO constants above),
- `init_bus_fabric()` — AXI/AHB switch / arbiter setup,
- `init_uart()` — a low-level debug UART used by WD factory tools (visible in Section 3 as `RWDC` / `CCT` strings).

## 6. Strings

Only 2 unique strings of length ≥ 8 exist — both are short version / padding artefacts. This is **expected** for pure init code (no format strings, no literals other than MMIO addresses).

## 7. Key takeaways

- ARM Cortex-M (Thumb-2) bring-up code.
- Shared verbatim between the boot manager and the main compressed firmware for boot-chain robustness.
- Responsibilities: clocks, DDR, fabric, low-level peripherals — ending in a hand-off into BMGR Section 1 or directly into Section 3.
