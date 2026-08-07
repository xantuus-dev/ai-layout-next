import { describe, it, expect } from 'vitest';
import { ANTHROPIC_MODELS, DEFAULT_ANTHROPIC_MODEL } from '@/lib/ai-providers/catalog';
import { MODEL_CREDITS_PER_1K } from '@/lib/credits';

// The catalog previously existed in three hand-maintained copies (provider,
// chat-input picker, credits map). They drifted, and a Claude Haiku id that the
// API answers with 404 stayed shipped. These tests fail on that class of drift
// rather than relying on someone remembering to update every copy.
//
// They are offline by design: model *ids* are validated against the live Models
// API by scripts/verify-model-ids.ts, which needs a key and so cannot run here.

describe('Anthropic model catalog', () => {
  it('has no duplicate ids', () => {
    const ids = ANTHROPIC_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses no invented date suffixes on current models', () => {
    // Aliases are complete as published. A fabricated `-YYYYMMDD` suffix is
    // exactly how the broken Haiku id arose, and it 404s at request time.
    const current = ANTHROPIC_MODELS.filter((m) => !m.legacy);
    for (const m of current) {
      expect(m.id, `${m.id} should not carry a date suffix`).not.toMatch(/-\d{8}$/);
    }
  });

  it('prices every model above zero on both sides', () => {
    // These feed credit billing; a zero here silently gives the model away.
    for (const m of ANTHROPIC_MODELS) {
      expect(m.inputCostPer1M, `${m.id} input`).toBeGreaterThan(0);
      expect(m.outputCostPer1M, `${m.id} output`).toBeGreaterThan(0);
      expect(m.creditsPerThousandTokens, `${m.id} credits`).toBeGreaterThan(0);
      // Output is more expensive than input on every Anthropic model; an
      // inversion means the two were transposed.
      expect(m.outputCostPer1M, `${m.id} output vs input`).toBeGreaterThan(m.inputCostPer1M);
    }
  });

  it('declares a thinking style for every model', () => {
    // Omitting this silently falls back to the older budget_tokens shape, which
    // is a 400 on Claude 4.7+.
    for (const m of ANTHROPIC_MODELS) {
      expect(['adaptive', 'budget', 'none'], `${m.id}`).toContain(m.thinkingStyle ?? 'budget');
    }
  });

  it('withholds sampling params on models that reject them', () => {
    // Claude 4.7+ return 400 for temperature/top_p/top_k.
    for (const m of ANTHROPIC_MODELS.filter((m) => m.thinkingStyle === 'adaptive')) {
      expect(m.supportsSampling, `${m.id} must not advertise sampling support`).toBe(false);
    }
  });

  it('exposes the default model in the catalog, and it is not legacy', () => {
    const dflt = ANTHROPIC_MODELS.find((m) => m.id === DEFAULT_ANTHROPIC_MODEL);
    expect(dflt, `${DEFAULT_ANTHROPIC_MODEL} must exist in the catalog`).toBeDefined();
    expect(dflt!.legacy ?? false).toBe(false);
  });

  it('keeps the credits fallback map in sync with the catalog', () => {
    // Drift here means the fallback bills at a different rate than the router.
    for (const m of ANTHROPIC_MODELS) {
      expect(MODEL_CREDITS_PER_1K[m.id], `${m.id} missing from credits map`).toBe(
        m.creditsPerThousandTokens
      );
    }
  });
});
