import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { PLANS, getPlanByPriceId } from '@/lib/stripe';
import { TRIAL_DAILY_CREDITS } from '@/lib/plans';
import {
  getPriceTierByPriceId,
  getBillingCycleFromPriceId,
  isIntroTrialPriceId,
  getIntroTrialTargetPriceId,
  INTRO_TRIAL,
} from '@/lib/pricing-config';
import { syncSeatsFromSubscription } from '@/lib/organization';

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

/**
 * Make a $9.95 / 14-day intro subscription convert to the monthly entry tier.
 *
 * The intro offer is a genuine subscription on a 14-day price, so left alone
 * it would simply renew at $9.95 every fortnight forever. This attaches a
 * subscription schedule: phase one is the 14 days the customer just bought,
 * phase two is the monthly entry price, running indefinitely.
 *
 * Failure is deliberately non-fatal. If the schedule cannot be created the
 * customer keeps exactly what they paid for and simply does not auto-convert
 * — they renew at the intro price until someone intervenes. That is the safe
 * direction to fail: it under-charges rather than over-charges, and it never
 * blocks access. It is logged as an error because it does need fixing.
 */
export async function ensureIntroTrialConverts(
  stripeClient: Stripe,
  subscription: Stripe.Subscription
): Promise<void> {
  const item = subscription.items.data[0];
  if (!item || !isIntroTrialPriceId(item.price.id)) return;

  // Already scheduled (e.g. a webhook redelivery) — nothing to do.
  if (subscription.schedule) {
    console.log(`Subscription ${subscription.id} already has a schedule; skipping intro conversion setup`);
    return;
  }

  const targetPriceId = getIntroTrialTargetPriceId('monthly');
  if (!targetPriceId) {
    console.error(
      `Cannot convert intro offer for subscription ${subscription.id}: no monthly price configured ` +
      `for the ${INTRO_TRIAL.convertsToCredits}-credit tier (NEXT_PUBLIC_STRIPE_4000_MONTHLY_PRICE_ID).`
    );
    return;
  }

  try {
    const schedule = await stripeClient.subscriptionSchedules.create({
      from_subscription: subscription.id,
    });

    const currentPhase = schedule.phases[0];

    await stripeClient.subscriptionSchedules.update(schedule.id, {
      // Hand the subscription back to normal billing once phase two starts,
      // so the customer portal can manage it like any other subscription.
      end_behavior: 'release',
      phases: [
        {
          items: [{ price: item.price.id, quantity: item.quantity ?? 1 }],
          start_date: currentPhase.start_date,
          end_date: currentPhase.end_date,
        },
        {
          // No end_date or iterations: runs indefinitely at the monthly price.
          items: [{ price: targetPriceId, quantity: item.quantity ?? 1 }],
        },
      ],
    });

    console.log(
      `Scheduled subscription ${subscription.id} to convert from the $${INTRO_TRIAL.price} ` +
      `${INTRO_TRIAL.days}-day offer to ${targetPriceId} after the intro period`
    );
  } catch (error) {
    console.error(`Failed to schedule intro-offer conversion for ${subscription.id}:`, error);
  }
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

  // Mirror the seat count Stripe is actually billing for. Done before the
  // plan branches below so it applies to both custom tiers and standard plans.
  // Stripe is authoritative here: it is what the customer pays for, so a local
  // seat count that disagrees is always the one that is wrong.
  //
  // Failure must not abort the handler — seats are metadata, whereas the plan
  // and credit updates below are the customer's actual entitlement.
  try {
    await syncSeatsFromSubscription({
      ownerId: userId,
      quantity: subscription.items.data[0].quantity ?? 1,
    });
  } catch (error) {
    console.error(`Failed to sync seats for user ${userId}:`, error);
  }

  // Trial entitlement is keyed off the PRICE, not subscription.status.
  //
  // The $9.95 intro offer is a real paid subscription, so Stripe reports it
  // as 'active' — testing for 'trialing' would silently miss every intro
  // customer and hand them the full monthly allowance on day one. The
  // 'trialing' check is still honoured for any zero-cost Stripe trial.
  const onIntroOffer = isIntroTrialPriceId(priceId);
  const isTrialing = onIntroOffer || subscription.status === 'trialing';

  // For the intro offer the period end IS the trial end: it is what the
  // customer bought. For a classic Stripe trial, use trial_end.
  const trialEndsAt = onIntroOffer
    ? new Date((subscription as any).current_period_end * 1000)
    : subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : null;

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, creditsUsed: true },
  });

  // Converting off a trial restarts the billing period explicitly. Without
  // this the account would still be carrying the trial's next-midnight reset
  // date, so its first paid month would end within a day of starting.
  const convertingFromTrial = existing?.plan === 'trial' && !isTrialing;
  const periodRestart = convertingFromTrial
    ? {
        creditsResetAt: new Date(),
        // Spent trial allowance is cleared; banked credits from a purchased
        // pack are the customer's and carry into the paid plan.
        creditsUsed: Math.min(existing?.creditsUsed ?? 0, 0),
      }
    : {};

  // Entitlement during a trial, shared by every plan branch below.
  const trialEntitlement = {
    plan: 'trial',
    monthlyCredits: TRIAL_DAILY_CREDITS,
    trialEndsAt,
    // Never granted twice — see the hasUsedTrial check in the checkout route.
    hasUsedTrial: true,
  };

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
        billingCycle: billingCycle || 'monthly',
        ...(isTrialing
          ? trialEntitlement
          : { plan: planLabel, monthlyCredits: priceTier.credits, ...periodRestart }),
      },
    });

    console.log(
      isTrialing
        ? `User ${userId} started a trial on the ${priceTier.credits}-credit tier (${TRIAL_DAILY_CREDITS} credits/day until ${trialEndsAt?.toISOString()})`
        : `Updated user ${userId} to ${planLabel} plan (${billingCycle}) with ${priceTier.credits} credits`
    );
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
      ...(isTrialing
        ? trialEntitlement
        : { plan: plan.id, monthlyCredits: plan.credits, ...periodRestart }),
    },
  });

  console.log(
    isTrialing
      ? `User ${userId} started a trial on plan ${plan.id}`
      : `Updated user ${userId} to plan ${plan.id} with ${plan.credits} credits`
  );
}
