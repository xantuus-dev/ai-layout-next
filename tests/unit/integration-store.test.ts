import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Store the original key so tests can toggle graceful behavior without leaking.
const ORIGINAL_KEY = process.env.FIELD_ENCRYPTION_KEY;

beforeAll(() => {
  process.env.FIELD_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
});
afterAll(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
  else process.env.FIELD_ENCRYPTION_KEY = ORIGINAL_KEY;
});

const { encryptIntegrationSecrets, decryptIntegration } = await import(
  '@/lib/integrations/store'
);
const { isEncrypted } = await import('@/lib/crypto/envelope');

describe('integration store — secret encryption', () => {
  it('encrypts only the secret fields and round-trips them back', () => {
    const input = {
      provider: 'slack',
      name: 'Slack - Acme',
      accessToken: 'xoxb-real-bot-token',
      refreshToken: 'xoxe-refresh',
      apiKey: 'sk-key',
      config: { teamId: 'T123' },
      scopes: ['chat:write'],
    };

    const enc = encryptIntegrationSecrets(input);

    // Secrets enciphered...
    expect(isEncrypted(enc.accessToken)).toBe(true);
    expect(isEncrypted(enc.refreshToken)).toBe(true);
    expect(isEncrypted(enc.apiKey)).toBe(true);
    expect(enc.accessToken).not.toContain('xoxb-real-bot-token');
    // ...non-secret fields untouched.
    expect(enc.provider).toBe('slack');
    expect(enc.config).toEqual({ teamId: 'T123' });

    const dec = decryptIntegration(enc);
    expect(dec.accessToken).toBe('xoxb-real-bot-token');
    expect(dec.refreshToken).toBe('xoxe-refresh');
    expect(dec.apiKey).toBe('sk-key');
  });

  it('leaves null/absent secret fields alone', () => {
    const enc = encryptIntegrationSecrets({ provider: 'telegram', accessToken: 'botT', refreshToken: null });
    expect(isEncrypted(enc.accessToken)).toBe(true);
    expect(enc.refreshToken).toBeNull();
    expect('apiKey' in enc).toBe(false);
  });

  it('decrypt passes plaintext (pre-encryption rows) through unchanged', () => {
    const dec = decryptIntegration({ accessToken: 'legacy-plaintext', provider: 'slack' });
    expect(dec.accessToken).toBe('legacy-plaintext');
  });

  it('decryptIntegration tolerates null rows', () => {
    expect(decryptIntegration(null)).toBeNull();
    expect(decryptIntegration(undefined)).toBeUndefined();
  });
});

describe('integration store — graceful (no key configured)', () => {
  it('passes secrets through as plaintext when encryption is not configured', () => {
    // isEncryptionConfigured() reads env live per call, so simply unsetting the
    // key makes encryption a no-op — no module re-import needed.
    delete process.env.FIELD_ENCRYPTION_KEY;
    try {
      const enc = encryptIntegrationSecrets({ accessToken: 'plain-token', provider: 'x' });
      expect(enc.accessToken).toBe('plain-token');
      expect(isEncrypted(enc.accessToken)).toBe(false);
    } finally {
      process.env.FIELD_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
    }
  });
});
