/**
 * Encrypted persistence for a suspended sandbox's filesystem.
 *
 * Vercel Sandbox has no live suspend/resume: "suspend" tars the workdir and
 * destroys the VM, "resume" boots a fresh VM and untars it back in. The
 * archive necessarily leaves the VM boundary, so it is encrypted with a key
 * derived per-workspace before it ever reaches Blob storage — satisfying the
 * "no shared storage without per-org encryption scoping" requirement even
 * though Blob's own access control (private, unguessable URL) is also in
 * effect as a second layer.
 *
 * Key derivation is HKDF from a single server-side master secret plus the
 * workspace id, so no per-workspace secret needs to be generated, stored, or
 * rotated separately — rotating SANDBOX_STATE_MASTER_KEY invalidates every
 * archive at once (next resume just gets a fresh empty sandbox instead of a
 * restored one, never a decryption of the wrong workspace's data).
 */

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { put, get, del } from '@vercel/blob';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

export interface EncryptedArchive {
  encrypted: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

function masterKey(): Buffer {
  const secret = process.env.SANDBOX_STATE_MASTER_KEY;
  if (!secret) {
    throw new Error(
      'SANDBOX_STATE_MASTER_KEY is not configured. Generate one with `openssl rand -base64 32`. ' +
        'Without it, sandbox state cannot be safely persisted — suspend must be treated as destroy.'
    );
  }
  return Buffer.from(secret, 'base64');
}

/** Per-workspace key so a leaked archive from one workspace is useless for decrypting another's. */
function deriveWorkspaceKey(workspaceId: string): Buffer {
  const derived = hkdfSync(
    'sha256',
    masterKey(),
    Buffer.alloc(0),
    Buffer.from(`sandbox-state:${workspaceId}`),
    32
  );
  return Buffer.from(derived);
}

export function isStatePersistenceConfigured(): boolean {
  return Boolean(process.env.SANDBOX_STATE_MASTER_KEY) && Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function encryptArchive(workspaceId: string, plaintext: Buffer): EncryptedArchive {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, deriveWorkspaceKey(workspaceId), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { encrypted, iv, authTag: cipher.getAuthTag() };
}

export function decryptArchive(workspaceId: string, archive: EncryptedArchive): Buffer {
  const decipher = createDecipheriv(ALGORITHM, deriveWorkspaceKey(workspaceId), archive.iv);
  decipher.setAuthTag(archive.authTag);
  return Buffer.concat([decipher.update(archive.encrypted), decipher.final()]);
}

function blobPathname(workspaceId: string): string {
  // One archive per workspace, deliberately overwritten each suspend — this
  // is working sandbox state, not a version history, so retaining prior
  // versions would just be unbounded storage growth with no product value.
  return `sandbox-state/${workspaceId}/workdir.tar.gz.enc`;
}

/**
 * Encrypt and upload. Private access — this is tenant filesystem contents,
 * never suitable for the public/unguessable-URL pattern used for generated
 * media in lib/storage.ts.
 */
export async function persistWorkspaceState(workspaceId: string, plaintext: Buffer): Promise<string> {
  const { encrypted, iv, authTag } = encryptArchive(workspaceId, plaintext);

  // IV and authTag are short and required to decrypt; prepending them to the
  // ciphertext keeps this to one Blob object instead of three.
  const payload = Buffer.concat([iv, authTag, encrypted]);

  const blob = await put(blobPathname(workspaceId), payload, {
    access: 'private',
    contentType: 'application/octet-stream',
  });

  return blob.url;
}

/** Returns null if no archive exists yet (fresh workspace, never suspended before). */
export async function restoreWorkspaceState(workspaceId: string, blobUrl: string): Promise<Buffer | null> {
  // get() resolves null on 404 — "never persisted" is a normal case here,
  // not a restore failure.
  const result = await get(blobUrl, { access: 'private' });
  if (!result || result.statusCode !== 200) return null;

  const chunks: Uint8Array[] = [];
  const reader = result.stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const payload = Buffer.concat(chunks);

  const iv = payload.subarray(0, IV_BYTES);
  const authTag = payload.subarray(IV_BYTES, IV_BYTES + 16);
  const encrypted = payload.subarray(IV_BYTES + 16);

  return decryptArchive(workspaceId, { encrypted, iv, authTag });
}

export async function deleteWorkspaceState(blobUrl: string): Promise<void> {
  await del(blobUrl).catch(() => {
    // Best effort: a leaked archive costs storage, not correctness or
    // security (still encrypted, still workspace-scoped), so a delete
    // failure must not fail the destroy it's cleaning up after.
  });
}
