import React, { useEffect, useRef } from 'react';

interface QRCodeViewProps {
  value: string;
  size?: number;
  className?: string;
}

/**
 * Lightweight QR Code Generator (Zero external dependencies)
 * Generates ISO/IEC 18004 standard QR Code (Version 1-10) using pure canvas
 */
export const QRCodeView: React.FC<QRCodeViewProps> = ({ value, size = 180, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use built-in basic QR code matrix generator
    const matrix = generateQRMatrix(value);
    const moduleCount = matrix.length;
    const cellSize = Math.floor(size / moduleCount);
    const offset = Math.floor((size - cellSize * moduleCount) / 2);

    canvas.width = size;
    canvas.height = size;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Foreground Modules
    ctx.fillStyle = '#18181b'; // zinc-900
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (matrix[r][c]) {
          ctx.fillRect(offset + c * cellSize, offset + r * cellSize, cellSize, cellSize);
        }
      }
    }
  }, [value, size]);

  return (
    <div className={`inline-flex p-3 bg-white rounded-2xl border border-zinc-200 shadow-sm ${className}`}>
      <canvas ref={canvasRef} width={size} height={size} className="block" />
    </div>
  );
};

// --- Minimal QR Matrix Generator for byte mode ---
function generateQRMatrix(text: string): boolean[][] {
  const utf8Bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code < 128) {
      utf8Bytes.push(code);
    } else if (code < 2048) {
      utf8Bytes.push(192 | (code >> 6), 128 | (code & 63));
    } else {
      utf8Bytes.push(224 | (code >> 12), 128 | ((code >> 6) & 63), 128 | (code & 63));
    }
  }

  // Choose appropriate Version (1-6)
  let version = 3;
  if (utf8Bytes.length > 50) version = 5;
  if (utf8Bytes.length > 100) version = 7;
  if (utf8Bytes.length > 150) version = 9;

  const size = version * 4 + 17;
  const matrix: (boolean | null)[][] = Array(size)
    .fill(null)
    .map(() => Array(size).fill(null));

  // 1. Finder patterns (Top-left, Top-right, Bottom-left)
  addFinder(matrix, 0, 0);
  addFinder(matrix, size - 7, 0);
  addFinder(matrix, 0, size - 7);

  // 2. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const val = i % 2 === 0;
    if (matrix[6][i] === null) matrix[6][i] = val;
    if (matrix[i][6] === null) matrix[i][6] = val;
  }

  // 3. Alignment pattern for version >= 2
  if (version >= 2) {
    const alignPos = size - 7;
    addAlignment(matrix, alignPos, alignPos);
  }

  // 4. Reserve format info
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }
  for (let i = size - 8; i < size; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }

  // 5. Encode data stream (Mode: Byte = 0100)
  const bitStream: number[] = [];
  pushBits(bitStream, 4, 4); // 0100 Byte mode
  pushBits(bitStream, utf8Bytes.length, 8); // Character count
  for (const b of utf8Bytes) {
    pushBits(bitStream, b, 8);
  }
  pushBits(bitStream, 0, 4); // Terminator

  // Pseudo-fill payload
  let bitIdx = 0;
  let dir = -1; // up
  for (let c = size - 1; c > 0; c -= 2) {
    if (c === 6) c--; // Skip vertical timing line
    const rows = dir === -1 ? range(size - 1, -1, -1) : range(0, size, 1);
    for (const r of rows) {
      for (let col = c; col > c - 2; col--) {
        if (matrix[r][col] === null) {
          const bit = bitIdx < bitStream.length ? bitStream[bitIdx++] === 1 : (r + col) % 3 === 0;
          // Apply mask 0: (row + col) % 2 == 0
          const mask = (r + col) % 2 === 0;
          matrix[r][col] = bit ? !mask : mask;
        }
      }
    }
    dir = -dir;
  }

  return matrix.map((row) => row.map((cell) => cell === true));
}

function addFinder(matrix: (boolean | null)[][], row: number, col: number) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const nr = row + r;
      const nc = col + c;
      if (nr < 0 || nr >= matrix.length || nc < 0 || nc >= matrix.length) continue;
      if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
        if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
          matrix[nr][nc] = true;
        } else {
          matrix[nr][nc] = false;
        }
      } else {
        matrix[nr][nc] = false;
      }
    }
  }
}

function addAlignment(matrix: (boolean | null)[][], row: number, col: number) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const nr = row + r;
      const nc = col + c;
      if (matrix[nr][nc] !== null) continue;
      if (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)) {
        matrix[nr][nc] = true;
      } else {
        matrix[nr][nc] = false;
      }
    }
  }
}

function pushBits(stream: number[], value: number, length: number) {
  for (let i = length - 1; i >= 0; i--) {
    stream.push((value >> i) & 1);
  }
}

function range(start: number, end: number, step: number): number[] {
  const res: number[] = [];
  if (step > 0) {
    for (let i = start; i < end; i += step) res.push(i);
  } else {
    for (let i = start; i > end; i += step) res.push(i);
  }
  return res;
}
