/**
 * Web Crypto API PBKDF2 Password Hashing Utility
 * Local-First Single-User Cryptographic Auth
 */

const PBKDF2_ITERATIONS = 100000;
const HASH_LENGTH_BITS = 256;

// Convert Uint8Array to Hex string
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Convert Hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.trim();
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16) || 0;
  }
  return bytes;
}

/**
 * Generate cryptographically secure random salt (32-character hex)
 */
export function generateSalt(length = 16): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

/**
 * Quick SHA-256 Hex Digest helper
 */
export async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return bytesToHex(new Uint8Array(buf));
}

/**
 * Hash password using PBKDF2-SHA256
 */
export async function hashPassword(
  password: string,
  saltHex?: string
): Promise<{ hash: string; salt: string }> {
  const salt = saltHex || generateSalt();
  const saltBytes = hexToBytes(salt);

  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes as unknown as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    HASH_LENGTH_BITS
  );

  const hash = bytesToHex(new Uint8Array(derivedBits));
  return { hash, salt };
}

/**
 * Verify input password against stored hash with universal backward compatibility
 */
export async function verifyPasswordHash(
  password: string,
  storedHash: string,
  storedSalt?: string
): Promise<{
  isValid: boolean;
  needsRehash: boolean;
  newHash?: string;
  newSalt?: string;
}> {
  if (!password || !storedHash) {
    return { isValid: false, needsRehash: false };
  }

  const trimmedPass = password.trim();

  // 1. Direct plaintext match (fallback for initial raw strings)
  if (storedHash === password || storedHash === trimmedPass) {
    const { hash: newHash, salt: newSalt } = await hashPassword(password);
    return { isValid: true, needsRehash: true, newHash, newSalt };
  }

  // 2. Default password '123456' direct bypass for recognized default representations
  const defaultKnownHashes = [
    'cWl5dWVfbWFzdGVyXzEyMzQ1Nl9hdXRoX3Yy', // btoa('qiyue_master_123456_auth_v2')
    'cWl5dWVfMTIzNDU2X3NhbHQ=',             // btoa('qiyue_123456_salt')
    'MTIzNDU2',                             // btoa('123456')
    '123456',
  ];
  if (defaultKnownHashes.includes(storedHash) && (password === '123456' || trimmedPass === '123456')) {
    const { hash: newHash, salt: newSalt } = await hashPassword('123456');
    return { isValid: true, needsRehash: true, newHash, newSalt };
  }

  // 3. PBKDF2 format with storedSalt or 64-char hex
  if (storedSalt && /^[0-9a-f]{64}$/i.test(storedHash)) {
    try {
      const { hash } = await hashPassword(password, storedSalt);
      if (hash.toLowerCase() === storedHash.toLowerCase()) {
        return { isValid: true, needsRehash: false };
      }
      // Also try trimmed password
      if (trimmedPass !== password) {
        const { hash: trimmedHash } = await hashPassword(trimmedPass, storedSalt);
        if (trimmedHash.toLowerCase() === storedHash.toLowerCase()) {
          return { isValid: true, needsRehash: false };
        }
      }
    } catch (e) {
      console.warn('PBKDF2 verification failed with storedSalt:', e);
    }
  }

  // 4. pbkdf2:iterations:salt:hash format
  if (storedHash.startsWith('pbkdf2:')) {
    const parts = storedHash.split(':');
    if (parts.length === 4) {
      const salt = parts[2];
      const targetHash = parts[3];
      const { hash } = await hashPassword(password, salt);
      if (hash.toLowerCase() === targetHash.toLowerCase()) {
        return { isValid: true, needsRehash: false };
      }
    }
  }

  // 5. Legacy Base64 formats with auto-upgrade
  const legacyStrings = [
    `qiyue_master_${password}_auth_v2`,
    `qiyue_master_${trimmedPass}_auth_v2`,
    `qiyue_${password}_salt`,
    `qiyue_${trimmedPass}_salt`,
    `qiyue_master_${password}`,
    `qiyue_auth_${password}`,
    `qiyue_pin_${password}`,
    `qiyue_lock_${password}`,
    password,
    trimmedPass,
  ];

  for (const s of legacyStrings) {
    try {
      if (storedHash === btoa(s)) {
        const { hash: newHash, salt: newSalt } = await hashPassword(password);
        return { isValid: true, needsRehash: true, newHash, newSalt };
      }
    } catch {
      // Ignore conversion errors
    }
  }

  // 6. SHA-256 raw digests check
  for (const s of legacyStrings) {
    try {
      const h = await sha256Hex(s);
      if (h.toLowerCase() === storedHash.toLowerCase()) {
        const { hash: newHash, salt: newSalt } = await hashPassword(password);
        return { isValid: true, needsRehash: true, newHash, newSalt };
      }
    } catch {
      // Ignore
    }
  }

  // 7. If storedSalt exists, try SHA-256(password + salt)
  if (storedSalt) {
    try {
      const h1 = await sha256Hex(`${password}:${storedSalt}`);
      const h2 = await sha256Hex(`${storedSalt}:${password}`);
      if (h1.toLowerCase() === storedHash.toLowerCase() || h2.toLowerCase() === storedHash.toLowerCase()) {
        const { hash: newHash, salt: newSalt } = await hashPassword(password);
        return { isValid: true, needsRehash: true, newHash, newSalt };
      }
    } catch {
      // Ignore
    }
  }

  return { isValid: false, needsRehash: false };
}
