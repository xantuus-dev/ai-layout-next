import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUnique = vi.fn();
const update = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: (...a: unknown[]) => findUnique(...a), update: (...a: unknown[]) => update(...a) } },
}));
vi.mock('@/lib/email', () => ({ sendUsageAlertEmail: vi.fn() }));

import { checkAndResetCredits } from '@/lib/credits';
import { TRIAL_DAILY_CREDITS, getCreditPeriod } from '@/lib/plans';

/** findUnique is called twice: resolveBillingUserId, then the account row. */
function mockUser(row: Record<string, unknown>) {
  findUnique.mockReset();
  findUnique
    .mockResolvedValueOnce({ billingOwnerId: null })
    .mockResolvedValueOnce(row);
}
const dataWritten = () => update.mock.calls[0][0].data;

const NOW = new Date('2026-08-22T09:30:00.000Z');
const FUTURE = new Date('2026-09-01T00:00:00.000Z'); // trial still running
const TOMORROW_UTC = new Date('2026-08-23T00:00:00.000Z');

beforeEach(() => {
  update.mockReset().mockResolvedValue({});
  vi.useFakeTimers().setSystemTime(NOW);
});

describe('credit periods', () => {
  it('puts a trial on a daily clock and paid on a monthly one', () => {
    expect(getCreditPeriod('trial')).toBe('daily');
    expect(getCreditPeriod('pro')).toBe('monthly');
    expect(getCreditPeriod('enterprise')).toBe('monthly');
  });

  it('treats an unknown plan as monthly, refreshing less often rather than more', () => {
    expect(getCreditPeriod('nonsense')).toBe('monthly');
    expect(getCreditPeriod('free')).toBe('monthly'); // no plan, no allowance
  });
});

describe('checkAndResetCredits: trial daily refresh', () => {
  it('refreshes a trialling account once the day has rolled over, to the next UTC midnight', async () => {
    mockUser({
      plan: 'trial', trialEndsAt: FUTURE, monthlyCredits: TRIAL_DAILY_CREDITS, creditsUsed: 300,
      creditsResetAt: new Date('2026-08-22T00:00:00.000Z'),
      creditAlert80SentAt: null, creditAlert100SentAt: null,
    });

    const result = await checkAndResetCredits('u1');

    expect(result).toMatchObject({ reset: true, creditsUsed: 0 });
    expect(dataWritten().creditsResetAt).toEqual(TOMORROW_UTC);
  });

  it('does not refresh again within the same UTC day', async () => {
    mockUser({
      plan: 'trial', trialEndsAt: FUTURE, monthlyCredits: TRIAL_DAILY_CREDITS, creditsUsed: 120,
      creditsResetAt: TOMORROW_UTC,
      creditAlert80SentAt: null, creditAlert100SentAt: null,
    });

    const result = await checkAndResetCredits('u1');

    expect(result).toMatchObject({ reset: false, creditsUsed: 120 });
    expect(update).not.toHaveBeenCalled();
  });

  it('preserves purchased credits, which are banked as negative usage', async () => {
    // The defect this guards: zeroing creditsUsed at every midnight would
    // delete a credit pack the customer paid real money for.
    mockUser({
      plan: 'trial', trialEndsAt: FUTURE, monthlyCredits: TRIAL_DAILY_CREDITS, creditsUsed: -1000,
      creditsResetAt: new Date('2026-08-22T00:00:00.000Z'),
      creditAlert80SentAt: null, creditAlert100SentAt: null,
    });

    const result = await checkAndResetCredits('u1');

    expect(result!.creditsUsed).toBe(-1000);
    expect(dataWritten().creditsUsed).toBe(-1000);
  });

  it('clears spent allowance but keeps the banked remainder', async () => {
    // Bought 1,000, spent 400 of it: 600 of purchased headroom must survive.
    mockUser({
      plan: 'trial', trialEndsAt: FUTURE, monthlyCredits: TRIAL_DAILY_CREDITS, creditsUsed: -600,
      creditsResetAt: new Date('2026-08-21T00:00:00.000Z'),
      creditAlert80SentAt: null, creditAlert100SentAt: null,
    });

    await checkAndResetCredits('u1');

    expect(dataWritten().creditsUsed).toBe(-600);
  });

  it('self-heals a trial still carrying a monthly reset date', async () => {
    // Accounts that predate the daily tier, or that were just downgraded
    // from paid, hold a reset date a month out. Waiting for it would leave
    // them with no refresh for weeks.
    mockUser({
      plan: 'trial', trialEndsAt: FUTURE, monthlyCredits: TRIAL_DAILY_CREDITS, creditsUsed: 300,
      creditsResetAt: new Date('2026-09-15T00:00:00.000Z'),
      creditAlert80SentAt: null, creditAlert100SentAt: null,
    });

    const result = await checkAndResetCredits('u1');

    expect(result).toMatchObject({ reset: true, creditsUsed: 0 });
    expect(dataWritten().creditsResetAt).toEqual(TOMORROW_UTC);
  });
});

