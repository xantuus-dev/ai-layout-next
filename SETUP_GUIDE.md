# Xantuus AI - Full Integration Setup Guide

Complete guide to setting up your pricing, billing, and usage tracking system with Stripe and PostgreSQL.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Database Setup](#database-setup)
3. [Stripe Setup](#stripe-setup)
4. [Environment Configuration](#environment-configuration)
5. [Database Migration](#database-migration)
6. [Stripe Webhook Configuration](#stripe-webhook-configuration)
7. [Testing](#testing)

## Prerequisites

All dependencies have been installed:
- ✅ Next.js 14
- ✅ Prisma ORM
- ✅ Stripe SDK
- ✅ shadcn/ui components
- ✅ Recharts for analytics
- ✅ NextAuth.js with Prisma adapter

## Database Setup

### Option 1: Local PostgreSQL

1. Install PostgreSQL:
   ```bash
   # macOS
   brew install postgresql@15
   brew services start postgresql@15

   # Ubuntu/Debian
   sudo apt-get install postgresql postgresql-contrib

   # Windows
   # Download from https://www.postgresql.org/download/windows/
   ```

2. Create database:
   ```bash
   createdb xantuus_ai
   ```

3. Your DATABASE_URL will be:
   ```
   DATABASE_URL="postgresql://username@localhost:5432/xantuus_ai"
   ```

### Option 2: Hosted PostgreSQL (Recommended for Production)

**Supabase** (Free tier available):
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings → Database
4. Copy the connection string (use "Connection Pooling" for serverless)

**Neon** (Generous free tier):
1. Go to [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string

**Railway** (Simple deployment):
1. Go to [railway.app](https://railway.app)
2. Create PostgreSQL database
3. Copy DATABASE_URL from variables

## Stripe Setup

### 1. Create Stripe Account

1. Go to [stripe.com](https://stripe.com)
2. Sign up for an account
3. Complete account verification

### 2. Get API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. Copy your **Publishable key** and **Secret key**
3. Use test keys for development (starts with `pk_test_` and `sk_test_`)

### 3. Create Products and Prices

#### Pro Plan ($29/month)

1. Go to [Stripe Products](https://dashboard.stripe.com/products)
2. Click "Add product"
3. Fill in:
   - Name: `Pro Plan`
   - Description: `50,000 credits per month with all features`
   - Pricing model: `Standard pricing`
   - Price: `$29.00`
   - Billing period: `Monthly`
4. Click "Save product"
5. **Copy the Price ID** (starts with `price_`) → This is `STRIPE_PRO_PRICE_ID`

#### Enterprise Plan ($199/month)

1. Repeat the above steps with:
   - Name: `Enterprise Plan`
   - Description: `500,000 credits per month with dedicated support`
   - Price: `$199.00`
   - Billing period: `Monthly`
2. **Copy the Price ID** → This is `STRIPE_ENTERPRISE_PRICE_ID`

### 4. Enable Customer Portal

1. Go to [Customer Portal Settings](https://dashboard.stripe.com/test/settings/billing/portal)
2. Enable the customer portal
3. Configure:
   - Allow customers to update payment methods: ✅
   - Allow customers to update subscriptions: ✅
   - Allow customers to cancel subscriptions: ✅
4. Save changes

## Environment Configuration

1. Copy the example file:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in all values in `.env.local`:

```env
# NextAuth Configuration
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3010

# Google OAuth (see AUTH_SETUP.md)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Microsoft/Azure AD OAuth (optional)
AZURE_AD_CLIENT_ID=your-azure-client-id
AZURE_AD_CLIENT_SECRET=your-azure-client-secret

# Apple OAuth (optional)
APPLE_ID=your-apple-service-id
APPLE_SECRET=your-apple-secret

# Cloudflare Turnstile
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your-turnstile-site-key

# Anthropic API
ANTHROPIC_API_KEY=sk-ant-your-api-key-here

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/xantuus_ai

# Stripe
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# Stripe Price IDs (from products created above)
STRIPE_PRO_PRICE_ID=price_1234567890
STRIPE_ENTERPRISE_PRICE_ID=price_0987654321
```

## Database Migration

Run Prisma migrations to create your database tables:

```bash
# Generate Prisma Client
npx prisma generate

# Create database tables
npx prisma db push

# (Optional) Open Prisma Studio to view data
npx prisma studio
```

Your database now has these tables:
- `User` - User accounts with subscription info
- `Account` - OAuth provider accounts
- `Session` - User sessions
- `UsageRecord` - API usage tracking
- `ApiKey` - User API keys
- `VerificationToken` - Email verification

## Stripe Webhook Configuration

### Development (using Stripe CLI)

1. Install Stripe CLI:
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe

   # Windows
   scoop install stripe

   # Linux
   wget https://github.com/stripe/stripe-cli/releases/download/vX.X.X/stripe_X.X.X_linux_x86_64.tar.gz
   ```

2. Login to Stripe:
   ```bash
   stripe login
   ```

3. Forward webhooks to local server:
   ```bash
   stripe listen --forward-to localhost:3010/api/stripe/webhook
   ```

4. Copy the webhook signing secret (starts with `whsec_`) to `.env.local` as `STRIPE_WEBHOOK_SECRET`

### Production (Stripe Dashboard)

1. Go to [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Endpoint URL: `https://yourdomain.com/api/stripe/webhook`
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
5. Copy the **Signing secret** → Add to production environment as `STRIPE_WEBHOOK_SECRET`

## Testing

### 1. Test Authentication

```bash
npm run dev
```

Visit `http://localhost:3010` and:
1. Click "Sign In"
2. Complete OAuth flow
3. Verify you're logged in

### 2. Test Pricing Page

1. Visit `http://localhost:3010/pricing`
2. Verify all 3 plans are displayed
3. Click "Subscribe" on Pro plan
4. Should redirect to Stripe Checkout

### 3. Test Stripe Checkout

Use Stripe test cards:
- Success: `4242 4242 4242 4242`
- Requires authentication: `4000 0025 0000 3155`
- Declined: `4000 0000 0000 9995`

Expiry: Any future date
CVC: Any 3 digits
ZIP: Any 5 digits

### 4. Test Settings Pages

After subscribing:
1. Visit `http://localhost:3010/settings/account`
   - Verify profile info displays
   - Check plan badge and credits

2. Visit `http://localhost:3010/settings/billing`
   - Verify subscription shows
   - Test "Manage Subscription" button
   - Should open Stripe Customer Portal

3. Visit `http://localhost:3010/settings/usage`
   - Charts should display (may be empty initially)
   - Test with some API usage

4. Visit `http://localhost:3010/settings/api-keys`
   - Create a new API key
   - Copy and save the key
   - Test delete functionality

### 5. Test Webhooks

Trigger a test webhook:

```bash
stripe trigger customer.subscription.created
```

Check your database to see if the subscription was recorded:

```bash
npx prisma studio
```

## Features Implemented

### ✅ Pricing Page
- 3-tier pricing (Free, Pro, Enterprise)
- Feature comparison
- Direct Stripe checkout integration
- Responsive design

### ✅ Billing Management
- Subscription status display
- Stripe Customer Portal integration
- Cancel/update subscription
- View invoices
- Update payment methods

### ✅ Account Settings
- Profile information
- Plan details with usage progress
- Credits tracking
- OAuth provider info

### ✅ Usage Dashboard
- 30-day usage charts
- Credit consumption over time
- API request analytics
- Real-time updates

### ✅ API Key Management
- Create unlimited API keys
- Copy/show/hide functionality
- Track last used date
- Delete keys

### ✅ Stripe Integration
- Secure checkout
- Webhook handling
- Subscription lifecycle management
- Customer portal
- Automatic credit resets

## Architecture

```
┌─────────────────┐
│   Frontend      │
│  (Next.js 14)   │
└────────┬────────┘
         │
         ├─────► Pricing Page → Stripe Checkout
         │
         ├─────► Settings Pages → API Routes
         │
         └─────► Usage Dashboard → Charts
                        │
         ┌──────────────┴──────────────┐
         │                             │
┌────────▼────────┐          ┌────────▼────────┐
│  Stripe API     │          │   PostgreSQL    │
│  (Billing)      │          │   (User Data)   │
└─────────────────┘          └─────────────────┘
         │
         └─────► Webhooks → Update Database
```

## Production Deployment Checklist

Before deploying to production:

- [ ] Switch to Stripe live keys (remove `_test_` keys)
- [ ] Update `NEXTAUTH_URL` to production domain
- [ ] Set up production database (Supabase/Neon/Railway)
- [ ] Configure production Stripe webhook endpoint
- [ ] Set all environment variables in hosting platform
- [ ] Run database migrations on production
- [ ] Test complete checkout flow in production
- [ ] Set up monitoring and error tracking
- [ ] Configure backup strategy for database
- [ ] Review Stripe tax settings for your region
- [ ] Set up email notifications for subscription events

## Support

For issues or questions:
- Stripe: [stripe.com/docs](https://stripe.com/docs)
- Prisma: [prisma.io/docs](https://prisma.io/docs)
- NextAuth: [next-auth.js.org](https://next-auth.js.org)

## Next Steps

1. Customize pricing plans and features
2. Add email notifications for subscription events
3. Implement usage limits enforcement
4. Add more analytics and reporting
5. Create admin dashboard for managing users
6. Add team/organization features
7. Implement referral program
