# Xantuus AI - Quick Start Guide

## What's Been Implemented

Your full-stack pricing, billing, and usage tracking system is now complete! Here's everything that was built:

### 🎨 Pages Created

1. **Pricing Page** (`/pricing`)
   - 3-tier pricing (Free, Pro $29, Enterprise $199)
   - Feature comparison
   - Direct Stripe checkout
   - Responsive design matching modern SaaS apps

2. **Settings Pages** (`/settings/*`)
   - **Account** - Profile info, plan details, credit usage
   - **Billing** - Subscription management, Stripe Customer Portal
   - **Usage** - Analytics charts showing 30-day usage
   - **API Keys** - Create and manage API keys

### 💳 Stripe Integration

- ✅ Checkout flow for subscriptions
- ✅ Webhook handling for subscription events
- ✅ Customer Portal for self-service billing
- ✅ Automatic credit resets on renewal
- ✅ Subscription lifecycle management

### 🗄️ Database

- ✅ Prisma ORM with PostgreSQL
- ✅ User subscriptions and billing
- ✅ Usage tracking and analytics
- ✅ API key management
- ✅ NextAuth integration

### 📊 Analytics

- ✅ Usage charts with Recharts
- ✅ 30-day credit consumption tracking
- ✅ API request analytics
- ✅ Real-time usage data

## Quick Setup (3 Steps)

### 1. Set Up Database

Choose one option:

**Option A - Local PostgreSQL** (for development)
```bash
# Install PostgreSQL
brew install postgresql@15

# Create database
createdb xantuus_ai

# Add to .env.local
DATABASE_URL="postgresql://username@localhost:5432/xantuus_ai"
```

**Option B - Hosted Database** (recommended)
```bash
# Supabase (free): https://supabase.com
# Neon (free): https://neon.tech
# Copy connection string to .env.local
```

### 2. Configure Stripe

```bash
# 1. Sign up: https://stripe.com
# 2. Get API keys: https://dashboard.stripe.com/apikeys
# 3. Create products:
#    - Pro Plan: $29/month → Copy Price ID
#    - Enterprise Plan: $199/month → Copy Price ID
# 4. Enable Customer Portal: https://dashboard.stripe.com/settings/billing/portal
```

### 3. Run Migrations

```bash
# Generate Prisma Client
npx prisma generate

# Create tables
npx prisma db push

# Start dev server
npm run dev
```

## Environment Variables Needed

```env
# Database (required)
DATABASE_URL=postgresql://...

# Stripe (required for billing)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...

# NextAuth (required)
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3010

# Google OAuth (required for auth)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

See `.env.example` for complete list.

## Testing

### Test Pricing Page
1. Visit `http://localhost:3010/pricing`
2. Click "Subscribe" on Pro plan
3. Use test card: `4242 4242 4242 4242`
4. Complete checkout

### Test Settings
1. Visit `http://localhost:3010/settings/account`
2. Check all tabs (Account, Billing, Usage, API Keys)
3. Test "Manage Subscription" in Billing
4. Create an API key

### Test Webhooks (Development)
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks
stripe listen --forward-to localhost:3010/api/stripe/webhook

# Copy signing secret to .env.local
```

## Pricing Tiers

| Feature | Free | Pro | Enterprise |
|---------|------|-----|-----------|
| Credits/month | 1,000 | 50,000 | 500,000 |
| Price | $0 | $29 | $199 |
| AI Models | Basic | All | All |
| Support | Email | Priority | Dedicated |
| API Access | ❌ | ✅ | ✅ |
| SLA | ❌ | ❌ | ✅ |

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts  # NextAuth config
│   │   ├── stripe/
│   │   │   ├── checkout/route.ts        # Create checkout
│   │   │   ├── webhook/route.ts         # Handle webhooks
│   │   │   └── portal/route.ts          # Customer portal
│   │   ├── usage/route.ts               # Usage analytics
│   │   └── api-keys/route.ts            # API key CRUD
│   ├── pricing/page.tsx                 # Pricing page
│   └── settings/
│       ├── layout.tsx                   # Settings layout
│       ├── account/page.tsx             # Account settings
│       ├── billing/page.tsx             # Billing management
│       ├── usage/page.tsx               # Usage dashboard
│       └── api-keys/page.tsx            # API key management
├── lib/
│   ├── prisma.ts                        # Prisma client
│   └── stripe.ts                        # Stripe config
└── types/
    └── next-auth.d.ts                   # Type definitions

prisma/
└── schema.prisma                        # Database schema
```

## Common Issues

### "Can't connect to database"
- Check DATABASE_URL is correct
- Ensure PostgreSQL is running
- Try `npx prisma db push`

### "Stripe webhook failing"
- Check STRIPE_WEBHOOK_SECRET is set
- Use Stripe CLI in development
- Verify webhook endpoint in production

### "Module not found @prisma/client"
- Run `npx prisma generate`
- Restart dev server

## Next Steps

1. ✅ Complete `.env.local` configuration
2. ✅ Set up PostgreSQL database
3. ✅ Configure Stripe products
4. ✅ Run database migrations
5. ✅ Test complete flow
6. 🚀 Deploy to production!

## Production Checklist

- [ ] Switch to live Stripe keys
- [ ] Use production database (Supabase/Neon)
- [ ] Set up Stripe webhook in dashboard
- [ ] Configure all env vars in hosting platform
- [ ] Test checkout with real card
- [ ] Set up monitoring (Sentry, LogRocket)

## Documentation

- **Full Setup**: See `SETUP_GUIDE.md`
- **Authentication**: See `AUTH_SETUP.md`
- **Stripe Docs**: https://stripe.com/docs
- **Prisma Docs**: https://prisma.io/docs

## Support Resources

**Stripe Test Cards**
- Success: `4242 4242 4242 4242`
- Requires 3D: `4000 0025 0000 3155`
- Declined: `4000 0000 0000 9995`

**Prisma Commands**
```bash
npx prisma studio        # View database
npx prisma db push       # Apply schema changes
npx prisma generate      # Generate client
npx prisma migrate dev   # Create migration
```

**Stripe CLI**
```bash
stripe listen --forward-to localhost:3010/api/stripe/webhook
stripe trigger customer.subscription.created
stripe logs tail
```

## Features To Add

Future enhancements you might want to implement:

- [ ] Email notifications for subscriptions
- [ ] Team/organization support
- [ ] Usage alerts when approaching limits
- [ ] Admin dashboard
- [ ] Referral program
- [ ] Invoice generation
- [ ] Tax handling
- [ ] Multi-currency support

---

**Ready to start?** Follow the 3-step setup above, then visit `http://localhost:3010`!
