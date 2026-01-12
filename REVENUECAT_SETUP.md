# RevenueCat Setup Guide

This guide will help you set up RevenueCat as your subscription management platform with Stripe integration.

## What is RevenueCat?

RevenueCat is a subscription management platform that sits between your app and payment providers (like Stripe). It provides:

- **Unified API** for subscription management across platforms
- **Webhook handling** for subscription events
- **Customer management** with entitlements
- **Analytics** and subscription metrics
- **Server-side receipt validation**
- **Cross-platform support** (Web, iOS, Android)

## Prerequisites

- Stripe account with products configured
- Access to your app's deployment URL for webhooks

## Step 1: Create RevenueCat Account

1. Go to [https://app.revenuecat.com](https://app.revenuecat.com)
2. Sign up for a free account
3. Create a new project for your application

## Step 2: Connect Stripe to RevenueCat

1. In RevenueCat dashboard, go to **Project Settings** → **Integrations**
2. Find **Stripe** and click **Connect**
3. Authorize RevenueCat to access your Stripe account
4. Select the Stripe account you want to connect

## Step 3: Create Products and Entitlements

### Create Entitlements

Entitlements represent what users get access to:

1. Go to **Entitlements** in RevenueCat dashboard
2. Click **+ New Entitlement**
3. Create two entitlements:
   - **pro**: Pro plan features
   - **enterprise**: Enterprise plan features

### Create Products

Products link to your Stripe prices:

1. Go to **Products** in RevenueCat dashboard
2. Click **+ New Product**
3. Create **pro_monthly**:
   - Product ID: `pro_monthly`
   - Display name: "Pro Monthly"
   - Select Stripe price: Choose your Pro plan Stripe price
   - Attach entitlement: `pro`
4. Create **enterprise_monthly**:
   - Product ID: `enterprise_monthly`
   - Display name: "Enterprise Monthly"
   - Select Stripe price: Choose your Enterprise plan Stripe price
   - Attach entitlement: `enterprise`

## Step 4: Get API Keys

1. Go to **Project Settings** → **API Keys**
2. Copy the following keys:
   - **Public Key** (starts with `rc_...`) → `NEXT_PUBLIC_REVENUECAT_PUBLIC_KEY`
   - **Secret Key** (starts with `sk_...`) → `REVENUECAT_SECRET_KEY`

## Step 5: Configure Webhooks

### Create Webhook in RevenueCat

1. Go to **Project Settings** → **Webhooks**
2. Click **+ Add Webhook**
3. Enter webhook URL: `https://your-domain.com/api/revenuecat/webhook`
4. Select all event types or specific ones:
   - INITIAL_PURCHASE
   - RENEWAL
   - CANCELLATION
   - EXPIRATION
   - BILLING_ISSUE
   - PRODUCT_CHANGE
5. Copy the **Webhook Secret** → `REVENUECAT_WEBHOOK_SECRET`

### Configure Stripe Webhook (if not already done)

RevenueCat will handle most webhook events, but you may want to keep your existing Stripe webhook for redundancy:

1. Keep your existing Stripe webhook at `/api/stripe/webhook`
2. Both webhooks can coexist

## Step 6: Update Environment Variables

Add the following to your `.env.local` file:

```env
# RevenueCat
NEXT_PUBLIC_REVENUECAT_PUBLIC_KEY=rc_your_public_key_here
REVENUECAT_SECRET_KEY=sk_your_secret_key_here
REVENUECAT_WEBHOOK_SECRET=your_webhook_secret_here
```

## Step 7: Verify Integration

### Test Webhook Endpoint

Test that your webhook endpoint is accessible:

```bash
curl https://your-domain.com/api/revenuecat/webhook
```

You should get:
```json
{
  "message": "RevenueCat webhook endpoint",
  "status": "active"
}
```

### Test Checkout Flow

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `/pricing`
3. Click on a paid plan (Pro or Enterprise)
4. Complete the Stripe checkout
5. Verify in RevenueCat dashboard that:
   - Customer was created
   - Subscription is active
   - Entitlement was granted

### Verify Database Updates

After a successful purchase, check your database:

```sql
SELECT
  email,
  plan,
  revenueCatUserId,
  monthlyCredits,
  stripeCurrentPeriodEnd
FROM "User"
WHERE email = 'test@example.com';
```

You should see:
- `plan` updated to 'pro' or 'enterprise'
- `revenueCatUserId` populated with user ID
- `monthlyCredits` set to plan amount (50000 for Pro, 500000 for Enterprise)
- `stripeCurrentPeriodEnd` set to subscription end date

## How It Works

### Architecture

```
User → Frontend → RevenueCat Checkout API → Stripe Checkout
                                                ↓
                                        Payment Success
                                                ↓
                    RevenueCat ← Stripe Webhook Event
                         ↓
            Your App ← RevenueCat Webhook
                         ↓
                Database Update (Plan, Credits)
```

### User Flow

1. **User clicks subscribe** on pricing page
2. **Frontend calls** `/api/revenuecat/checkout`
3. **Backend creates** Stripe checkout with RevenueCat metadata
4. **User completes** payment on Stripe
5. **Stripe notifies** RevenueCat via webhook
6. **RevenueCat processes** event and determines entitlements
7. **RevenueCat notifies** your app via webhook
8. **Your app updates** database with plan and credits

### Subscription Events

Your webhook handler (`/api/revenuecat/webhook/route.ts`) processes these events:

- **INITIAL_PURCHASE**: User subscribes for first time
  - Grants entitlement (pro/enterprise)
  - Updates user plan in database
  - Sets monthly credits

- **RENEWAL**: Subscription renews
  - Resets credits to monthly allowance
  - Updates expiration date

- **CANCELLATION**: User cancels subscription
  - Maintains access until period end

- **EXPIRATION**: Subscription expires
  - Downgrades to free plan
  - Reduces credits to free tier (1000)

- **BILLING_ISSUE**: Payment failed
  - Logs warning for manual intervention

- **PRODUCT_CHANGE**: User upgrades/downgrades
  - Updates plan and credits accordingly

## Testing in Development

### Test with Stripe Test Mode

1. Use Stripe test cards:
   - Success: `4242 4242 4242 4242`
   - Requires authentication: `4000 0025 0000 3155`

2. Use any future expiration date (e.g., `12/34`)
3. Use any 3-digit CVC (e.g., `123`)

### Simulate Webhook Events

Use RevenueCat's test mode to trigger webhook events:

1. Go to RevenueCat dashboard → **Customers**
2. Find a test customer
3. Click **Send Test Event**
4. Select event type (RENEWAL, CANCELLATION, etc.)
5. Verify your webhook receives and processes the event

## Production Deployment

### Checklist

- [ ] RevenueCat account in production mode
- [ ] Stripe connected in live mode
- [ ] Products and entitlements configured
- [ ] Webhook URL points to production domain
- [ ] Environment variables set in production:
  - `NEXT_PUBLIC_REVENUECAT_PUBLIC_KEY`
  - `REVENUECAT_SECRET_KEY`
  - `REVENUECAT_WEBHOOK_SECRET`
- [ ] Webhook signature verification enabled
- [ ] Test a real subscription in production

### Security Notes

1. **Webhook Verification**: Always verify webhook signatures in production
2. **Secret Keys**: Never expose `REVENUECAT_SECRET_KEY` to frontend
3. **HTTPS**: Only use HTTPS for webhook URLs
4. **Rate Limiting**: Consider rate limiting the webhook endpoint

## Monitoring

### RevenueCat Dashboard

Monitor in real-time:
- Active subscriptions
- Revenue metrics
- Churn rate
- Trial conversions

### Your Application

Track in your database:
- User plan distribution
- Credit usage patterns
- Subscription lifecycle events

## Troubleshooting

### Webhook Not Receiving Events

1. Check webhook URL is accessible publicly
2. Verify webhook is configured in RevenueCat dashboard
3. Check webhook signature verification isn't failing
4. Review server logs for errors

### User Plan Not Updating

1. Verify webhook received the event (check logs)
2. Check user lookup logic (revenueCatUserId matching)
3. Verify entitlement IDs match ('pro', 'enterprise')
4. Check database constraints and permissions

### Credits Not Resetting

1. Verify RENEWAL event is being processed
2. Check `creditsUsed` reset logic in webhook handler
3. Verify `creditsResetAt` timestamp is updating

## Support

- RevenueCat Docs: [https://docs.revenuecat.com](https://docs.revenuecat.com)
- RevenueCat Support: [https://app.revenuecat.com/settings/support](https://app.revenuecat.com/settings/support)
- Stripe Docs: [https://stripe.com/docs](https://stripe.com/docs)

## Summary

You now have a complete subscription management system with:
- RevenueCat managing subscriptions across platforms
- Stripe processing payments
- Automatic database updates via webhooks
- Plan-based credit allocation
- Usage tracking and limits

The integration is production-ready and scales to support mobile apps (iOS/Android) in the future without changing your backend logic.
