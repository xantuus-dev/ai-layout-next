# Payment System Setup Guide

This guide will help you set up the complete payment system for AI Layout Next with Stripe integration, including all 13 credit tiers with monthly and yearly billing.

## 🎯 What's Been Fixed

The payment system now includes:

- ✅ **13 Dynamic Credit Tiers**: From 8,000 to 1,200,000 credits
- ✅ **Monthly & Yearly Billing**: Automatic 20% discount on yearly plans
- ✅ **Failed Payment Handling**: Automatic tracking and grace period
- ✅ **Plan Upgrades/Downgrades**: Seamless plan changes with proration
- ✅ **Centralized Pricing Config**: Single source of truth for all pricing
- ✅ **Webhook Improvements**: Better error handling and logging

## 📋 Prerequisites

Before starting, ensure you have:

1. A Stripe account (https://dashboard.stripe.com)
2. Node.js and npm installed
3. Database access (PostgreSQL via Supabase)
4. Environment variables configured

## 🚀 Step-by-Step Setup

### Step 1: Update Database Schema

The schema has been updated with new fields. Run the migration:

```bash
# Generate Prisma client
npx prisma generate

# Push schema changes to database (development)
npx prisma db push

# OR create a migration (production-ready)
npx prisma migrate dev --name add_payment_fields
```

New fields added to User model:
- `billingCycle` - tracks if user is on monthly or yearly plan
- `paymentFailed` - boolean flag for failed payments
- `paymentFailedAt` - timestamp of payment failure

### Step 2: Create Stripe Products & Prices

We've created a utility script to automate this process.

#### For Test Mode (Development):

```bash
# Make sure your .env.local has STRIPE_SECRET_KEY with test key (sk_test_...)
npx ts-node scripts/setup-stripe-prices.ts
```

#### For Live Mode (Production):

```bash
# Switch to live Stripe key (sk_live_...)
# Update STRIPE_SECRET_KEY in .env.local
npx ts-node scripts/setup-stripe-prices.ts
```

The script will:
1. Create 13 products in Stripe (one per credit tier)
2. Create 2 prices for each product (monthly + yearly)
3. Output environment variables for you to copy

### Step 3: Add Price IDs to Environment Variables

Copy the output from the script above and add it to `.env.local`:

```env
# Stripe Price IDs (Auto-generated)
NEXT_PUBLIC_STRIPE_8000_MONTHLY_PRICE_ID="price_xxx"
NEXT_PUBLIC_STRIPE_8000_YEARLY_PRICE_ID="price_xxx"
NEXT_PUBLIC_STRIPE_12000_MONTHLY_PRICE_ID="price_xxx"
NEXT_PUBLIC_STRIPE_12000_YEARLY_PRICE_ID="price_xxx"
# ... (all 13 tiers)
```

**Important:**
- Use `NEXT_PUBLIC_` prefix so they're accessible in the browser
- Keep test and live price IDs separate
- Never commit real price IDs to version control

### Step 4: Configure Stripe Webhooks

#### Development (using Stripe CLI):

```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3010/api/stripe/webhook

# Copy the webhook signing secret to .env.local
# STRIPE_WEBHOOK_SECRET="whsec_..."
```

#### Production (Vercel):

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Set URL: `https://your-domain.vercel.app/api/stripe/webhook`
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.trial_will_end`
5. Copy the webhook signing secret
6. Add to Vercel environment variables: `STRIPE_WEBHOOK_SECRET`

### Step 5: Test the Payment Flow

1. **Start Development Server:**
   ```bash
   npm run dev
   ```

2. **Visit Pricing Page:**
   ```
   http://localhost:3010/pricing
   ```

3. **Test Features:**
   - Toggle between monthly/yearly billing
   - Select different credit tiers from dropdown
   - Verify pricing calculations
   - Check that cost per 1K credits is displayed

4. **Test Checkout (Stripe Test Mode):**
   - Use test card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - ZIP: Any 5 digits

5. **Verify Webhook Processing:**
   - Check terminal for webhook logs
   - Verify database updates in Prisma Studio
   - Check user credits were updated

### Step 6: Test Failed Payment Handling

1. In Stripe Dashboard, go to a test subscription
2. Trigger a failed payment:
   - Use test card `4000 0000 0000 0341` (generic decline)
3. Verify:
   - User's `paymentFailed` flag is set to true
   - `paymentFailedAt` timestamp is recorded
   - Console logs show the failure

### Step 7: Test Plan Changes

1. **Subscribe to a plan**
2. **Change credit tier or billing cycle**
3. **Click subscribe again**
4. Verify:
   - Subscription is updated (not duplicated)
   - Proration is calculated correctly
   - Credits are updated immediately
   - User sees success message

## 🏗️ Architecture Overview

### File Structure

```
src/
├── lib/
│   ├── pricing-config.ts      # Central pricing configuration
│   ├── stripe.ts               # Stripe client initialization
│   └── plans.ts                # Base plan definitions
├── app/
│   ├── pricing/
│   │   └── page.tsx           # Pricing page with tier selector
│   └── api/
│       └── stripe/
│           ├── checkout/       # Create checkout sessions
│           ├── webhook/        # Process Stripe events
│           └── portal/         # Customer portal access
└── scripts/
    └── setup-stripe-prices.ts  # Automated Stripe setup
```

### Key Components

1. **Pricing Config (`src/lib/pricing-config.ts`)**
   - Single source of truth for all pricing
   - Maps credit tiers to Stripe price IDs
   - Helper functions for price lookups

2. **Pricing Page (`src/app/pricing/page.tsx`)**
   - Dynamic tier selection
   - Monthly/yearly toggle
   - Real-time price calculations
   - Smart error handling

3. **Checkout API (`src/app/api/stripe/checkout/route.ts`)**
   - Creates new subscriptions
   - Updates existing subscriptions (plan changes)
   - Handles proration automatically

4. **Webhook Handler (`src/app/api/stripe/webhook/route.ts`)**
   - Processes all Stripe events
   - Updates user subscriptions
   - Handles failed payments
   - Prevents duplicate processing

## 🔍 Troubleshooting

### Issue: "Pricing is not fully configured"

**Cause:** Missing Stripe price IDs in environment variables

**Solution:**
1. Run `scripts/setup-stripe-prices.ts`
2. Copy all price IDs to `.env.local`
3. Restart dev server

### Issue: Webhook signature verification failed

**Cause:** Wrong webhook secret

**Solution:**
1. Development: Use secret from `stripe listen` output
2. Production: Use secret from Stripe Dashboard webhook settings
3. Ensure secret starts with `whsec_`

### Issue: Subscription not updating

**Cause:** Webhook not being received

**Solution:**
1. Check webhook endpoint is accessible
2. Verify events are being sent (Stripe Dashboard → Webhooks)
3. Check server logs for errors
4. Ensure webhook secret is correct

### Issue: Credits not updating after payment

**Cause:** Webhook event not processed or price ID not recognized

**Solution:**
1. Check webhook logs for errors
2. Verify price ID is in `pricing-config.ts`
3. Check `WebhookEvent` table for processing status
4. Manually trigger webhook in Stripe Dashboard

## 📊 Monitoring & Analytics

### Check Webhook Processing

```bash
# Open Prisma Studio
npx prisma studio

# Check WebhookEvent table
# - eventId: Stripe event ID
# - processed: true/false
# - eventType: Type of webhook
# - payload: Full event data
```

### Check Subscription Status

```sql
-- In Prisma Studio or database client
SELECT
  email,
  plan,
  monthlyCredits,
  billingCycle,
  stripeSubscriptionId,
  paymentFailed,
  paymentFailedAt
FROM "User"
WHERE plan != 'free';
```

### Stripe Dashboard

Monitor in Stripe Dashboard:
- Payments → Overview: Revenue and payment trends
- Subscriptions: Active subscriptions and MRR
- Customers: Customer details and payment methods
- Webhooks: Delivery status and retries

## 🚀 Production Deployment Checklist

- [ ] Run `setup-stripe-prices.ts` with LIVE Stripe key
- [ ] Add all LIVE price IDs to Vercel environment variables
- [ ] Set up production webhook in Stripe Dashboard
- [ ] Add `STRIPE_WEBHOOK_SECRET` (live) to Vercel
- [ ] Run database migration: `npx prisma migrate deploy`
- [ ] Update OAuth redirect URIs to production domain
- [ ] Test checkout with real card (refund immediately)
- [ ] Verify webhook delivery in Stripe Dashboard
- [ ] Test plan upgrade/downgrade flow
- [ ] Set up monitoring and alerts
- [ ] Document for team

## 🔐 Security Best Practices

1. **Never expose secret keys:**
   - Use `NEXT_PUBLIC_` only for client-safe values (price IDs)
   - Keep `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` server-side only

2. **Verify webhook signatures:**
   - Always validate webhook signatures (already implemented)
   - Don't process webhooks without verification

3. **Implement idempotency:**
   - Already implemented via `WebhookEvent` table
   - Prevents duplicate processing

4. **Use test mode for development:**
   - Always use test keys in development
   - Never test with real cards in development

## 📧 Email Notifications (Future Enhancement)

Currently logged but not sent:
- Payment failed
- Trial ending soon
- Subscription canceled
- Plan changed

To implement, add email service (SendGrid, Resend, etc.) and update webhook handler.

## 🎯 Next Steps

1. Test the complete flow end-to-end
2. Set up email notifications (optional)
3. Add analytics tracking
4. Create admin dashboard for subscription management
5. Implement credit top-up feature (one-time purchases)
6. Add team/organization billing

## 📚 Additional Resources

- [Stripe API Documentation](https://stripe.com/docs/api)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review Stripe Dashboard logs
3. Check application logs
4. Verify environment variables
5. Test with Stripe CLI locally

---

**Last Updated:** January 2026
**Version:** 2.0.0
