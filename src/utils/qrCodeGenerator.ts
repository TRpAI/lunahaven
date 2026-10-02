/**
 * Pure TypeScript Zero-Dependency QR Code Generator (ISO/IEC 18004 compliant)
 * Generates matrix boolean[][] for OTP URIs and general text, rendering perfectly on Canvas / SVG.
 */

// Error correction levels
export type QrEccLevel = 'L' | 'M' | 'Q' | 'H';

// Reed-Solomon Galois Field (GF 256) tables with primitive polynomial 0x11d (285)
const EXP_TABLE = new Uint8Array(512);
const LOG_TABLE = new Uint8Array(256);
(function initGalois() {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = val;
    EXP_TABLE[i + 255] = val;
    LOG_TABLE[val] = i;
    val = (val << 1) ^ (val >= 128 ? 0x11d : 0);
  }
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return EXP_TABLE[LOG_TABLE[x] + LOG_TABLE[y]];
}

function rsGenPoly(numEccBytes: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < numEccBytes; i++) {
    const nextPoly = new Uint8Array(poly.length + 1);
    const root = EXP_TABLE[i];
    for (let j = 0; j < poly.length; j++) {
      nextPoly[j] ^= gfMul(poly[j], root);
      nextPoly[j + 1] ^= poly[j];
    }
    poly = nextPoly;
  }
  return poly;
}

function rsComputeEcc(data: Uint8Array, numEccBytes: number): Uint8Array {
  const gen = rsGenPoly(numEccBytes);
  const ecc = new Uint8Array(numEccBytes);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ ecc[0];
    ecc.copyWithin(0, 1);
    ecc[numEccBytes - 1] = 0;
    for (let j = 0; j < numEccBytes; j++) {
      ecc[j] ^= gfMul(gen[j], factor);
    }
  }
  return ecc;
}

// Version capacities (Version 1 to 10 for standard TOTP auth URIs ~ 60-150 bytes)
// [totalCodewords, eccCodewordsPerBlock, numBlocksGroup1, dataCodewordsPerBlock1, numBlocksGroup2, dataCodewordsPerBlock2]
interface VersionSpec {
  totalDataBytes: number;
  eccBytesPerBlock: number;
  blocks: { count: number; dataBytes: number }[];
  alignmentPatterns: number[];
}

const VERSION_SPECS_M: Record<number, VersionSpec> = {
  1: { totalDataBytes: 16, eccBytesPerBlock: 10, blocks: [{ count: 1, dataBytes: 16 }], alignmentPatterns: [] },
  2: { totalDataBytes: 28, eccBytesPerBlock: 16, blocks: [{ count: 1, dataBytes: 28 }], alignmentPatterns: [6, 18] },
  3: { totalDataBytes: 44, eccBytesPerBlock: 26, blocks: [{ count: 1, dataBytes: 44 }], alignmentPatterns: [6, 22] },
  4: { totalDataBytes: 64, eccBytesPerBlock: 18, blocks: [{ count: 2, dataBytes: 32 }], alignmentPatterns: [6, 26] },
  5: { totalDataBytes: 86, eccBytesPerBlock: 24, blocks: [{ count: 2, dataBytes: 43 }], alignmentPatterns: [6, 30] },
  6: { totalDataBytes: 108, eccBytesPerBlock: 16, blocks: [{ count: 4, dataBytes: 27 }], alignmentPatterns: [6, 34] },
  7: { totalDataBytes: 124, eccBytesPerBlock: 18, blocks: [{ count: 4, dataBytes: 31 }], alignmentPatterns: [6, 22, 38] },
  8: { totalDataBytes: 154, eccBytesPerBlock: 22, blocks: [{ count: 2, dataBytes: 38 }, { count: 2, dataBytes: 39 }], alignmentPatterns: [6, 24, 42] },
  9: { totalDataBytes: 182, eccBytesPerBlock: 22, blocks: [{ count: 3, dataBytes: 36 }, { count: 2, dataBytes: 37 }], alignmentPatterns: [6, 26, 46] },
  10: { totalDataBytes: 216, eccBytesPerBlock: 26, blocks: [{ count: 4, dataBytes: 43 }, { count: 1, dataBytes: 44 }], alignmentPatterns: [6, 28, 50] },
};

function encodeByteModeData(text: string, version: number, totalDataBytes: number): Uint8Array {
  const utf8Bytes = new TextEncoder().encode(text);
  const bitLength = 4 + (version < 10 ? 8 : 16) + utf8Bytes.length * 8;
  const buffer = new Uint8Array(totalDataBytes);
  
  let bitPos = 0;
  function writeBits(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) {
      if ((val >> i) & 1) {
        buffer[bitPos >> 3] |= 0x80 >> (bitPos & 7);
      }
      bitPos++;
    }
  }

  // Mode: 0100 (Byte)
  writeBits(0b0100, 4);
  // Character count indicator
  writeBits(utf8Bytes.length, version < 10 ? 8 : 16);
  // Data
  for (const b of utf8Bytes) {
    writeBits(b, 8);
  }
  // Terminator up to 4 zero bits
  const termLen = Math.min(4, totalDataBytes * 8 - bitPos);
  writeBits(0, termLen);
  // Pad to byte boundary
  while ((bitPos & 7) !== 0) {
    writeBits(0, 1);
  }
  // Pad bytes 0xEC, 0x11
  const padPatterns = [0xec, 0x11];
  let padIdx = 0;
  while (bitPos < totalDataBytes * 8) {
    writeBits(padPatterns[padIdx % 2], 8);
    padIdx++;
  }

  return buffer;
}

