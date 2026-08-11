import { describe, it, expect } from 'vitest';
import {
  resolveImageMimeType,
  stripDataUrlPrefix,
  normalizeAttachment,
  isSupportedImageType,
} from '@/lib/files/attachments';

describe('resolveImageMimeType', () => {
  it('keeps a supported type the browser reported', () => {
    expect(resolveImageMimeType('cat.png', 'image/png')).toBe('image/png');
    expect(resolveImageMimeType('cat.webp', 'image/webp')).toBe('image/webp');
  });

  it('falls back to the extension when the browser reports nothing', () => {
    expect(resolveImageMimeType('photo.JPG', '')).toBe('image/jpeg');
    expect(resolveImageMimeType('photo.jpeg', undefined)).toBe('image/jpeg');
  });

  it('rejects the "image/unknown" placeholder that caused the API failure', () => {
    // The client used to force this literal, which is not a MIME type.
    expect(resolveImageMimeType('mystery', 'image/unknown')).toBeNull();
  });

  it('still recovers a real type from the extension despite a bogus reported type', () => {
    expect(resolveImageMimeType('photo.png', 'image/unknown')).toBe('image/png');
  });

  it('refuses image formats the API cannot accept', () => {
    // SVG and PDF must not be smuggled through as base64 image blocks.
    expect(resolveImageMimeType('logo.svg', 'image/svg+xml')).toBeNull();
    expect(resolveImageMimeType('doc.pdf', 'application/pdf')).toBeNull();
  });

  it('returns null for a file with no extension and no type', () => {
    expect(resolveImageMimeType('README', '')).toBeNull();
    expect(resolveImageMimeType(undefined, undefined)).toBeNull();
  });
});

describe('stripDataUrlPrefix', () => {
  it('removes the data URL prefix a FileReader produces', () => {
    expect(stripDataUrlPrefix('data:image/png;base64,AAAB')).toBe('AAAB');
  });

  it('leaves raw base64 untouched', () => {
    expect(stripDataUrlPrefix('AAAB')).toBe('AAAB');
  });

  it('handles an empty string', () => {
    expect(stripDataUrlPrefix('')).toBe('');
  });
});

describe('isSupportedImageType', () => {
  it('accepts only the four types the API allows', () => {
    expect(isSupportedImageType('image/png')).toBe(true);
    expect(isSupportedImageType('image/unknown')).toBe(false);
    expect(isSupportedImageType('image/svg+xml')).toBe(false);
    expect(isSupportedImageType(undefined)).toBe(false);
  });
});

describe('normalizeAttachment', () => {
  it('reads the flat shape the client now sends', () => {
    expect(
      normalizeAttachment({
        name: 'cat.png',
        type: 'image/png',
        size: 1234,
        data: 'AAAB',
      })
    ).toEqual({ name: 'cat.png', type: 'image/png', size: 1234, data: 'AAAB' });
  });

  it('recovers name and size from a nested File, which is what actually broke', () => {
    // The payload that produced:
    //   Argument `fileName` is missing.
    //   { fileName: undefined, fileType: "image/unknown", fileSize: 0 }
    const legacy = {
      id: 'abc',
      file: { name: 'cat.png', size: 4096, type: 'image/png' },
      type: 'image/unknown',
      preview: 'blob:...',
    };
    expect(normalizeAttachment(legacy)).toEqual({
      name: 'cat.png',
      type: 'image/png',
      size: 4096,
      data: undefined,
    });
  });

  it('accepts the fileName/fileSize naming used by the messages route', () => {
    expect(
      normalizeAttachment({ fileName: 'a.gif', fileType: 'image/gif', fileSize: 10 })
    ).toMatchObject({ name: 'a.gif', type: 'image/gif', size: 10 });
  });

  it('returns null when there is no usable name, rather than writing a broken row', () => {
    expect(normalizeAttachment({ type: 'image/png', size: 10 })).toBeNull();
    expect(normalizeAttachment({ name: '   ' })).toBeNull();
    expect(normalizeAttachment(null)).toBeNull();
    expect(normalizeAttachment('nonsense')).toBeNull();
  });

  it('strips a data URL prefix that slipped through from the client', () => {
    expect(
      normalizeAttachment({ name: 'a.png', type: 'image/png', data: 'data:image/png;base64,XYZ' })
    ).toMatchObject({ data: 'XYZ' });
  });

  it('never emits "image/unknown" — falls back to a generic binary type', () => {
    const out = normalizeAttachment({ name: 'mystery', type: 'image/unknown', size: 1 });
    expect(out!.type).toBe('application/octet-stream');
  });

  it('preserves a legitimate non-image type', () => {
    expect(
      normalizeAttachment({ name: 'notes.txt', type: 'text/plain', size: 5 })
    ).toMatchObject({ type: 'text/plain' });
  });

  it('coerces a missing or invalid size to 0 rather than NaN', () => {
    expect(normalizeAttachment({ name: 'a.png' })!.size).toBe(0);
    expect(normalizeAttachment({ name: 'a.png', size: 'huge' })!.size).toBe(0);
    expect(normalizeAttachment({ name: 'a.png', size: -5 })!.size).toBe(0);
  });

  it('treats empty data as absent, so no empty image block is sent', () => {
    expect(normalizeAttachment({ name: 'a.png', type: 'image/png', data: '' })!.data).toBeUndefined();
  });
});
