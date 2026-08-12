import { describe, it, expect, beforeAll } from 'vitest';

// A fixed 32-byte test key (base64). The module reads FIELD_ENCRYPTION_KEY
// lazily, so setting it before importing is sufficient.
beforeAll(() => {
  process.env.FIELD_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
});

const {
  encryptField,
  decryptField,
  isEncrypted,
  encryptNullable,
  decryptNullable,
} = await import('@/lib/crypto/envelope');

describe('envelope encryption', () => {
  it('round-trips a value through encrypt/decrypt', () => {
    const secret = 'ya29.a0AfB_secret-google-token';
    const enc = encryptField(secret);
    expect(enc).not.toContain(secret);
    expect(isEncrypted(enc)).toBe(true);
    expect(decryptField(enc)).toBe(secret);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const a = encryptField('same');
    const b = encryptField('same');
    expect(a).not.toBe(b);
    expect(decryptField(a)).toBe('same');
    expect(decryptField(b)).toBe('same');
  });

  it('passes plaintext through decrypt unchanged (lazy migration of old rows)', () => {
    expect(decryptField('legacy-plaintext-token')).toBe('legacy-plaintext-token');
    expect(isEncrypted('legacy-plaintext-token')).toBe(false);
  });

  it('fails to decrypt if the ciphertext is tampered with', () => {
    const enc = encryptField('tamper-me');
    // Flip a character in the ciphertext segment -> GCM auth tag check fails.
    const parts = enc.split(':');
    parts[3] = parts[3].slice(0, -2) + (parts[3].slice(-2) === 'AA' ? 'BB' : 'AA');
    expect(() => decryptField(parts.join(':'))).toThrow();
  });

  it('handles nullable helpers', () => {
    expect(encryptNullable(null)).toBeNull();
    expect(encryptNullable('')).toBeNull();
    expect(decryptNullable(null)).toBeNull();
    const enc = encryptNullable('x');
    expect(decryptNullable(enc)).toBe('x');
  });
});
