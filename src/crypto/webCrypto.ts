/**
 * WebCrypto Cryptographic Services
 * Uses standard browser WebCrypto API: PBKDF2-SHA256 (310,000 iterations),
 * AES-256-GCM, SHA-256 hashing, and HMAC-SHA256 signatures.
 */

const PBKDF2_ITERATIONS = 310000;

export function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBuffer(hex: string): Uint8Array {
  const match = hex.match(/.{1,2}/g);
  if (!match) return new Uint8Array();
  return new Uint8Array(match.map((byte) => parseInt(byte, 16)));
}

export function generateRandomSalt(length = 16): string {
  const salt = new Uint8Array(length);
  crypto.getRandomValues(salt);
  return bufferToHex(salt);
}

/**
 * Hash password or string using PBKDF2-SHA256 with 310,000 iterations
 */
export async function hashPasswordWithSalt(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const saltBytes = hexToBuffer(saltHex);
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return bufferToHex(derivedBits);
}

/**
 * Compute SHA-256 hash of text or binary
 */
export async function sha256(data: string | BufferSource): Promise<string> {
  const enc = new TextEncoder();
  const buffer = typeof data === 'string' ? enc.encode(data) : data;
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer as unknown as BufferSource);
  return bufferToHex(hashBuffer);
}

/**
 * Generate HMAC-SHA256 signature for receipt verification
 */
export async function generateHmac(secretKey: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return bufferToHex(signature);
}

/**
 * Verify HMAC-SHA256 signature
 */
export async function verifyHmac(secretKey: string, message: string, signatureHex: string): Promise<boolean> {
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secretKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBuffer = hexToBuffer(signatureHex);
    return await crypto.subtle.verify('HMAC', key, sigBuffer as unknown as BufferSource, enc.encode(message));
  } catch {
    return false;
  }
}

/**
 * Derive AES-256-GCM key from passphrase and salt
 */
async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt JSON payload using AES-256-GCM.
 * Output format:
 * JSON header containing: { version: 1, saltHex, ivHex }
 * Followed by ciphertext in hex or Uint8Array.
 */
export interface EncryptedPackage {
  format: 'JPL_ENCRYPTED_V1';
  salt: string;
  iv: string;
  ciphertext: string;
  checksum_sha256: string;
}

export async function encryptData(data: string, passphrase: string): Promise<EncryptedPackage> {
  const enc = new TextEncoder();
  const plainBytes = enc.encode(data);
  const checksum = await sha256(plainBytes);

  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  const key = await deriveAesKey(passphrase, salt);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    key,
    plainBytes as unknown as BufferSource
  );

  return {
    format: 'JPL_ENCRYPTED_V1',
    salt: bufferToHex(salt),
    iv: bufferToHex(iv),
    ciphertext: bufferToHex(ciphertextBuffer),
    checksum_sha256: checksum,
  };
}

/**
 * Decrypt AES-256-GCM package
 */
export async function decryptData(pkg: EncryptedPackage, passphrase: string): Promise<string> {
  if (pkg.format !== 'JPL_ENCRYPTED_V1') {
    throw new Error('Format fail disulitkan tidak serasi.');
  }

  const salt = hexToBuffer(pkg.salt);
  const iv = hexToBuffer(pkg.iv);
  const ciphertext = hexToBuffer(pkg.ciphertext);

  const key = await deriveAesKey(passphrase, salt);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    key,
    ciphertext as unknown as BufferSource
  );

  const dec = new TextDecoder();
  const plainText = dec.decode(decryptedBuffer);

  // Verify SHA-256 checksum
  const verifiedChecksum = await sha256(new Uint8Array(decryptedBuffer) as unknown as BufferSource);
  if (verifiedChecksum !== pkg.checksum_sha256) {
    throw new Error('Integriti data gagal: Checksum SHA-256 tidak sepadan.');
  }

  return plainText;
}

/**
 * Calculate row hash for hash-chained audit log
 * row_hash = SHA-256(fields + prev_hash)
 */
export async function calculateAuditRowHash(row: {
  audit_id: string;
  user_id: string;
  username: string;
  role: string;
  tindakan: string;
  modul: string;
  record_id: string | null;
  nilai_lama: string | null;
  nilai_baharu: string | null;
  sebab: string | null;
  timestamp: string;
  prev_hash: string;
}): Promise<string> {
  const content = [
    row.audit_id,
    row.user_id,
    row.username,
    row.role,
    row.tindakan,
    row.modul,
    row.record_id || '',
    row.nilai_lama || '',
    row.nilai_baharu || '',
    row.sebab || '',
    row.timestamp,
    row.prev_hash,
  ].join('|');

  return sha256(content);
}
