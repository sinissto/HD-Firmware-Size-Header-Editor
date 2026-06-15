# Section3.bin — Main controller firmware

## 1. File identification

| Property | Value |
|---|---|
| Size | 842 804 bytes (0xCDC34) |
| MD5 | `41f754375912d5aa310d61fba4f64c40` |
| SHA-1 | `4c657867fef0129c04a908d6e4016edee9db07c1` |
| Entropy | 6.911 bits/byte (ARM code + string tables + sparse data) |
| Printable ratio | 32.1 % |
| Zero-byte ratio | 11.6 % |
| Unique strings ≥ 8 chars | 575 |
| Total strings ≥ 4 chars | ~3 058 unique |
| RAM load address | `0x00240000` |

This is by a wide margin the biggest section and contains 99 % of the actual HDD firmware.

## 2. RAM placement

Loaded at RAM `0x00240000`, the main SDRAM code region. On a Marvell R38Q/W38Q controller, `0x00240000 … 0x00300000` is backed by internal SRAM or low-latency tightly-coupled SDRAM where the service processor executes.

## 3. Top-of-file instructions

```
0x0000  1A 4A        LDR   r2, [pc, #0x68]
0x0002  00 21        MOVS  r1, #0
0x0004  41 F2 C0 33  MOVW  r3, #0x01C0
0x0008  5B 1E        SUBS  r3, r3, #1
0x000A  02 C2        STMIA r2!, {r1}
0x000C  FC D1        BNE   -4
0x000E  18 49        LDR   r1, [pc, #0x60]
0x0010  D1 F8 08 24  LDR.W r2, [r1, #0x408]
0x0014  22 F4 40 22  BIC.W r2, r2, #0x30_0000
0x0018  C1 F8 08 24  STR.W r2, [r1, #0x408]
...
```

A classic "zero BSS + program a clock gate + branch to main" pattern. The loop at `0x0004-0x000C` is **zeroing 0x1C0 words** (likely the uninitialised globals table); the sequence at `0x0010-0x001C` is **bit-clearing a clock-enable mask** in an MMIO peripheral at `r1 + 0x408`.

## 4. Architecture / toolchain fingerprint

- Instructions visible are all **Thumb-2** (every opcode is either a 16-bit Thumb or a `F0..FF` / `E8..EF` prefixed 32-bit Thumb-2). No ARM-state instructions occur.
- Uses `MOVW/MOVT` pairs, PC-relative loads, `IT` blocks, and `CBZ` — all indicating **ARMv7-M** (Cortex-M3/M4).
- Calling convention matches AAPCS (args in r0–r3, stack 8-aligned).
- Stack-pivot sequence `PUSH {... LR}; MOV FP, SP; SUB SP, #N; ... BL func; ADD SP, #N; POP {... PC}` is consistent with GCC for ARM (WD historically uses the ARM / Sourcery G++ toolchain for R38Q).

## 5. Major subsystems identified via string analysis

### 5.1 Servo / mechanical control

| String | Meaning |
|---|---|
| `Half_Track`, `LWSTrack`, `rawTracks` | track-counting data structures |
| `CurrentHead`, `NewHead`, `HD_SWITCH_MODE` | head-switching state machine |
| `RROLearning`, `RROFieldMissing`, `RROFieldMisread`, `RRO_PARITY_MISMATCH`, `RRO_CYL_MISMATCH`, `DiskRROFieldOK` | **R**epeatable **R**un-**O**ut compensation — reads embedded servo burst corrections |
| `MakeServoSafe`, `ServoVGA` | servo safety / variable-gain amplifier control |
| `SEEK_MODE`, `IDLE_MODE`, `NORMAL_MODE`, `SEARCH_MODE` | spindle / head-positioning state names |
| `OffTrackWrite`, `OfftrackEventPending` | off-track-write protection |
| `SKIP_SECTOR`, `SkipYMkFFMisreadWI` | recovery strategies |
| `FormatterRead`, `FormatterWrite`, `FormatterBusy` | disk formatter IP control |
| `WriteDataMode` | R/W-channel mode selector |
| `NOSTM_FIRST_SID_NEW_HEAD` | "no servo-timing-mark on first SID after new head" — a specific servo fault condition |

### 5.2 TFC — Thermal-Flying-height Control

TFC heats the read/write head to push it towards the platter and shrink the fly-height during R/W:

```
Preheat_TFC
TFCSkipTA
TFCState
TFCStatus_RdWrBurstComplete
TFCStatus_BoostBurstComplete
TFCStatus_SeekBurstComplete
TFCStatus_PulseLowBurstComplete
TFCStatus_PulseHighBurstComplete
TFCStatus_DeviceCTLRBurstComplete
TFCStatus_InProgress
TFCStatus_Resv1…Resv9  (reserved bits in the TFC status word)
```

Presence of a full TFC state machine confirms this firmware drives a head with **integrated DFH (Dynamic Fly Height)** heater — standard on WD 2018 3.5″ and 2.5″ drives.

### 5.3 SMART / logging

