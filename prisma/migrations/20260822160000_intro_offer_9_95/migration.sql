-- The $9.95 / 14-day introductory offer replaces the free 14-day trial.
-- See INTRO_TRIAL in src/lib/pricing-config.ts.
--
-- The offer is a real subscription on a 14-day price, billed immediately,
-- with a Stripe subscription schedule transitioning it to the monthly entry
-- tier. It is NOT a Stripe trial, so subscription.status is 'active' and
-- Stripe never emits customer.subscription.trial_will_end for it — the
-- expiry notice is sent by lib/billing/trial-notices.ts instead, and this
-- column is what stops that daily job re-sending it.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trialEndingEmailSentAt" TIMESTAMP(3);
