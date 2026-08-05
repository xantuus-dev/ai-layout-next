import { describe, it, expect, vi, afterEach } from 'vitest';
import { AIRouter } from '@/lib/ai-providers/router';

describe('AIRouter.estimateCredits fallback (no provider registered at all)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('bills a completely unrecognized model at the highest rate across all registered models', () => {
    const router = new AIRouter();
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const allModels = router.getAllModels();
    if (allModels.length === 0) {
      // No provider API keys configured in this environment — router falls
      // back to its last-resort constant. Just confirm it doesn't throw
      // and returns a sane positive number.
      const credits = router.estimateCredits('totally-unknown-model', 1000);
      expect(credits).toBeGreaterThan(0);
      return;
    }

    const highestRate = Math.max(...allModels.map((m) => m.creditsPerThousandTokens));
    const credits = router.estimateCredits('totally-unknown-model', 1000);

    expect(credits).toBe(Math.max(1, Math.ceil(highestRate)));
  });

  it('routes a known model to its provider correctly', () => {
    const router = new AIRouter();
    const allModels = router.getAllModels();
    if (allModels.length === 0) return; // no providers configured in this env

    const knownModel = allModels[0];
    const provider = router.getProviderForModel(knownModel.id);

    expect(provider).not.toBeNull();
    expect(provider!.id).toBe(knownModel.provider);
  });
});
