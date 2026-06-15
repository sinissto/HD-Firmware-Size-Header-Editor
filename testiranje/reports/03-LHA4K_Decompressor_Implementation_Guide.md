# LHA4K Decompressor Implementation Guide

## Overview

Guide for building an LHA4K decompressor to extract content from `82-Kompresovan modul.bin` that is identical to `Section0.bin`, `Section1.bin`, `Section2.bin`, `Section3.bin`, and `Section4.bin`.

**Key insight:** LHA4K is WD-proprietary, not standard LHA. Existing tools (`lha`, `7zip`, etc.) will not work. The working decompressor already exists in the firmware (BMGR Section 1, `0x19850`).

---

## Three practical paths to implementation

### **Path 1: Extract the decompressor from firmware (fastest)**

The working decompressor is already embedded in `80-Bootmanager.bin` Section 1:

```bash
# Extract Section 1 from bootmanager (offset 0x25F4, size 0x21B4)
dd if=80-Bootmanager.bin bs=1 skip=$((0x25F4)) count=$((0x21B4)) of=section1_decompressor.bin
```

This is ARM Cortex-M Thumb-2 code. The implementation path:

1. Disassemble with Ghidra/IDA Pro to understand the ABI and function signatures
2. Create a wrapper to call it from your host machine
3. Set up ARM emulation (QEMU-ARM or llvm-objdump + manual trace)

**Pros:**
- Proven, real implementation
- Guarantees byte-for-byte correctness
- Can be single-stepped through debugger

**Cons:**
- Requires ARM reverse engineering expertise
- Needs emulation environment setup
- Slower iteration during debugging

---

### **Path 2: Implement from scratch (recommended for analysis)**

Given the detailed format analysis in the reports, implement a fresh decompressor. This is the most educational approach.

#### Algorithm structure

```python
class LHA4K_Decompressor:
    def __init__(self, data):
        self.data = data
        self.pos = 0
        self.bit_buffer = 0
        self.bit_count = 0
    
    def read_block(self):
        """Decompress one 4 KB block"""
        # 1. Read 3-bit literal-tree flag
        lit_flags = self.read_bits(3)
        
        # 2. Read 9-bit literal tree size
        lit_size = self.read_bits(9)
        
        # 3. Decode 16-symbol pretree (WD variant, NOT standard 19-symbol)
        pretree = self.read_pretree(16)
        
        # 4. Decode literal/length Huffman table using pretree
        lit_tree = self.decode_tree(pretree, lit_size)
        
        # 5. Read distance tree (4-bit flag + 5-bit size)
        dist_flags = self.read_bits(4)
        dist_size = self.read_bits(5)
        dist_tree = self.decode_tree(pretree, dist_size)
        
        # 6. Decompress LZSS stream until 4 KB output
        output = bytearray()
        while len(output) < 4096:
            symbol = self.read_symbol(lit_tree)
            if symbol < 256:
                # Literal byte
                output.append(symbol)
            else:
                # Back-reference (match)
                length = symbol - 256 + 3
                dist_code = self.read_symbol(dist_tree)
                distance = self.decode_distance(dist_code)
                for i in range(length):
                    output.append(output[-distance])
        
        return bytes(output)
    
    def decompress_all(self):
        """Process all blocks into the decompressed image"""
        result = bytearray()
        while self.pos < len(self.data):
            block = self.read_block()
            result.extend(block)
        return bytes(result)
```

#### Key implementation details from format analysis

Based on §3.2 of the 82-Kompresovan modul report:

- **Block framing:** Each block starts with a u16 little-endian length prefix
- **Literal/length alphabet:** 510 symbols, static per block
- **Distance alphabet:** 14 pre-length codes
- **Pretree:** WD uses **16-symbol variant** (not standard 19-symbol), with top 3 run-length codes merged
- **Dictionary:** 4 KB sliding window, **reset each block**
- **Bit order:** MSB-first (standard)
- **Byte alignment:** Each block is byte-aligned at termination (padding bits before next block length)

#### Testing checkpoints

```python
# After implementing, test each stage:

# 1. Block header parsing
with open('82-Kompresovan modul.bin', 'rb') as f:
    f.seek(0x168)  # Start of compressed stream
    block_1_len = int.from_bytes(f.read(2), 'little')
    print(f"Block 1 compressed size: {block_1_len:#x}")  # Should match ~0xB2D

# 2. First block decompression
decompressor = LHA4K_Decompressor(compressed_data)
block_1 = decompressor.read_block()
print(f"Block 1 decompressed size: {len(block_1)}")  # Should be 4096

# 3. Full decompression + section validation
full_decompressed = decompressor.decompress_all()
import zlib

# Section 0 (offset 0x00000168, size 0x000024C8, CRC E8FA15A9)
section0 = full_decompressed[0x168:0x168 + 0x24C8]
crc = zlib.crc32(section0) & 0xFFFFFFFF
print(f"Section 0 CRC: {crc:#x} (expected E8FA15A9)")

# Compare with extracted file
with open('Section0.bin', 'rb') as f:
    expected = f.read()
    assert section0 == expected, "Section 0 mismatch!"
```

