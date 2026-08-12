/**
 * Field-level encryption for secrets at rest (AES-256-GCM).
 *
 * Used to encrypt high-value columns — OAuth access/refresh tokens, integration
 * credentials, synced browser cookies — so a read-only database compromise does
 * not yield live third-party access. Columns stay `@db.Text`; we store an
 * opaque string, not raw bytes.
 *
 * Format: `v1:<iv_b64>:<tag_b64>:<ciphertext_b64>`. The `v1` version prefix
 * leaves room for key rotation / a future KMS-backed envelope scheme without a
 * data migration.
 *
 * Key: FIELD_ENCRYPTION_KEY, a 32-byte key encoded as base64 or hex. Generate
 * one with:  openssl rand -base64 32
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const VERSION = 'v1';
const ALGO = 'aes-256-gcm';
const IV_BYTES = 12; // GCM standard nonce length

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'FIELD_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32`.'
    );
  }

  // Accept base64 or hex; both must decode to exactly 32 bytes.
  let key = tryDecode(raw, 'base64');
  if (key.length !== 32) key = tryDecode(raw, 'hex');
  if (key.length !== 32) {
    throw new Error(
      `FIELD_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}). Use \`openssl rand -base64 32\`.`
    );
  }

  cachedKey = key;
  return key;
}

function tryDecode(value: string, encoding: 'base64' | 'hex'): Buffer {
  try {
    return Buffer.from(value, encoding);
  } catch {
    return Buffer.alloc(0);
  }
}

/** True if `value` is something encryptField produced (so callers can migrate lazily). */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(`${VERSION}:`);
}

/** Encrypt a UTF-8 string. Returns the opaque `v1:iv:tag:ct` envelope. */
export function encryptField(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

/**
 * Decrypt a value produced by encryptField. If the value is not in envelope
 * format it is returned unchanged — this lets code read rows that predate
 * encryption and upgrade them lazily on next write.
 */
export function decryptField(value: string): string {
  if (!isEncrypted(value)) return value;

  const parts = value.split(':');
  if (parts.length !== 4) {
    throw new Error('Malformed encrypted field: expected v1:iv:tag:ciphertext');
  }
  const [, ivB64, tagB64, ctB64] = parts;

  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64')),
    decipher.final(),
  ]);
  return pt.toString('utf8');
}

/** Convenience: encrypt only when non-empty, pass through null/empty. */
export function encryptNullable(value: string | null | undefined): string | null {
  return value ? encryptField(value) : null;
}

/** Convenience: decrypt only when non-empty, pass through null/empty. */
export function decryptNullable(value: string | null | undefined): string | null {
  return value ? decryptField(value) : null;
}
