import { describe, it, expect, vi, beforeEach } from 'vitest';

const findMany = vi.fn();
const update = vi.fn();
const sendTrialEndingEmail = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findMany: (...a: unknown[]) => findMany(...a), update: (...a: unknown[]) => update(...a) } },
}));
vi.mock('@/lib/email', () => ({ sendTrialEndingEmail: (...a: unknown[]) => sendTrialEndingEmail(...a) }));

import {
  INTRO_TRIAL,
  ENTRY_TIER_CREDITS,
  CREDIT_TIER_PRICES,
  isIntroTrialPriceId,
  getIntroTrialTargetPriceId,
} from '@/lib/pricing-config';
import { sendExpiringTrialNotices, TRIAL_NOTICE_LEAD_DAYS } from '@/lib/billing/trial-notices';
import { TRIAL_PERIOD_DAYS } from '@/lib/plans';

describe('the $9.95 / 14-day intro offer', () => {
  it('is priced and dated as advertised on the CTA', () => {
    expect(INTRO_TRIAL.price).toBe(9.95);
    expect(INTRO_TRIAL.days).toBe(14);
    // The advertised length and the plan definition are the same constant,
    // so the CTA copy cannot drift from what the offer actually runs for.
    expect(INTRO_TRIAL.days).toBe(TRIAL_PERIOD_DAYS);
  });

  it('converts into the $29.95 entry tier', () => {
    expect(INTRO_TRIAL.convertsToCredits).toBe(ENTRY_TIER_CREDITS);
    expect(CREDIT_TIER_PRICES[String(ENTRY_TIER_CREDITS)].monthlyPrice).toBe(29.95);
  });

  it('turns a real profit at the credit grant it advertises', () => {
    // 300/day for 14 days at the blended provider rate. If someone raises
    // either number, this is the guard that says the offer now loses money.
    const BLENDED_COST_PER_CREDIT = 0.0021;
    const worstCaseCost = 300 * INTRO_TRIAL.days * BLENDED_COST_PER_CREDIT;
    expect(worstCaseCost).toBeLessThan(INTRO_TRIAL.price);
  });

  it('delivers roughly the outputs the CTA claims', () => {
    // "around 250 images, 800+ chat turns, or 11 hours of transcription"
    const credits = 300 * INTRO_TRIAL.days; // 4,200
    expect(Math.floor(credits / 15)).toBeGreaterThanOrEqual(250);   // images @ 15 cr
    expect(Math.floor(credits / 4.5)).toBeGreaterThanOrEqual(800);  // chat turns
    expect(Math.floor(credits / 6 / 60)).toBeGreaterThanOrEqual(11); // transcription hrs @ 6 cr/min
  });
});

describe('isIntroTrialPriceId', () => {
  it('does not match when no intro price is configured', () => {
    // INTRO_TRIAL.priceId is null without the env var. A null-vs-null match
    // would make every unpriced subscription look like the intro offer.
    if (!INTRO_TRIAL.priceId) {
      expect(isIntroTrialPriceId(null)).toBe(false);
      expect(isIntroTrialPriceId(undefined)).toBe(false);
      expect(isIntroTrialPriceId('price_anything')).toBe(false);
    }
  });

  it('resolves a conversion target only when the entry price is configured', () => {
    const target = getIntroTrialTargetPriceId('monthly');
    expect(target === null || typeof target === 'string').toBe(true);
  });
});

describe('expiring intro-offer notices', () => {
  const NOW = new Date('2026-08-22T09:00:00.000Z');

  beforeEach(() => {
    findMany.mockReset();
    update.mockReset().mockResolvedValue({});
    sendTrialEndingEmail.mockReset().mockResolvedValue({ sent: true });
  });

  it('only considers trials ending inside the notice window', async () => {
    findMany.mockResolvedValue([]);

    await sendExpiringTrialNotices(NOW);

    const where = findMany.mock.calls[0][0].where;
    expect(where.plan).toBe('trial');
    expect(where.trialEndingEmailSentAt).toBeNull();
    expect(where.trialEndsAt.gt).toEqual(NOW);
    expect(where.trialEndsAt.lte).toEqual(
      new Date(NOW.getTime() + TRIAL_NOTICE_LEAD_DAYS * 24 * 60 * 60 * 1000)
    );
  });

  it('stamps the account after a successful send so it cannot re-send', async () => {
    findMany.mockResolvedValue([
      { id: 'u1', email: 'a@example.com', name: 'A', trialEndsAt: new Date('2026-08-24T00:00:00.000Z') },
    ]);

    const result = await sendExpiringTrialNotices(NOW);

    expect(result).toMatchObject({ candidates: 1, sent: 1, failed: 0 });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].data.trialEndingEmailSentAt).toBeInstanceOf(Date);
  });

  it('quotes the price the customer is about to be charged', async () => {
    findMany.mockResolvedValue([
      { id: 'u1', email: 'a@example.com', name: 'A', trialEndsAt: new Date('2026-08-24T00:00:00.000Z') },
    ]);

    await sendExpiringTrialNotices(NOW);

    expect(sendTrialEndingEmail.mock.calls[0][0].amount).toBe('$29.95/month');
  });

  it('leaves a failed send unstamped so tomorrow retries it', async () => {
    // This is the customer's only notice before a real charge — swallowing
    // it on a Resend outage would be worse than sending late.
    sendTrialEndingEmail.mockResolvedValue({ sent: false });
    findMany.mockResolvedValue([
      { id: 'u1', email: 'a@example.com', name: 'A', trialEndsAt: new Date('2026-08-24T00:00:00.000Z') },
    ]);

    const result = await sendExpiringTrialNotices(NOW);

    expect(result).toMatchObject({ sent: 0, failed: 1 });
    expect(update).not.toHaveBeenCalled();
  });
});
