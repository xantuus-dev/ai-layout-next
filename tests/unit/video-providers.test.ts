import { describe, it, expect } from 'vitest';
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

  it('claims no model for two providers at once', () => {
    const models = listVideoProviders().flatMap((p) => [...p.models]);
    expect(new Set(models).size).toBe(models.length);
  });

  it('routes a Seedance model to the Seedance provider', () => {
    // Registered regardless of credentials; resolution is gated on FAL_KEY.
    expect(getVideoProviderById('seedance')?.models).toEqual(SEEDANCE_MODELS);
  });

  it('will not resolve a provider whose credentials are missing', () => {
    // Guards the failure mode where an unconfigured provider is handed a
    // request and only fails once generation is already under way.
    const resolved = getVideoProviderForModel('seedance-2.5');
    expect(resolved).toBe(seedanceVideoService.isConfigured() ? seedanceVideoService : undefined);
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
