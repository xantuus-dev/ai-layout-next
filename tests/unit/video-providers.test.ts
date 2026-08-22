import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  assertSupported,
  getVideoProviderById,
  getVideoProviderForModel,
  listVideoProviders,
  seedanceVideoService,
  veoVideoService,
  SEEDANCE_MODELS,
  VEO_MODELS,
} from '@/lib/video-providers';

describe('video provider registry', () => {
  // Resolution is gated on isConfigured(), which reads process.env at call
  // time. Credential state is therefore set explicitly per test rather than
  // inherited from the ambient environment: these assertions previously passed
  // locally, where .env.local supplies real keys, and failed in CI, where it
  // does not — which blocked the deploy job rather than catching a real bug.
  beforeEach(() => {
    vi.stubEnv('GOOGLE_AI_API_KEY', 'test-google-key');
    vi.stubEnv('FAL_KEY', 'test-fal-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves the owning provider from a model id', () => {
    expect(getVideoProviderForModel('veo-3.1-fast-generate-preview')?.id).toBe('veo');
  });

  it('returns undefined for a model no provider claims', () => {
    expect(getVideoProviderForModel('some-unreleased-model')).toBeUndefined();
  });

  it('falls back to the default provider when no model is named', () => {
    // Veo is registered first, so with every provider configured it is the
    // default. Registration order is preference order.
    expect(getVideoProviderForModel()?.id).toBe('veo');
  });

  it('exposes every Veo model through the registry', () => {
    expect(getVideoProviderById('veo')?.models).toEqual(VEO_MODELS);
  });

  it('gives every registered provider a distinct id', () => {
    const ids = listVideoProviders().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('claims no model for two providers at once', () => {
    const models = listVideoProviders().flatMap((p) => [...p.models]);
    expect(new Set(models).size).toBe(models.length);
  });

  it('routes a Seedance model to the Seedance provider', () => {
    expect(getVideoProviderById('seedance')?.models).toEqual(SEEDANCE_MODELS);
    expect(getVideoProviderForModel('seedance-2.5')).toBe(seedanceVideoService);
  });

  it('lists a provider even when it has no credentials', () => {
    // Registration is unconditional; only resolution is gated. The picker needs
    // the full catalogue to explain why a model is unavailable.
    vi.stubEnv('FAL_KEY', '');
    expect(listVideoProviders().map((p) => p.id)).toContain('seedance');
    expect(getVideoProviderById('seedance')?.models).toEqual(SEEDANCE_MODELS);
  });

  it('will not resolve a provider whose credentials are missing', () => {
    // Guards the failure mode where an unconfigured provider is handed a
    // request and only fails once generation is already under way.
    vi.stubEnv('FAL_KEY', '');
    expect(getVideoProviderForModel('seedance-2.5')).toBeUndefined();
  });

  it('falls through to the next configured provider when the preferred one is unconfigured', () => {
    vi.stubEnv('GOOGLE_AI_API_KEY', '');
    expect(getVideoProviderForModel()?.id).toBe('seedance');
  });

  it('resolves nothing at all when no provider has credentials', () => {
    vi.stubEnv('GOOGLE_AI_API_KEY', '');
    vi.stubEnv('FAL_KEY', '');
    expect(getVideoProviderForModel()).toBeUndefined();
    expect(getVideoProviderForModel('veo-3.1-fast-generate-preview')).toBeUndefined();
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

  it('accepts on Seedance exactly what Veo rejects', () => {
    // The whole point of per-provider capabilities: 30s and 480p are real for
    // Seedance and impossible for Veo.
    expect(() =>
      assertSupported(seedanceVideoService, { ...request, durationSeconds: 30, resolution: '480p' })
    ).not.toThrow();
    expect(() => assertSupported(veoVideoService, { ...request, durationSeconds: 30 })).toThrow();
  });

  it('still rejects durations past the Seedance ceiling', () => {
    expect(() => assertSupported(seedanceVideoService, { ...request, durationSeconds: 31 })).toThrow(/31s/);
  });

  it('rejects 4k on Seedance, which offers it only as a separate upscale', () => {
    expect(() => assertSupported(seedanceVideoService, { ...request, resolution: '4k' })).toThrow(/resolution/i);
  });
});
