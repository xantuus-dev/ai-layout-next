-- The ongoing free tier is replaced by a 14-day card-required Stripe trial,
-- and a $29.95 / 4,000-credit entry plan becomes the tier trials convert into.
-- See TRIAL_PERIOD_DAYS / TRIAL_DAILY_CREDITS in src/lib/plans.ts.

-- Trial bookkeeping. trialEndsAt mirrors the Stripe subscription's trial_end
-- so the app can gate without a Stripe round trip; hasUsedTrial stops a
-- customer cancelling on day 13 and starting a fresh trial indefinitely.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trialEndsAt"  TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hasUsedTrial" BOOLEAN NOT NULL DEFAULT false;

-- A new account now has no allowance until it starts a trial or subscribes.
ALTER TABLE "User" ALTER COLUMN "monthlyCredits" SET DEFAULT 0;

-- Existing free accounts are not cut off mid-session. They get a 14-day
-- grandfathered trial at the daily grant, with no Stripe subscription behind
-- it — checkAndResetCredits() expires them app-side when it elapses, which is
-- exactly the case the app-side backstop exists for.
--
-- hasUsedTrial is deliberately left false: this courtesy window should not
-- consume the real card-required trial they can still take at checkout.
--
-- creditsUsed is clamped with LEAST(..., 0) rather than zeroed so banked
-- headroom from credit-pack purchases and referral awards (stored as a
-- NEGATIVE creditsUsed) survives the migration instead of being erased.
UPDATE "User"
SET
  "plan"           = 'trial',
  "monthlyCredits" = 300,
  "creditsUsed"    = LEAST("creditsUsed", 0),
  "creditsResetAt" = date_trunc('day', now() AT TIME ZONE 'UTC') + interval '1 day',
  "trialEndsAt"    = now() + interval '14 days'
WHERE (lower("plan") = 'free' OR "plan" IS NULL)
  AND "stripeSubscriptionId" IS NULL;

-- Accounts labelled free but carrying a live subscription are a data
-- inconsistency, not free users: leave their subscription alone and let the
-- next Stripe webhook restate their real entitlement.