**Pros:**
- Full control and debugging visibility
- Educational — deep understanding of LHA4K
- Portable, no external emulation needed
- Can be optimized and adapted

**Cons:**
- 300–500 lines of code
- Requires careful Huffman tree implementation
- Debugging bit-level streams is tedious

**Language recommendation:** Python for initial development (fast iteration), then C/Rust if performance matters.

---

### **Path 3: Adapt existing LHA library**

Use an open-source LHA library as a starting point, then modify for WD's format:

```python
# Hypothetical adaptation
import lha  # e.g., pylha

# Modifications required:
modifications = {
    "skip_standard_lha_headers": True,  # Use CODF wrapper instead
    "pretree_size": 16,                 # WD variant, not 19
    "block_size": 4096,                 # Fixed 4 KB blocks
    "dictionary_reset": True,           # Reset per block, not whole-file
}

# Example: patch a pure-Python LHA implementation
def patch_lha_for_wd(lha_module):
    original_decode_pretree = lha_module.decode_pretree
    
    def wd_decode_pretree(bitstream, size=16):
        # WD variant: 16 symbols instead of 19
        # Top 3 run-length codes merged
        return original_decode_pretree(bitstream, size)
    
    lha_module.decode_pretree = wd_decode_pretree
    return lha_module
```

Common LHA implementations to start from:
- **lha.c** (xfree86 / umlaut) — clean C reference
- **lhasa** — well-documented, C library
- **pylha** (Python) — easier to modify

**Pros:**
- Leverages tested compression code
- Faster to get working
- Can reuse optimizations

**Cons:**
- Still requires substantial adaptation for WD format
- LHA libraries are aging, sparse documentation
- Harder to debug if the base library has bugs

---

## Validation strategy

Once you have a decompressor, verify it against known-good output:

```bash
# Your decompressor must produce:
# - decompressed[0x168:0x168+0x24C8] == Section0.bin (CRC E8FA15A9)
# - decompressed[0x20E4:0x20E4+0x1D70] == Section1.bin (CRC CEA926D6)
# - decompressed[0x3164:0x3164+0x1D4] == Section2.bin (CRC AFE746A0)
# - decompressed[0x323C:0x323C+0xCDC34] == Section3.bin (CRC C3F8A128)
# - decompressed[0xA61B0:0xA61B0+0x19850] == Section4.bin (CRC 6FA0B5B1)

# Offsets from CODF section directory @ 0x100 are post-decompression addresses
```

Test script outline:

```python
#!/usr/bin/env python3
import zlib
import struct

def validate_decompression(decompressed_data, reference_sections):
    """
    reference_sections: dict of {section_num: (file_offset, size, expected_crc)}
    """
    expected = {
        0: (0x00000168, 0x000024C8, 0xE8FA15A9),
        1: (0x000020E4, 0x00001D70, 0xCEA926D6),
        2: (0x00003164, 0x000001D4, 0xAFE746A0),
        3: (0x0000323C, 0x000CDC34, 0xC3F8A128),
        4: (0x000A61B0, 0x00019850, 0x6FA0B5B1),
    }
    
    all_pass = True
    for section_num, (offset, size, expected_crc) in expected.items():
        section_data = decompressed_data[offset:offset + size]
        
        # Verify size
        if len(section_data) != size:
            print(f"❌ Section {section_num}: size mismatch ({len(section_data)} vs {size})")
            all_pass = False
            continue
        
        # Verify CRC (WD's CRC, not stock zlib)
        # TODO: implement WD CRC variant (poly 0x04C11DB7 or byte-wise sum)
        actual_crc = compute_wd_crc32(section_data)
        
        if actual_crc == expected_crc:
            print(f"✓ Section {section_num}: CRC {actual_crc:#010x} matches")
        else:
            print(f"❌ Section {section_num}: CRC {actual_crc:#010x} expected {expected_crc:#010x}")
            all_pass = False
    
    return all_pass
```

---

## Recommended approach

**Start with Path 2 (fresh Python implementation)** using the detailed format specification from the 82-Kompresovan modul report (§3). Benefits:

1. **Format clarity:** Your report's §3.2 block structure is comprehensive
2. **Debuggability:** Python + print statements beats stepping through ARM code
3. **Reusability:** Can later convert to C/Rust without format rework
4. **Learning:** Deep understanding of LHA4K for future firmware analysis

As reference while coding: disassemble `section1_decompressor.bin` in Ghidra to spot patterns (e.g., where Huffman tables are built, match copying logic). Use it as a correctness oracle, not implementation source.

---

## Next steps

1. **Set up bit-stream reader** — handle MSB-first bit extraction from byte array
2. **Implement Huffman decoder** — build trees from code lengths, decode symbols
3. **Parse 16-symbol WD pretree** — decode compressed representation of Huffman tables
4. **Build LZSS decompressor** — literal + match copying with 4 KB dictionary
5. **Block loop** — iterate until EOF, validating against Section files

Each step can be tested independently before moving to the next.

---

## References

- **Format spec:** Section 3 of 02-82-Kompresovan_modul.md
- **Validation targets:** Section0.bin through Section4.bin (md5, crc in reports)
- **Firmware decompressor reference:** BMGR Section 1 @ 0x25F4 in 80-Bootmanager.bin
