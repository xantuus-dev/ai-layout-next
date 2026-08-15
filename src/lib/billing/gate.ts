/**
 * Billing Gate — the single server-side check every billable path should pass
 * through, and a race-free way to spend against it.
 *
 * This module is ADDITIVE. It does not modify lib/credits.ts, which continues
 * to serve production unchanged. It exists so quota logic can be consolidated
 * and hardened incrementally, one caller at a time, instead of in one risky
 * cutover across 16 call sites.
 *
 * Two defects in the existing path motivated it, both reproduced in
 * tests/unit/billing-gate.test.ts:
 *
 * 1. Exhausted-balance boundary. lib/credits.ts exports `canAfford`, written
 *    specifically to fix `used + 0 <= monthly` being true at exactly the limit,
 *    but `hasEnoughCredits` still evaluates the original expression, so the fix
 *    never reaches callers. This module routes every check through canAfford.
 *
 * 2. Check-then-act race. `deductCredits` reads the balance, then increments in
 *    a separate statement. Two concurrent requests can both observe enough
 *    headroom and both increment, overdrawing the pool. `spendCredits` below
 *    puts the guard inside the UPDATE so the database arbitrates.
 */

import { prisma } from '@/lib/prisma';
import {
  canAfford,
  resolveBillingUserId,
  checkAndResetCredits,
  checkUsageAlerts,
} from '@/lib/credits';

/**
 * Fraction of remaining balance above which a spend should be confirmed by the
 * user before it runs, rather than silently consuming most of what is left.
 */
export const CONFIRMATION_THRESHOLD = 0.25;

export type DenyReason =
  | 'insufficient_credits'
  | 'viewer_cannot_spend'
  | 'user_not_found';

export interface SpendDecision {
  allowed: boolean;
  /** Credits left in the pool this period. Can be negative if overdrawn. */
  remaining: number;
  limit: number;
  estimate: number;
  /**
   * True when the estimate exceeds CONFIRMATION_THRESHOLD of what remains.
   * Callers should surface a confirmation prompt rather than proceeding.
   */
  requiresConfirmation: boolean;
  reason?: DenyReason;
  /** The pool actually charged — the team billing owner, or the user. */
  billingUserId: string;
}

/**
 * Team members with the "viewer" role may read shared workspace content but
 * may not spend the pool. Mirrors the rule in lib/credits.ts so both paths
 * agree while they coexist.
 */
async function canConsumeCredits(userId: string, billingUserId: string): Promise<boolean> {
  if (billingUserId === userId) return true;

  const ownerDefaultWorkspace = await prisma.workspace.findFirst({
    where: { userId: billingUserId, isDefault: true },
    select: { id: true },
  });
  if (!ownerDefaultWorkspace) return true;

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: ownerDefaultWorkspace.id, userId } },
  });

  return member?.role !== 'viewer';
}

/**
 * Decide whether `userId` may spend `estimatedCredits`, without spending them.
 *
 * Advisory only: the balance can change between this call and the spend, which
 * is exactly why spendCredits() re-checks atomically. Use this for pre-flight
 * UX (estimates, confirmation prompts, clear refusals), never as the sole
 * guard on a billable action.
 */
export async function assertCanSpend(
  userId: string,
  estimatedCredits: number
): Promise<SpendDecision> {
  const billingUserId = await resolveBillingUserId(userId);

  const user = await prisma.user.findUnique({
    where: { id: billingUserId },
    select: { creditsUsed: true, monthlyCredits: true },
  });

  if (!user) {
    return {
      allowed: false,
      remaining: 0,
      limit: 0,
      estimate: estimatedCredits,
      requiresConfirmation: false,
      reason: 'user_not_found',
      billingUserId,
    };
  }

  const remaining = user.monthlyCredits - user.creditsUsed;
  const base = {
    remaining,
    limit: user.monthlyCredits,
    estimate: estimatedCredits,
    billingUserId,
  };

  if (!(await canConsumeCredits(userId, billingUserId))) {
    return { ...base, allowed: false, requiresConfirmation: false, reason: 'viewer_cannot_spend' };
  }

  if (!canAfford(user.creditsUsed, user.monthlyCredits, estimatedCredits)) {
    return { ...base, allowed: false, requiresConfirmation: false, reason: 'insufficient_credits' };
  }

  return {
    ...base,
    allowed: true,
    // Only meaningful with headroom left; a non-positive remainder would make
    // every spend "significant" and the prompt meaningless.
    requiresConfirmation: remaining > 0 && estimatedCredits > remaining * CONFIRMATION_THRESHOLD,
  };
}