```
SMART     SMRTST    SMRTLOG   SMRTATR   HDST      SANITIZE
IM_LGSN   IM_LGEV   IM_LGME   IM_LGHW   IM_LGLO   IM_LGSV
IM_SVEC   IM_LGLI   IM_LGHI   IM_LGDH   IM_LGAR   IM_FLLG
IM_LGDG   IM_LGTG   IM_LGTM   IM_EPOL   IM_LGSE   IM_LGFH
IM_LGU2   IM_LGFB   IM_LGF2   IM_LGIV   IM_LGTS
FIMG      FCOD      LGAT      EVDP      PERF      NOTCH
ZCHS      PATT      ERPH      DIR       FAT       FISA
PLIST     GLIST     ACRP      AMCD      LTMN      SNAP
WEAR      IDENTIFY  INQRYSTD  INQEVPD   MDSNS03F
NB_TRKTB  RDCAP16   LGSNSALL  IPCR      FL_NONFW
```

These are the **SA (Service Area) module IDs** exposed through WD's proprietary vendor-specific commands and through SAT-passthrough `SMART READ LOG PAGE`. Useful references:

- `PLIST` — Primary defect list (factory)
- `GLIST` — Grown defect list (runtime reallocated sectors)
- `IM_FLLG` — Flash/NAND log
- `SMRTATR`, `SMRTLOG`, `SMRTST` — SMART attributes, log, self-test
- `SANITIZE`, `WEAR` — secure-erase / wear-leveling counters (media cache on SMR/hybrid)
- `FIMG` / `FCOD` — firmware image / firmware code modules
- `IDENTIFY` / `INQRYSTD` / `INQEVPD` — ATA IDENTIFY and SCSI Inquiry page data
- `NOTCH` — zone/notch table
- `ZCHS` — zone Cyl/Head/Sector mapping
- `FISA` — Factory ISA (Intelligent Seek Algorithm) parameters
- `ACRP` / `AMCD` — A-C RPM and adaptive media caching descriptors

### 5.4 Error-handling / build metadata

- `RWDC#` — WD factory "Return-Merchandise" identifier / diagnostic console tag.
- `RELEASE` — matches the CODF header's build flavour.
- `HGST` — appears in an INQUIRY string table. WD owns HGST; after the Toshiba/HGST/WD 2015 consolidation WD reused HGST's servo-channel firmware modules — the string's presence here is expected.
- `H DREVerXX` — at `0x00D0A5`; likely a **H**ead **DRE** (Drive Revision) version token patched at factory programming.

### 5.5 Channel / DSP constants

- `RefGainRevWr`, `RefGainRevRd` — reference-gain values for the read/write channel AGC.
- `AE_WTFAULT` — asynchronous-event *Write Fault*.
- `WriteInhibit`, `TSD_TIMEOUT` (touch-down-sensor timeout), `SHARP_INTERRUPT` (unscheduled IRQ).

## 6. Command-dispatch table (0x0CC000 – 0x0CD100)

The region `0x0CC000 … 0x0CD100` contains a list of **32-byte fixed-width records**, each starting with an 8-char ASCII name followed by 24 bytes of descriptor (function-pointer + flags + size). The table enumerates the subset of SA / log modules the firmware exposes through its host-command dispatcher. Counting the unique entries yields ~120 commands — consistent with the full WD SCT/SMART surface plus factory-only vendor commands.

## 7. Embedded ARM function patterns

Spot-checked sections show extensive use of:

- **CBZ / CBNZ** (compact compare-branch-zero), ARMv7-M only.
- **IT (if-then) blocks** with 4-instruction windows.
- **PUSH/POP with FP** frame setup (GCC `-fomit-frame-pointer` is *off* for this build — makes debugging on the factory console easier).
- **SVC** instructions (software-interrupt) for transitions between the servo-real-time context and normal firmware context.

## 8. Memory-mapped registers referenced

PC-relative constant pools reference the following MMIO ranges (decoded from `LDR r?, [pc, #…]` follows and matches Section 1's region table):

- `0x1200_0xxx` — DRAM controller
- `0x1201_xxxx` — Host interface (ATA / SATA PHY, task-file)
- `0x1202_xxxx` — Buffer manager
- `0x1203_xxxx` — Formatter
- `0x1204_xxxx` — Read channel
- `0x1205_xxxx` — Write channel
- `0x1206_xxxx` — Servo DSP
- `0x1207_xxxx` — Flash / NAND (for the "media cache")
- `0x120A_xxxx` — Miscellaneous (LED, SPI, debug UART)

## 9. Key takeaways

- **Main firmware** for a WD R38Q/W38Q drive built 22-Feb-2018: servo, TFC, SMART, SA-module directory, host command dispatcher, defect lists, logs and diagnostics.
- Target CPU is **ARM Cortex-M (Thumb-2)** — the Marvell service processor.
- Heavy coupling with Section 1 (MMIO ranges, SA directory) and Section 2 (channel register init).
- Any byte-level modification requires CRC recomputation (CRC `C3F8A128` over 0xCDC34 bytes) plus re-wrapping into the LHA4K stream — in practice Section 3 is the only section that meaningfully changes between drive firmware revisions.
