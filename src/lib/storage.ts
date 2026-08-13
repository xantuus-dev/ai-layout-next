/**
 * Media Storage with Graceful Degradation
 *
 * Generated media (images, documents, audio, video) is uploaded to Vercel Blob
 * and referenced by URL. When BLOB_READ_WRITE_TOKEN is absent — local dev, or
 * before the store is provisioned — this falls back to a base64 data URI so
 * callers keep working, mirroring the Redis degradation in lib/queue/redis.ts.
 *
 * The data-URI fallback is NOT viable for anything large: it inflates bytes by
 * ~33% and lands in a Postgres TEXT column. It exists so image generation does
 * not hard-fail without a store, not as a supported production path. Anything
 * above FALLBACK_MAX_BYTES refuses to degrade rather than writing a multi-MB
 * row — video and audio must have Blob configured.
 */

import { put } from '@vercel/blob';

/** Data URIs above this size are refused rather than written to the database. */
const FALLBACK_MAX_BYTES = 2 * 1024 * 1024; // 2MB

export type MediaKind = 'image' | 'document' | 'audio' | 'video';

export interface UploadResult {
  url: string;
  /** false when the data-URI fallback was used, so callers can warn. */
  persisted: boolean;
  bytes: number;
}

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Build a collision-free object key. Blob keeps the caller's pathname, so
 * scoping by user and kind keeps the store browsable and makes per-user
 * cleanup a prefix listing rather than a full scan.
 */
function buildPathname(kind: MediaKind, userId: string, extension: string): string {
  const stamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `${kind}s/${userId}/${stamp}-${random}.${extension.replace(/^\./, '')}`;
}

/**
 * Upload generated media and return a URL suitable for storing on a model row.
 *
 * `access: 'public'` is deliberate: these are served straight into gallery and
 * chat UIs, and Vercel's private access is documented as slow-delivery/high-egress
 * for publicly served files. URLs carry a random suffix, so they are unguessable.
 */
export async function uploadMedia(
  data: Buffer | Uint8Array | string,
  options: {
    kind: MediaKind;
    userId: string;
    extension: string;
    contentType: string;
    /** Treat a string payload as base64 rather than utf-8 text. */
    base64?: boolean;
  }
): Promise<UploadResult> {
  const { kind, userId, extension, contentType, base64 } = options;

  const buffer =
    typeof data === 'string'
      ? Buffer.from(data, base64 ? 'base64' : 'utf-8')
      : Buffer.from(data);

  if (isBlobConfigured()) {
    const blob = await put(buildPathname(kind, userId, extension), buffer, {
      access: 'public',
      contentType,
    });
    return { url: blob.url, persisted: true, bytes: buffer.byteLength };
  }

  if (buffer.byteLength > FALLBACK_MAX_BYTES) {
    throw new Error(
      `Cannot store ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB of ${kind} data: ` +
        'BLOB_READ_WRITE_TOKEN is not configured and the data-URI fallback is capped at 2MB. ' +
        'Provision a Vercel Blob store (vercel blob add) and set the token.'
    );
  }

  console.warn(
    `[storage] BLOB_READ_WRITE_TOKEN not set — returning a data URI for ${kind}. ` +
      'This is a development fallback and should not be relied on in production.'
  );

  return {
    url: `data:${contentType};base64,${buffer.toString('base64')}`,
    persisted: false,
    bytes: buffer.byteLength,
  };
}
