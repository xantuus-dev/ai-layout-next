/**
 * Attachment helpers shared by the chat input and the routes that persist
 * uploads.
 *
 * These exist because the upload path had three separate faults that only
 * showed up as a Prisma error at the very end:
 *
 *   - the chat input emitted `{ id, file, type, preview }`, while the route
 *     read `file.name` / `file.size` / `file.data` — the real name and size
 *     live on the nested File, and `data` was never produced at all;
 *   - the file was never read, so no base64 ever existed ("Simulate Upload");
 *   - the type was forced to the literal 'image/unknown', which is not a MIME
 *     type any model accepts.
 *
 * Everything here is pure so the rules can be tested without a browser.
 */

/** Image types the Anthropic messages API accepts as base64 image blocks. */
export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

/** Extensions worth trusting when a browser reports no or a wrong MIME type. */
const EXTENSION_TO_MIME: Record<string, SupportedImageType> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

export function isSupportedImageType(type: string | undefined | null): type is SupportedImageType {
  return !!type && (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(type);
}

/**
 * Decide the MIME type to send for a file, or null when it is not an image the
 * API can accept.
 *
 * Prefers the browser's own type, falling back to the extension — some systems
 * report an empty type for a perfectly good PNG. Returns null rather than a
 * placeholder: 'image/unknown' was rejected by the API, and an SVG or a PDF
 * must not be smuggled through as an image block.
 * Exported for testing.
 */
export function resolveImageMimeType(
  fileName: string | undefined,
  reportedType: string | undefined
): SupportedImageType | null {
  if (isSupportedImageType(reportedType)) return reportedType;

  const extension = (fileName ?? '').split('.').pop()?.toLowerCase();
  if (!extension) return null;

  return EXTENSION_TO_MIME[extension] ?? null;
}

/**
 * Strip the `data:<mime>;base64,` prefix a FileReader data URL carries.
 *
 * The API wants raw base64. Passing the whole data URL through fails
 * validation in a way that reads like a corrupt image rather than a format
 * mistake. Safe on input that has no prefix.
 * Exported for testing.
 */
export function stripDataUrlPrefix(dataUrl: string): string {
  const marker = ';base64,';
  const index = dataUrl.indexOf(marker);
  return index === -1 ? dataUrl : dataUrl.slice(index + marker.length);
}

/** The normalized shape both the persistence and model-content paths expect. */
export interface NormalizedAttachment {
  name: string;
  type: string;
  size: number;
  /** Raw base64, no data URL prefix. Absent when the file could not be read. */
  data?: string;
}

/**
 * Coerce whatever the client sent into something safe to persist.
 *
 * Tolerates both the flat shape and the older nested `{ file: File }` shape, so
 * an older client cannot produce a row with a missing fileName again. Returns
 * null when there is no usable name, which is better than writing a broken row.
 * Exported for testing.
 */
export function normalizeAttachment(input: any): NormalizedAttachment | null {
  if (!input || typeof input !== 'object') return null;

  const name = input.name ?? input.fileName ?? input.file?.name;
  if (typeof name !== 'string' || name.trim() === '') return null;

  const size = Number(input.size ?? input.fileSize ?? input.file?.size ?? 0);
  const rawData = input.data ?? input.fileData;

  return {
    name,
    type:
      resolveImageMimeType(name, input.type ?? input.fileType ?? input.file?.type) ??
      (typeof input.type === 'string' && input.type !== 'image/unknown'
        ? input.type
        : 'application/octet-stream'),
    size: Number.isFinite(size) && size >= 0 ? size : 0,
    data: typeof rawData === 'string' && rawData.length > 0 ? stripDataUrlPrefix(rawData) : undefined,
  };
}
