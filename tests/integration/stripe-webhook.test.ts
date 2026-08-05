import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { grantPurchasedCredits, updateUserSubscription } from '@/lib/stripe-webhook-handlers';
import { CREDIT_TIER_PRICES, isPriceIdConfigured } from '@/lib/pricing-config';
import { PLANS } from '@/lib/plans';
import type Stripe from 'stripe';

function fakeSubscription(priceId: string, subscriptionId = `sub_test_${Date.now()}`): Stripe.Subscription {
  return {
    id: subscriptionId,
    items: { data: [{ price: { id: priceId } }] },
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  } as unknown as Stripe.Subscription;
}

describe('webhook: grantPurchasedCredits (one-time credit pack purchase)', () => {
  let userId: string;

  afterEach(async () => {
    if (!userId) return;
    await prisma.usageRecord.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('grants credits by decrementing creditsUsed and logs a usage record', async () => {
    const user = await prisma.user.create({
      data: {
        email: `test-webhook-grant-${Date.now()}@example.com`,
        monthlyCredits: 100,
        creditsUsed: 50,
      },
    });
    userId = user.id;

    await grantPurchasedCredits(userId, '20');

    const updated = await prisma.user.findUnique({ where: { id: userId } });
    expect(updated?.creditsUsed).toBe(30); // 50 - 20

    const record = await prisma.usageRecord.findFirst({ where: { userId, type: 'credit_purchase' } });
    expect(record?.credits).toBe(-20);
  });

  it('does nothing for a missing/zero/invalid credits amount (does not throw, does not touch the user)', async () => {
    const user = await prisma.user.create({
      data: {
        email: `test-webhook-grant-invalid-${Date.now()}@example.com`,
        monthlyCredits: 100,
        creditsUsed: 50,
      },
    });
    userId = user.id;

    await grantPurchasedCredits(userId, undefined);
    await grantPurchasedCredits(userId, '0');
    await grantPurchasedCredits(userId, 'not-a-number');

    const updated = await prisma.user.findUnique({ where: { id: userId } });
    expect(updated?.creditsUsed).toBe(50); // unchanged
  });
});

describe('webhook: updateUserSubscription plan-label assignment', () => {
  let userId: string;

  afterEach(async () => {
    if (!userId) return;
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("labels a custom tier below the enterprise credit threshold as 'pro'", async () => {
    const tier = Object.values(CREDIT_TIER_PRICES).find(
      (t) => t.credits < PLANS.ENTERPRISE.credits && isPriceIdConfigured(t.priceIds.monthly)
    );
    if (!tier) {
      console.warn('Skipping: no sub-enterprise credit tier has a configured Stripe price ID in this env');
      return;
    }

    const user = await prisma.user.create({ data: { email: `test-webhook-sub-pro-${Date.now()}@example.com` } });
    userId = user.id;

    await updateUserSubscription(userId, fakeSubscription(tier.priceIds.monthly!));

    const updated = await prisma.user.findUnique({ where: { id: userId } });
    expect(updated?.plan).toBe('pro');
    expect(updated?.monthlyCredits).toBe(tier.credits);
  });

  it("labels a custom tier at/above the enterprise credit threshold as 'enterprise', not always 'pro'", async () => {
    const tier = Object.values(CREDIT_TIER_PRICES).find(
      (t) => t.credits >= PLANS.ENTERPRISE.credits && isPriceIdConfigured(t.priceIds.monthly)
    );
    if (!tier) {
      console.warn('Skipping: no enterprise-scale credit tier has a configured Stripe price ID in this env');
      return;
    }

    const user = await prisma.user.create({ data: { email: `test-webhook-sub-ent-${Date.now()}@example.com` } });
    userId = user.id;

    await updateUserSubscription(userId, fakeSubscription(tier.priceIds.monthly!));

    const updated = await prisma.user.findUnique({ where: { id: userId } });
    expect(updated?.plan).toBe('enterprise');
    expect(updated?.monthlyCredits).toBe(tier.credits);
  });

  it('falls back to the free plan for a completely unrecognized price ID', async () => {
    const user = await prisma.user.create({ data: { email: `test-webhook-sub-unknown-${Date.now()}@example.com` } });
    userId = user.id;

    await updateUserSubscription(userId, fakeSubscription('price_totally_unrecognized'));

    const updated = await prisma.user.findUnique({ where: { id: userId } });
    expect(updated?.plan).toBe('free');
    expect(updated?.monthlyCredits).toBe(PLANS.FREE.credits);
  });
});
