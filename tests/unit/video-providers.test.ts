import { describe, it, expect } from 'vitest';
import {
  assertSupported,
  getVideoProviderById,
  getVideoProviderForModel,
  listVideoProviders,
  veoVideoService,
  VEO_MODELS,
} from '@/lib/video-providers';

describe('video provider registry', () => {
  it('resolves the owning provider from a model id', () => {
    expect(getVideoProviderForModel('veo-3.1-fast-generate-preview')?.id).toBe('veo');
  });

  it('returns undefined for a model no provider claims', () => {
    expect(getVideoProviderForModel('some-unreleased-model')).toBeUndefined();
  });

  it('falls back to the default provider when no model is named', () => {
    // GOOGLE_AI_API_KEY is present in the test env, so Veo is the default.
    expect(getVideoProviderForModel()?.id).toBe('veo');
  });

  it('exposes every Veo model through the registry', () => {
    expect(getVideoProviderById('veo')?.models).toEqual(VEO_MODELS);
  });

  it('gives every registered provider a distinct id', () => {
    const ids = listVideoProviders().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('assertSupported', () => {
  const request = { prompt: 'a long enough prompt for validation' };

  it('accepts a request inside the provider capabilities', () => {
    expect(() =>
      assertSupported(veoVideoService, { ...request, aspectRatio: '16:9', resolution: '720p', durationSeconds: 8 })
    ).not.toThrow();
  });

  it('rejects a duration the provider cannot produce, naming what it supports', () => {
    // 30s is Seedance's headline length and precisely what Veo cannot do.
    expect(() => assertSupported(veoVideoService, { ...request, durationSeconds: 30 })).toThrow(/4, 6, 8/);
  });

  it('rejects an unsupported aspect ratio', () => {
    expect(() => assertSupported(veoVideoService, { ...request, aspectRatio: '21:9' })).toThrow(/aspect ratio/i);
  });

  it('rejects an unsupported resolution', () => {
    expect(() => assertSupported(veoVideoService, { ...request, resolution: '480p' })).toThrow(/resolution/i);
  });

  it('ignores fields the caller left unset', () => {
    expect(() => assertSupported(veoVideoService, request)).not.toThrow();
  });
});
