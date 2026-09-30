/**
 * Pure TypeScript TOTP (Time-based One-Time Password - RFC 6238 / RFC 4226)
 * Uses Web Crypto API (crypto.subtle) for HMAC-SHA1
 */

// Base32 charset
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Generate a random Base32 secret string (16 or 32 chars)
 */
export function generateBase32Secret(length = 16): string {
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  let secret = '';
  for (let i = 0; i < length; i++) {
    secret += BASE32_CHARS[randomBytes[i] % 32];
  }
  return secret;
}

/**
 * Decode Base32 string to Uint8Array
 */
export function base32ToUint8Array(base32: string): Uint8Array {
  const cleanBase32 = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < cleanBase32.length; i++) {
    const val = BASE32_CHARS.indexOf(cleanBase32[i]);
    if (val === -1) continue;
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

/**
 * Generate 6-digit TOTP code for a given secret at given timestamp (default: now)
 */
export async function generateTOTPCode(secretBase32: string, timestampMs = Date.now(), timeStepSec = 30): Promise<string> {
  const keyBytes = base32ToUint8Array(secretBase32);
  const counter = Math.floor(timestampMs / 1000 / timeStepSec);

  // Convert counter to 8-byte big-endian buffer
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  counterView.setUint32(0, 0, false);
  counterView.setUint32(4, counter, false);

  // Import key for HMAC-SHA1
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    { name: 'HMAC', hash: { name: 'SHA-1' } },
    false,
    ['sign']
  );

  // Sign counter
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);
  const hmacResult = new Uint8Array(signature);

  // Dynamic truncation
  const offset = hmacResult[hmacResult.length - 1] & 0x0f;
  const code =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  const otp = (code % 1000000).toString().padStart(6, '0');
  return otp;
}

/**
 * Verify user-input TOTP code against secret (supports ±1 time window drift)
 */
export async function verifyTOTPCode(inputCode: string, secretBase32: string, timeStepSec = 30): Promise<boolean> {
  const cleanCode = inputCode.trim().replace(/\s+/g, '');
  if (!cleanCode || cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
    return false;
  }

  const now = Date.now();
  // Check current, previous (-30s), and next (+30s) windows to account for clock skew
  const offsets = [0, -timeStepSec * 1000, timeStepSec * 1000];

  for (const offset of offsets) {
    try {
      const expectedCode = await generateTOTPCode(secretBase32, now + offset, timeStepSec);
      if (expectedCode === cleanCode) {
        return true;
      }
    } catch {
      // Continue checking next window
    }
  }

  return false;
}

/**
 * Generate 8 unique 8-character backup recovery codes (e.g., "7K9A-4E2F")
 */
export function generateBackupRecoveryCodes(count = 8): string[] {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    let part1 = '';
    let part2 = '';
    for (let j = 0; j < 4; j++) {
      part1 += chars[bytes[j] % chars.length];
      part2 += chars[bytes[j + 4] % chars.length];
    }
    codes.push(`${part1}-${part2}`);
  }

  return codes;
}

/**
 * Generate otpauth:// URI for Authenticator apps
 */
export function generateOtpAuthUri(secret: string, accountName = 'SingleUser', issuer = '栖月账本'): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}
