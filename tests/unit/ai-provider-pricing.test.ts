import { describe, it, expect, vi, afterEach } from 'vitest';
import { AnthropicProvider } from '@/lib/ai-providers/anthropic';
import { OpenAIProvider } from '@/lib/ai-providers/openai';
import { GoogleProvider } from '@/lib/ai-providers/google';

// Regression tests for a real bug: unrecognized models used to fall back to
// a guessed mid/low-tier rate (e.g. Google defaulted to its CHEAPEST model,
// 0.075 credits/1K), silently undercharging for any model added to a
// provider's chat UI without a matching price entry. The fix bills unknown
// models at that provider's highest known rate instead, and warns.

describe('AI provider estimateCredits fallback pricing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Anthropic: known model uses its own rate', () => {
    const provider = new AnthropicProvider();
    const sonnet = provider.models.find((m) => m.id === 'claude-sonnet-4-5-20250929')!;
    const credits = provider.estimateCredits(1000, sonnet.id);
    expect(credits).toBe(sonnet.creditsPerThousandTokens);
  });

  it('Anthropic: unknown model bills at the highest known rate, not a guessed default', () => {
    const provider = new AnthropicProvider();
    const highestRate = Math.max(...provider.models.map((m) => m.creditsPerThousandTokens));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const credits = provider.estimateCredits(1000, 'some-brand-new-model-nobody-priced-yet');

    expect(credits).toBe(Math.max(1, Math.ceil(highestRate)));
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('OpenAI: unknown model bills at the highest known rate', () => {
    const provider = new OpenAIProvider();
    const highestRate = Math.max(...provider.models.map((m) => m.creditsPerThousandTokens));

    const credits = provider.estimateCredits(1000, 'gpt-unreleased-model');

    expect(credits).toBe(Math.max(1, Math.ceil(highestRate)));
  });

  it('Google: unknown model bills at the highest known rate (this was the actively dangerous one — it used to default to its CHEAPEST tier, 0.075)', () => {
    const provider = new GoogleProvider();
    const highestRate = Math.max(...provider.models.map((m) => m.creditsPerThousandTokens));
    const cheapestRate = Math.min(...provider.models.map((m) => m.creditsPerThousandTokens));

    // estimateCredits rounds up to a whole credit — mirror that here rather
    // than comparing against the raw per-1K rate.
    const credits = provider.estimateCredits(1000, 'gemini-unreleased-model');

    expect(credits).toBe(Math.max(1, Math.ceil(highestRate)));
    expect(credits).toBeGreaterThan(Math.ceil(cheapestRate));
  });

  it('scales with token count', () => {
    const provider = new AnthropicProvider();
    const haiku = provider.models.find((m) => m.id === 'claude-haiku-4-5-20250529')!;
    const credits2k = provider.estimateCredits(2000, haiku.id);
    expect(credits2k).toBe(Math.ceil(2 * haiku.creditsPerThousandTokens));
  });

  it('never returns less than 1 credit, even for tiny token counts on a cheap model', () => {
    const provider = new GoogleProvider();
    const cheapest = provider.models.reduce((a, b) =>
      a.creditsPerThousandTokens < b.creditsPerThousandTokens ? a : b
    );
    const credits = provider.estimateCredits(1, cheapest.id);
    expect(credits).toBeGreaterThanOrEqual(1);
  });
});