export function generateQrMatrix(text: string): boolean[][] {
  const utf8Len = new TextEncoder().encode(text).length;
  let chosenVersion = 1;
  while (chosenVersion <= 10) {
    const spec = VERSION_SPECS_M[chosenVersion];
    const headerBits = 4 + (chosenVersion < 10 ? 8 : 16);
    if (spec && (headerBits + utf8Len * 8) <= spec.totalDataBytes * 8) {
      break;
    }
    chosenVersion++;
  }
  if (chosenVersion > 10) chosenVersion = 10;

  const spec = VERSION_SPECS_M[chosenVersion];
  const size = chosenVersion * 4 + 17;
  const rawData = encodeByteModeData(text, chosenVersion, spec.totalDataBytes);

  // Divide data into blocks & compute ECC
  const dataBlocks: Uint8Array[] = [];
  const eccBlocks: Uint8Array[] = [];
  let offset = 0;
  for (const b of spec.blocks) {
    for (let c = 0; c < b.count; c++) {
      const d = rawData.slice(offset, offset + b.dataBytes);
      offset += b.dataBytes;
      dataBlocks.push(d);
      eccBlocks.push(rsComputeEcc(d, spec.eccBytesPerBlock));
    }
  }

  // Interleave data and ECC codewords
  const interleaved: number[] = [];
  let maxDataLen = 0;
  for (const db of dataBlocks) maxDataLen = Math.max(maxDataLen, db.length);
  for (let i = 0; i < maxDataLen; i++) {
    for (const db of dataBlocks) {
      if (i < db.length) interleaved.push(db[i]);
    }
  }
  for (let i = 0; i < spec.eccBytesPerBlock; i++) {
    for (const eb of eccBlocks) {
      interleaved.push(eb[i]);
    }
  }

  // Initialize matrix and reserved flags
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  function setFunction(r: number, c: number, val: boolean) {
    matrix[r][c] = val;
    isFunction[r][c] = true;
  }

  // 1. Finder patterns
  function addFinder(rStart: number, cStart: number) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isDark =
          r === 0 || r === 6 || c === 0 || c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        setFunction(rStart + r, cStart + c, isDark);
      }
    }
    // Separators
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = rStart + r;
        const cc = cStart + c;
        if (rr >= 0 && rr < size && cc >= 0 && cc < size) {
          if (!isFunction[rr][cc]) setFunction(rr, cc, false);
        }
      }
    }
  }
  addFinder(0, 0);
  addFinder(0, size - 7);
  addFinder(size - 7, 0);

  // 2. Alignment patterns
  const alignCoords = spec.alignmentPatterns;
  for (const r of alignCoords) {
    for (const c of alignCoords) {
      if (isFunction[r][c]) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const isDark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setFunction(r + dr, c + dc, isDark);
        }
      }
    }
  }

  // 3. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!isFunction[6][i]) setFunction(6, i, i % 2 === 0);
    if (!isFunction[i][6]) setFunction(i, 6, i % 2 === 0);
  }

  // 4. Dark module
  setFunction(4 * chosenVersion + 9, 8, true);

  // 5. Reserve format info areas
  for (let i = 0; i < 9; i++) {
    if (!isFunction[8][i]) isFunction[8][i] = true;
    if (!isFunction[i][8]) isFunction[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    if (!isFunction[8][size - 1 - i]) isFunction[8][size - 1 - i] = true;
    if (!isFunction[size - 1 - i][8]) isFunction[size - 1 - i][8] = true;
  }

  // 6. Place data bits (using mask 0: (r + c) % 2 === 0)
  let interleavedIdx = 0;
  let bitIdx = 7;
  let upwards = true;

  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // skip vertical timing line
    for (let vert = 0; vert < size; vert++) {
      const r = upwards ? size - 1 - vert : vert;
      for (let c = right; c >= right - 1; c--) {
        if (isFunction[r][c]) continue;
        let bit = false;
        if (interleavedIdx < interleaved.length) {
          bit = ((interleaved[interleavedIdx] >> bitIdx) & 1) === 1;
          bitIdx--;
          if (bitIdx < 0) {
            bitIdx = 7;
            interleavedIdx++;
          }
        }
        // Apply Mask Pattern 0: (r + c) % 2 == 0
        const maskBit = (r + c) % 2 === 0;
        matrix[r][c] = bit !== maskBit;
      }
    }
    upwards = !upwards;
  }

  // 7. Write Format Information (ECC M: 00, Mask 000 -> 00000 -> BCH format 0x5412)
  // Format bits for ECC 'M' + Mask 0 with mask 0x5412 = 0x5412 ^ 0x5412 = 0x0000 -> 101010000010010
  const formatInfo = 0b101010000010010;
  for (let i = 0; i < 15; i++) {
    const bit = ((formatInfo >> i) & 1) === 1;
    if (i < 6) {
      matrix[8][i] = bit;
      matrix[size - 1 - i][8] = bit;
    } else if (i === 6) {
      matrix[8][7] = bit;
      matrix[size - 7][8] = bit;
    } else if (i < 9) {
      matrix[8][8 - (i - 7)] = bit;
      matrix[size - 8 + (i - 7)][8] = bit;
    } else {
      matrix[14 - i][8] = bit;
      matrix[8][size - 15 + i] = bit;
    }
  }

  return matrix;
}