export class InsufficientCreditsError extends Error {
  constructor(message = 'Insufficient credits') {
    super(message);
    this.name = 'InsufficientCreditsError';
  }
}

/**
 * Spend credits atomically.
 *
 * The affordability guard lives inside the UPDATE's WHERE clause, so two
 * concurrent callers competing for the last credit are serialised by Postgres:
 * exactly one UPDATE matches a row, the other matches none and throws. A
 * read-then-write sequence cannot provide that, however tight the window.
 *
 * The guard uses GREATEST(1, cost) to match canAfford's semantics — a spend
 * always requires at least one credit of headroom — while the increment
 * applies the true cost, so a zero-cost action is not silently billed.
 */
export async function spendCredits(
  userId: string,
  credits: number,
  metadata: {
    type: string;
    model?: string;
    tokens?: number;
    description?: string;
    extra?: Record<string, unknown>;
  }
): Promise<{ success: true; creditsSpent: number; billingUserId: string }> {
  // Drop-in parity with deductCredits: it rolls the monthly window first and
  // fires the 80%/100% alert emails afterwards. Omitting either here would
  // silently regress billing behaviour when callers switch over.
  await checkAndResetCredits(userId);

  const billingUserId = await resolveBillingUserId(userId);

  if (!(await canConsumeCredits(userId, billingUserId))) {
    throw new InsufficientCreditsError('Viewers cannot spend the team credit pool');
  }

  const required = Math.max(1, credits);

  await prisma.$transaction(async (tx) => {
    const rowsUpdated = await tx.$executeRaw`
      UPDATE "User"
      SET "creditsUsed" = "creditsUsed" + ${credits}
      WHERE "id" = ${billingUserId}
        AND "creditsUsed" + ${required} <= "monthlyCredits"
    `;

    // Zero rows means the WHERE guard rejected it: another transaction took the
    // headroom first, or there was never enough. Throwing rolls back the
    // usage row alongside it.
    if (rowsUpdated === 0) {
      throw new InsufficientCreditsError();
    }

    await tx.usageRecord.create({
      data: {
        userId,
        type: metadata.type,
        model: metadata.model,
        tokens: metadata.tokens || 0,
        credits,
        metadata: {
          description: metadata.description,
          ...metadata.extra,
          ...(billingUserId !== userId ? { billedTo: billingUserId } : {}),
        },
      },
    });
  });

  // After the commit, matching deductCredits. Never throws — a flaky email
  // send must not fail a spend that already succeeded.
  await checkUsageAlerts(billingUserId);

  return { success: true, creditsSpent: credits, billingUserId };
}

export type RefundReason =
  | 'run_failed'
  | 'run_timeout'
  | 'provider_error'
  | 'user_flagged'
  | 'admin_adjustment';

/**
 * Refund a prior spend.
 *
 * The original usage row is never mutated — an offsetting row with negative
 * credits is appended instead, so the ledger stays append-only and the history
 * of what actually happened survives. `creditsUsed` decrements to match, and is
 * allowed to go negative: banked credits are represented that way already.
 */
export async function refundCredits(
  userId: string,
  credits: number,
  reason: RefundReason,
  metadata?: { runId?: string; description?: string }
): Promise<{ success: true; creditsRefunded: number }> {
  if (credits <= 0) {
    throw new Error('Refund amount must be positive');
  }

  const billingUserId = await resolveBillingUserId(userId);

  await prisma.$transaction([
    prisma.usageRecord.create({
      data: {
        userId,
        type: 'refund',
        credits: -credits,
        tokens: 0,
        metadata: {
          reason,
          runId: metadata?.runId,
          description: metadata?.description,
          ...(billingUserId !== userId ? { billedTo: billingUserId } : {}),
        },
      },
    }),
    prisma.user.update({
      where: { id: billingUserId },
      data: { creditsUsed: { decrement: credits } },
    }),
  ]);

  return { success: true, creditsRefunded: credits };
}
