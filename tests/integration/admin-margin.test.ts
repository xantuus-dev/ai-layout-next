import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { getMarginReport } from '@/lib/admin/margin';
import { aiRouter } from '@/lib/ai-providers';

// Must be a real id from the catalog: getMarginReport prices a request by
// looking the model up, and an unknown id silently costs 0 rather than raising.
// This was 'claude-haiku-4-5-20250529' with $0.25/$1.25 — an id the API 404s on,
// at pricing understated 4x. The catalog was corrected; this test was not, so
// every cost assertion here compared against 0.
const HAIKU_MODEL = 'claude-haiku-4-5'; // inputCostPer1M: 1, outputCostPer1M: 5

describe('admin margin report', () => {
  let freeUserId: string;
  let paidUserId: string;

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.random()}`;
    const freeUser = await prisma.user.create({
      data: {
        email: `test-margin-free-${stamp}@example.com`,
        plan: 'free',
        // 'free' now means "no active plan" and grants 0 credits — the old
        // 4,000-credit free allowance became the $29.95 paid entry tier
        // (ENTRY_TIER_CREDITS). Leaving 4000 here would make getPriceTier()
        // match that paid tier and report implied revenue for a user who is
        // paying nothing, which is exactly what this test exists to catch.
        monthlyCredits: 0,
      },
    });
    const paidUser = await prisma.user.create({
      data: {
        email: `test-margin-paid-${stamp}@example.com`,
        plan: 'pro',
        monthlyCredits: 12000, // matches the $60/mo CREDIT_TIER_PRICES tier -> $0.005/credit
      },
    });
    freeUserId = freeUser.id;
    paidUserId = paidUser.id;
  });

  afterEach(async () => {
    await prisma.usageRecord.deleteMany({ where: { userId: { in: [freeUserId, paidUserId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [freeUserId, paidUserId] } } });
  });

  it('computes real cost from recorded input/output token split, and implied revenue from the paid tier rate', async () => {
    // 1,000,000 input + 1,000,000 output tokens on Haiku = 1 + 5 = $6.00 real cost
    await prisma.usageRecord.create({
      data: {
        userId: paidUserId,
        type: 'chat',
        model: HAIKU_MODEL,
        tokens: 2_000_000,
        credits: 2000, // at $0.005/credit -> $10 implied revenue
        metadata: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      },
    });

    const report = await getMarginReport(1);
    const row = report.byModel.find((r) => r.model === HAIKU_MODEL);

    expect(row).toBeDefined();
    expect(row!.requests).toBe(1);
    expect(row!.creditsCharged).toBe(2000);
    expect(row!.realCost).toBeCloseTo(6, 5);
    expect(row!.impliedRevenue).toBeCloseTo(10, 5);
    expect(row!.breakEvenRatePerCredit).toBeCloseTo(6 / 2000, 8);
  });

  it('free-plan usage has zero implied revenue, so it shows as pure cost', async () => {
    await prisma.usageRecord.create({
      data: {
        userId: freeUserId,
        type: 'chat',
        model: HAIKU_MODEL,
        tokens: 1000,
        credits: 5,
        metadata: { inputTokens: 500, outputTokens: 500 },
      },
    });

    const report = await getMarginReport(1);
    const customerRow = report.topCustomersByCost.find((c) => c.userId === freeUserId);

    expect(customerRow).toBeDefined();
    expect(customerRow!.impliedRevenue).toBe(0);
    expect(customerRow!.realCost).toBeGreaterThan(0);
  });

  it('falls back to an even token split and flags it as a caveat when no split was recorded', async () => {
    await prisma.usageRecord.create({
      data: {
        userId: paidUserId,
        type: 'agent', // no inputTokens/outputTokens recorded for this usage type
        model: HAIKU_MODEL,
        tokens: 2_000_000,
        credits: 2000,
        metadata: { workspaceId: 'irrelevant' },
      },
    });

    const report = await getMarginReport(1);
    const row = report.byModel.find((r) => r.model === HAIKU_MODEL);

    // Even split of 2,000,000 tokens = 1,000,000 in + 1,000,000 out, same as the explicit-split test
    expect(row!.realCost).toBeCloseTo(6, 5);
    expect(report.caveats.some((c) => c.includes('estimated 50/50 split'))).toBe(true);
  });

  it('excludes unpriced/unrecognized models from cost totals but still counts their credits, and flags it', async () => {
    const unknownModel = 'some-model-nobody-configured-pricing-for';
    expect(aiRouter.getModel(unknownModel)).toBeUndefined(); // sanity check on the fixture itself

    await prisma.usageRecord.create({
      data: {
        userId: paidUserId,
        type: 'chat',
        model: unknownModel,
        tokens: 1000,
        credits: 50,
        metadata: {},
      },
    });

    const report = await getMarginReport(1);
    const row = report.byModel.find((r) => r.model === unknownModel);

    expect(row).toBeDefined();
    expect(row!.creditsCharged).toBe(50);
    expect(row!.realCost).toBe(0);
    expect(report.caveats.some((c) => c.includes(unknownModel))).toBe(true);
  });

  it('totals equal the sum of the per-model rows', async () => {
    await prisma.usageRecord.create({
      data: {
        userId: paidUserId,
        type: 'chat',
        model: HAIKU_MODEL,
        tokens: 2_000_000,
        credits: 2000,
        metadata: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      },
    });
    await prisma.usageRecord.create({
      data: {
        userId: freeUserId,
        type: 'chat',
        model: HAIKU_MODEL,
        tokens: 1000,
        credits: 5,
        metadata: { inputTokens: 500, outputTokens: 500 },
      },
    });

    const report = await getMarginReport(1);
    const summedCost = report.byModel.reduce((sum, r) => sum + r.realCost, 0);
    const summedCredits = report.byModel.reduce((sum, r) => sum + r.creditsCharged, 0);

    expect(report.totals.realCost).toBeCloseTo(summedCost, 8);
    expect(report.totals.creditsCharged).toBe(summedCredits);
    expect(report.totals.impliedMargin).toBeCloseTo(report.totals.impliedRevenue - report.totals.realCost, 8);
  });
});
