-- Free tier moves from a 4,000-credit monthly pool to a 300-credit daily
-- refresh, which is what the pricing page has always advertised but nothing
-- implemented. See FREE_DAILY_CREDITS in src/lib/plans.ts and
-- checkAndResetCredits() in src/lib/credits.ts.

-- New accounts: the default allowance is now the daily free grant.
ALTER TABLE "User" ALTER COLUMN "monthlyCredits" SET DEFAULT 300;

-- Existing free accounts: move them onto the daily allowance and clock.
--
-- creditsUsed is clamped with LEAST(..., 0) rather than set to 0 so that
-- banked headroom from credit-pack purchases and referral awards (stored as
-- a NEGATIVE creditsUsed) survives the migration instead of being erased.
--
-- creditsResetAt is set to the next UTC midnight so the first daily refresh
-- lands on schedule. Accounts missed here still self-heal: checkAndResetCredits
-- treats any reset date beyond tomorrow's midnight as due immediately.
UPDATE "User"
SET
  "monthlyCredits"  = 300,
  "creditsUsed"     = LEAST("creditsUsed", 0),
  "creditsResetAt"  = date_trunc('day', now() AT TIME ZONE 'UTC') + interval '1 day'
WHERE lower("plan") = 'free'
   OR "plan" IS NULL;
