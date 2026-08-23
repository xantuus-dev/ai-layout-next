import { prisma } from '@/lib/prisma';
import { sendTrialEndingEmail } from '@/lib/email';
import { CREDIT_TIER_PRICES, ENTRY_TIER_CREDITS } from '@/lib/pricing-config';

/** How many days before the intro period ends the notice goes out. */
export const TRIAL_NOTICE_LEAD_DAYS = 3;

export interface TrialNoticeResult {
  candidates: number;
  sent: number;
  failed: number;
}

/**
 * Email customers whose $9.95 intro period is about to renew at full price.
 *
 * This exists because the intro offer is a real subscription rather than a
 * Stripe trial (see INTRO_TRIAL in pricing-config.ts), so Stripe never emits
 * `customer.subscription.trial_will_end` for it. The pricing page promises
 * "we'll email you three days before"; without this job that promise would be
 * unbacked — the same class of defect as advertising a daily credit refresh
 * that nothing granted.
 *
 * Idempotent: `trialEndingEmailSentAt` is stamped on success, and accounts
 * already stamped are excluded, so re-running the cron cannot re-send. A send
 * that fails is left unstamped and retried on the next run.
 */
export async function sendExpiringTrialNotices(now: Date = new Date()): Promise<TrialNoticeResult> {
  const cutoff = new Date(now.getTime() + TRIAL_NOTICE_LEAD_DAYS * 24 * 60 * 60 * 1000);

  const expiring = await prisma.user.findMany({
    where: {
      plan: 'trial',
      trialEndsAt: { not: null, gt: now, lte: cutoff },
      trialEndingEmailSentAt: null,
      email: { not: null },
    },
    select: { id: true, email: true, name: true, trialEndsAt: true },
  });

  const tier = CREDIT_TIER_PRICES[String(ENTRY_TIER_CREDITS)];
  const amount = `$${tier.monthlyPrice.toFixed(2)}/month`;
  const billingUrl = `${process.env.NEXTAUTH_URL}/settings/billing`;

  let sent = 0;
  let failed = 0;

  for (const user of expiring) {
    // Narrowed by the query, but the types don't know that.
    if (!user.email || !user.trialEndsAt) continue;

    const result = await sendTrialEndingEmail({
      to: user.email,
      name: user.name,
      trialEndsAt: user.trialEndsAt,
      amount,
      billingUrl,
    });

    if (result.sent) {
      // Stamped only on success, so an outage retries tomorrow rather than
      // silently swallowing the customer's only notice before a charge.
      await prisma.user.update({
        where: { id: user.id },
        data: { trialEndingEmailSentAt: new Date() },
      });
      sent++;
    } else {
      failed++;
    }
  }

  return { candidates: expiring.length, sent, failed };
}
