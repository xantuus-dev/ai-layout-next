import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { deductCredits } from '@/lib/credits';
import * as emailModule from '@/lib/email';

// NOTE: don't capture `vi.mocked(emailModule.sendUsageAlertEmail)` in a
// top-level const — vi.restoreAllMocks() between tests swaps the module's
// property back to the original unspied function, so a cached reference
// goes stale. Re-read emailModule.sendUsageAlertEmail fresh each time.

describe('credits.ts — usage alert thresholds', () => {
  let userId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `test-usage-alert-${Date.now()}-${Math.random()}@example.com`,
        name: 'Alert Test User',
        monthlyCredits: 100,
        creditsUsed: 0,
        plan: 'free',
      },
    });
    userId = user.id;
    vi.spyOn(emailModule, 'sendUsageAlertEmail').mockResolvedValue({ sent: true });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await prisma.usageRecord.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  it('sends the 80% alert once crossed, and marks it sent', async () => {
    await deductCredits(userId, 80, { type: 'test' }); // exactly 80%

    expect(emailModule.sendUsageAlertEmail).toHaveBeenCalledTimes(1);
    expect(emailModule.sendUsageAlertEmail).toHaveBeenCalledWith(expect.objectContaining({ threshold: 80 }));

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.creditAlert80SentAt).not.toBeNull();
    expect(user?.creditAlert100SentAt).toBeNull();
  });

  it('does not re-send the 80% alert on a subsequent deduction that stays under 100%', async () => {
    await deductCredits(userId, 80, { type: 'test' }); // crosses 80%
    vi.mocked(emailModule.sendUsageAlertEmail).mockClear();

    await deductCredits(userId, 5, { type: 'test' }); // still under 100% (85%)

    expect(emailModule.sendUsageAlertEmail).not.toHaveBeenCalled();
  });

  it('sends the 100% alert once fully used, and marks it sent', async () => {
    await deductCredits(userId, 80, { type: 'test' });
    vi.mocked(emailModule.sendUsageAlertEmail).mockClear();

    await deductCredits(userId, 20, { type: 'test' }); // now at 100%

    expect(emailModule.sendUsageAlertEmail).toHaveBeenCalledTimes(1);
    expect(emailModule.sendUsageAlertEmail).toHaveBeenCalledWith(expect.objectContaining({ threshold: 100 }));

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.creditAlert100SentAt).not.toBeNull();
  });

  it('jumping straight from under 80% to 100% in one deduction sends only the 100% alert, but marks both thresholds sent', async () => {
    await deductCredits(userId, 100, { type: 'test' }); // 0% -> 100% in one shot

    expect(emailModule.sendUsageAlertEmail).toHaveBeenCalledTimes(1);
    expect(emailModule.sendUsageAlertEmail).toHaveBeenCalledWith(expect.objectContaining({ threshold: 100 }));

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.creditAlert80SentAt).not.toBeNull();
    expect(user?.creditAlert100SentAt).not.toBeNull();
  });

  it('does not alert at all while under 80%', async () => {
    await deductCredits(userId, 50, { type: 'test' });
    expect(emailModule.sendUsageAlertEmail).not.toHaveBeenCalled();
  });
});