describe('checkAndResetCredits: usage-alert emails on a daily clock', () => {
  it('does not re-arm a recent alert, so a daily maxer is not emailed every day', async () => {
    const sentYesterday = new Date('2026-08-21T10:00:00.000Z');
    mockUser({
      plan: 'trial', trialEndsAt: FUTURE, monthlyCredits: TRIAL_DAILY_CREDITS, creditsUsed: 300,
      creditsResetAt: new Date('2026-08-22T00:00:00.000Z'),
      creditAlert80SentAt: sentYesterday, creditAlert100SentAt: sentYesterday,
    });

    await checkAndResetCredits('u1');

    expect(dataWritten().creditAlert80SentAt).toEqual(sentYesterday);
    expect(dataWritten().creditAlert100SentAt).toEqual(sentYesterday);
  });

  it('re-arms an alert older than the seven-day window', async () => {
    mockUser({
      plan: 'trial', trialEndsAt: FUTURE, monthlyCredits: TRIAL_DAILY_CREDITS, creditsUsed: 300,
      creditsResetAt: new Date('2026-08-22T00:00:00.000Z'),
      creditAlert80SentAt: new Date('2026-08-10T10:00:00.000Z'),
      creditAlert100SentAt: new Date('2026-08-10T10:00:00.000Z'),
    });

    await checkAndResetCredits('u1');

    expect(dataWritten().creditAlert80SentAt).toBeNull();
    expect(dataWritten().creditAlert100SentAt).toBeNull();
  });
});

describe('checkAndResetCredits: paid tiers keep the monthly cadence', () => {
  it('refreshes a paid account a month out, not at midnight', async () => {
    mockUser({
      plan: 'pro', trialEndsAt: null, monthlyCredits: 12000, creditsUsed: 9000,
      creditsResetAt: new Date('2026-08-21T00:00:00.000Z'),
      creditAlert80SentAt: new Date('2026-08-20T00:00:00.000Z'), creditAlert100SentAt: null,
    });

    const result = await checkAndResetCredits('u1');

    expect(result).toMatchObject({ reset: true, creditsUsed: 0 });
    expect(dataWritten().creditsResetAt).toEqual(new Date('2026-09-22T09:30:00.000Z'));
    // Monthly resets clear alerts unconditionally, as they always have.
    expect(dataWritten().creditAlert80SentAt).toBeNull();
  });

  it('leaves a paid account with a far-future reset date alone', async () => {
    // The daily self-heal must not fire for monthly plans.
    mockUser({
      plan: 'pro', trialEndsAt: null, monthlyCredits: 12000, creditsUsed: 500,
      creditsResetAt: new Date('2026-09-15T00:00:00.000Z'),
      creditAlert80SentAt: null, creditAlert100SentAt: null,
    });

    const result = await checkAndResetCredits('u1');

    expect(result).toMatchObject({ reset: false });
    expect(update).not.toHaveBeenCalled();
  });
});

describe('checkAndResetCredits: trial expiry backstop', () => {
  const EXPIRED = new Date('2026-08-20T00:00:00.000Z');

  it('drops an elapsed trial to the no-plan state instead of refreshing it', async () => {
    // Stripe normally converts a card-required trial before this fires. This
    // covers what Stripe cannot: accounts grandfathered off the old free
    // tier, cancellations, and missed webhooks. Without it a lapsed trial
    // would keep granting credits every midnight forever.
    mockUser({
      plan: 'trial', trialEndsAt: EXPIRED, monthlyCredits: TRIAL_DAILY_CREDITS, creditsUsed: 250,
      creditsResetAt: new Date('2026-08-22T00:00:00.000Z'),
      creditAlert80SentAt: null, creditAlert100SentAt: null,
    });

    const result = await checkAndResetCredits('u1');

    expect(result).toMatchObject({ reset: false, trialExpired: true });
    expect(dataWritten()).toMatchObject({ plan: 'free', monthlyCredits: 0 });
  });

  it('lets an expired trial keep credits the customer actually paid for', async () => {
    mockUser({
      plan: 'trial', trialEndsAt: EXPIRED, monthlyCredits: TRIAL_DAILY_CREDITS, creditsUsed: -1000,
      creditsResetAt: new Date('2026-08-22T00:00:00.000Z'),
      creditAlert80SentAt: null, creditAlert100SentAt: null,
    });

    await checkAndResetCredits('u1');

    expect(dataWritten().creditsUsed).toBe(-1000);
  });

  it('still refreshes a trial that has not ended yet', async () => {
    mockUser({
      plan: 'trial', trialEndsAt: new Date('2026-08-30T00:00:00.000Z'),
      monthlyCredits: TRIAL_DAILY_CREDITS, creditsUsed: 300,
      creditsResetAt: new Date('2026-08-22T00:00:00.000Z'),
      creditAlert80SentAt: null, creditAlert100SentAt: null,
    });

    const result = await checkAndResetCredits('u1');

    expect(result).toMatchObject({ reset: true, creditsUsed: 0 });
    expect(dataWritten().plan).toBeUndefined();
  });

  it('does not expire a trial that has no end date recorded', async () => {
    mockUser({
      plan: 'trial', trialEndsAt: null, monthlyCredits: TRIAL_DAILY_CREDITS, creditsUsed: 300,
      creditsResetAt: new Date('2026-08-22T00:00:00.000Z'),
      creditAlert80SentAt: null, creditAlert100SentAt: null,
    });

    const result = await checkAndResetCredits('u1');

    expect(result).toMatchObject({ reset: true });
  });
});
