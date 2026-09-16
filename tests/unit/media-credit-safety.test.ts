import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Guards the reserve-then-refund ordering in lib/media/image.ts.
 *
 * The bug this replaces: credits were spent AFTER the provider call and after
 * the row was written. assertCanSpend is only advisory, so a concurrent request
 * could drain the balance while the generation was in flight — we paid the
 * provider, the customer was never billed, and a GeneratedImage row was still
 * created claiming creditsUsed. These tests pin the three orderings that matter.
 */

// vi.mock factories are hoisted above every top-level declaration, so anything
// they close over has to come from vi.hoisted — including the error class,
// which must be the same identity the module under test catches on.
const {
  generateImage,
  imageCreate,
  assertCanSpend,
  spendCredits,
  refundCredits,
  InsufficientCreditsError,
} = vi.hoisted(() => {
  class InsufficientCreditsError extends Error {}
  return {
    generateImage: vi.fn(),
    imageCreate: vi.fn(),
    assertCanSpend: vi.fn(),
    spendCredits: vi.fn(),
    refundCredits: vi.fn(),
    InsufficientCreditsError,
  };
});

vi.mock('@/lib/gemini-image', () => ({
  geminiImageService: {
    modelId: 'gemini-2.5-flash-image',
    isConfigured: () => true,
    generateImage,
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { generatedImage: { create: imageCreate } },
}));

vi.mock('@/lib/billing/gate', () => ({
  assertCanSpend,
  spendCredits,
  refundCredits,
  InsufficientCreditsError,
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: async () => ({ success: true, reset: Date.now() }),
  RATE_LIMITS: { IMAGE_GENERATION: { requests: 10, window: 60 } },
}));

vi.mock('@/lib/credits', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/credits')>();
  return { ...actual, checkAndResetCredits: vi.fn() };
});

import { generateImageForUser } from '@/lib/media/image';
import { IMAGE_GENERATION_CREDITS } from '@/lib/credits';

const input = { userId: 'user_1', prompt: 'a lighthouse at dusk', width: 1024, height: 1024 };

beforeEach(() => {
  vi.clearAllMocks();
  assertCanSpend.mockResolvedValue({ allowed: true, remaining: 10_000 });
  spendCredits.mockResolvedValue({ success: true });
  refundCredits.mockResolvedValue({ success: true, creditsRefunded: IMAGE_GENERATION_CREDITS });
  generateImage.mockResolvedValue({ imageUrl: 'https://example.test/a.png' });
  imageCreate.mockResolvedValue({
    id: 'img_1',
    imageUrl: 'https://example.test/a.png',
    prompt: input.prompt,
    width: 1024,
    height: 1024,
    createdAt: new Date(),
  });
});

describe('generateImageForUser credit safety', () => {
  it('charges before calling the provider, and does not refund on success', async () => {
    const order: string[] = [];
    spendCredits.mockImplementation(async () => {
      order.push('spend');
      return { success: true };
    });
    generateImage.mockImplementation(async () => {
      order.push('generate');
      return { imageUrl: 'https://example.test/a.png' };
    });

    const result = await generateImageForUser(input);

    expect(result.ok).toBe(true);
    expect(order).toEqual(['spend', 'generate']);
    expect(spendCredits).toHaveBeenCalledTimes(1);
    expect(spendCredits.mock.calls[0][1]).toBe(IMAGE_GENERATION_CREDITS);
    expect(refundCredits).not.toHaveBeenCalled();
  });

  it('refunds when the provider fails, and never writes a row', async () => {
    generateImage.mockRejectedValue(new Error('upstream 503'));

    const result = await generateImageForUser(input);

    expect(result).toMatchObject({ ok: false, reason: 'provider_error' });
    expect(spendCredits).toHaveBeenCalledTimes(1);
    expect(refundCredits).toHaveBeenCalledTimes(1);
    expect(refundCredits.mock.calls[0][1]).toBe(IMAGE_GENERATION_CREDITS);
    expect(refundCredits.mock.calls[0][2]).toBe('provider_error');
    expect(imageCreate).not.toHaveBeenCalled();
  });

  it('refunds when the image cannot be saved, so nobody pays for an unreachable result', async () => {
    imageCreate.mockRejectedValue(new Error('db down'));

    const result = await generateImageForUser(input);

    expect(result).toMatchObject({ ok: false, reason: 'provider_error' });
    expect(refundCredits).toHaveBeenCalledTimes(1);
    expect(refundCredits.mock.calls[0][1]).toBe(IMAGE_GENERATION_CREDITS);
  });

  it('never reaches the provider when the reservation loses a concurrency race', async () => {
    // assertCanSpend passed, but another request took the headroom first.
    spendCredits.mockRejectedValue(new InsufficientCreditsError('no headroom'));

    const result = await generateImageForUser(input);

    expect(result).toMatchObject({ ok: false, reason: 'insufficient_credits' });
    expect(generateImage).not.toHaveBeenCalled();
    expect(imageCreate).not.toHaveBeenCalled();
    expect(refundCredits).not.toHaveBeenCalled();
  });

  it('a failed refund is swallowed so it cannot mask the original failure', async () => {
    generateImage.mockRejectedValue(new Error('upstream 503'));
    refundCredits.mockRejectedValue(new Error('refund write failed'));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await generateImageForUser(input);

    expect(result).toMatchObject({ ok: false, reason: 'provider_error' });
    expect(result).toHaveProperty('message', 'upstream 503');
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining('CREDIT LEAK'),
      expect.any(Error)
    );
    errorLog.mockRestore();
  });
});
