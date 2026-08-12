/**
 * API key generation and hashing.
 *
 * Keys are high-entropy random tokens, so they are stored only as a plain
 * SHA-256 hash (no per-key salt needed — there is nothing to brute-force) and
 * the raw value is shown to the user exactly once at creation. Auth looks the
 * key up by hash; the plaintext is never persisted.
 */

import crypto from 'crypto';

export const API_KEY_PREFIX = 'xan_';

/** Generate a new raw API key. Returned to the user once, never stored raw. */
export function generateApiKey(): string {
  return `${API_KEY_PREFIX}${crypto.randomBytes(32).toString('hex')}`;
}

/** Deterministic lookup hash for a raw key. */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey, 'utf8').digest('hex');
}

/**
 * Short, non-secret label for display (e.g. "xan_1a2b3c4d…"). Reveals only the
 * first 8 random hex chars, which is not enough to reconstruct the key.
 */
export function apiKeyPreview(rawKey: string): string {
  return `${rawKey.slice(0, API_KEY_PREFIX.length + 8)}…`;
}
