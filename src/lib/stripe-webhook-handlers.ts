import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { PLANS, getPlanByPriceId } from '@/lib/stripe';
import { getPriceTierByPriceId, getBillingCycleFromPriceId } from '@/lib/pricing-config';

/**
 * Grant a one-time credit pack purchase to a user.
 *
 * Implemented as a decrement of `creditsUsed` (which can go negative to
 * "bank" headroom) rather than an increment of `monthlyCredits`, because
 * `monthlyCredits` is the recurring plan cap and is never reset — raising
 * it would turn a one-time purchase into a permanent plan upgrade.
 * Consequence: purchased credits are consumed before the user's next
 * monthly reset (which zeroes `creditsUsed`) and do not roll over.
 */
export async function grantPurchasedCredits(userId: string | undefined, creditsMeta: string | undefined) {
  const credits = parseInt(creditsMeta || '0', 10);

  if (!userId || !credits || credits <= 0) {
    console.error(`Cannot grant credits: missing/invalid userId or credits (userId=${userId}, credits=${creditsMeta})`);
    return;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { creditsUsed: { decrement: credits } },
    }),
    prisma.usageRecord.create({
      data: {
        userId,
        type: 'credit_purchase',
        credits: -credits, // negative = credits added, not consumed
        metadata: { source: 'stripe_one_time_purchase' },
      },
    }),
  ]);

  console.log(`Granted ${credits} purchased credits to user ${userId}`);
}

export async function updateUserSubscription(
  userId: string | undefined,
  subscription: Stripe.Subscription
) {
  if (!userId) {
    // Try to find user by Stripe customer ID or subscription ID
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { stripeCustomerId: subscription.customer as string },
          { stripeSubscriptionId: subscription.id },
        ],
      },
    });

    if (!user) {
      console.error(`Cannot update subscription: User not found for subscription ${subscription.id}`);
      return;
    }

    userId = user.id;
  }

  const priceId = subscription.items.data[0].price.id;

  // First check if this is a custom pricing tier
  const priceTier = getPriceTierByPriceId(priceId);
  const billingCycle = getBillingCycleFromPriceId(priceId);

  if (priceTier) {
    // Custom pricing tier from CREDIT_TIER_PRICES (the granular /pricing
    // catalog). `plan` here is only a coarse badge for UI/RevenueCat-style
    // comparisons — `monthlyCredits` (below) is the actual source of truth
    // for limits everywhere. Label as 'enterprise' once a tier matches or
    // exceeds the enterprise credit threshold, rather than always 'pro'.
    const planLabel = priceTier.credits >= PLANS.ENTERPRISE.credits ? 'enterprise' : 'pro';

    await prisma.user.update({
      where: { id: userId },
      data: {
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        stripeCurrentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        plan: planLabel,
        monthlyCredits: priceTier.credits,
        billingCycle: billingCycle || 'monthly',
      },
    });

    console.log(`Updated user ${userId} to ${planLabel} plan (${billingCycle}) with ${priceTier.credits} credits`);
    return;
  }

  // Fall back to standard plan lookup
  const plan = getPlanByPriceId(priceId);

  if (!plan) {
    console.error(`Unknown price ID: ${priceId}, defaulting to free plan`);
    await prisma.user.update({
      where: { id: userId },
      data: {
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        stripeCurrentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        plan: 'free',
        monthlyCredits: PLANS.FREE.credits,
      },
    });
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      stripeCurrentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      plan: plan.id,
      monthlyCredits: plan.credits,
    },
  });

  console.log(`Updated user ${userId} to plan ${plan.id} with ${plan.credits} credits`);
}
