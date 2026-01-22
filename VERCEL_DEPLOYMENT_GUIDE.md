# Vercel Deployment Guide

## Quick Deploy to Vercel

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Visit Vercel**: Go to https://vercel.com/new

2. **Import Project**:
   - Click "Import Project"
   - Select "Import Git Repository"
   - Choose: `xantuus-dev/ai-layout-next`

3. **Configure Project**:
   - Framework Preset: `Next.js` (auto-detected)
   - Root Directory: `./` (leave default)
   - Build Command: `npm run build` (auto-detected)
   - Output Directory: `.next` (auto-detected)

4. **Add Environment Variables** (CRITICAL):

```bash
# Database
DATABASE_URL=your_supabase_pooling_url

# Authentication
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
NEXTAUTH_URL=https://your-app.vercel.app

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Anthropic API
ANTHROPIC_API_KEY=your_anthropic_api_key

# Stripe (Optional - for payments)
STRIPE_SECRET_KEY=sk_live_your_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_key
STRIPE_PRO_PRICE_ID=price_xxxxx
STRIPE_ENTERPRISE_PRICE_ID=price_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Azure AD (Optional)
AZURE_AD_CLIENT_ID=
AZURE_AD_CLIENT_SECRET=
AZURE_AD_TENANT_ID=

# Apple Sign In (Optional)
APPLE_ID=
APPLE_TEAM_ID=
APPLE_PRIVATE_KEY=
APPLE_KEY_ID=

# Cloudflare Turnstile (Optional)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

# RevenueCat (Optional)
REVENUECAT_PUBLIC_KEY=
REVENUECAT_SECRET_KEY=
REVENUECAT_WEBHOOK_SECRET=
```

5. **Deploy**: Click "Deploy"

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (follow prompts)
vercel

# Deploy to production
vercel --prod
```

---

## Post-Deployment Steps

### 1. Run Database Migrations

```bash
# Connect to your deployed project
vercel env pull .env.production

# Run migrations
npx prisma migrate deploy
```

### 2. Seed Example Templates

Visit your deployed app and run:
```
https://your-app.vercel.app/api/templates/seed
```

Or use curl:
```bash
curl -X POST https://your-app.vercel.app/api/templates/seed
```

### 3. Update OAuth Redirect URIs

#### Google Cloud Console
1. Go to https://console.cloud.google.com/apis/credentials
2. Select your OAuth 2.0 Client ID
3. Add to "Authorized redirect URIs":
   ```
   https://your-app.vercel.app/api/auth/callback/google
   ```
4. Add to "Authorized JavaScript origins":
   ```
   https://your-app.vercel.app
   ```

#### Azure AD (if using)
1. Go to Azure Portal > App Registrations
2. Add redirect URI:
   ```
   https://your-app.vercel.app/api/auth/callback/azure-ad
   ```

#### Apple Sign In (if using)
1. Go to Apple Developer Portal
2. Add redirect URI:
   ```
   https://your-app.vercel.app/api/auth/callback/apple
   ```

### 4. Configure Stripe Webhooks (if using)

1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://your-app.vercel.app/api/stripe/webhook`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the "Signing secret" (whsec_...)
6. Add to Vercel environment variables as `STRIPE_WEBHOOK_SECRET`

### 5. Update Stripe Price IDs

1. Switch from test mode to live mode in Stripe Dashboard
2. Create products/prices in live mode
3. Update environment variables:
   - `STRIPE_PRO_PRICE_ID`
   - `STRIPE_ENTERPRISE_PRICE_ID`

---

## Environment Variables Checklist

### Required
- ✅ `DATABASE_URL` - Supabase connection string (with pooling)
- ✅ `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
- ✅ `NEXTAUTH_URL` - Your production URL
- ✅ `GOOGLE_CLIENT_ID` - From Google Cloud Console
- ✅ `GOOGLE_CLIENT_SECRET` - From Google Cloud Console
- ✅ `ANTHROPIC_API_KEY` - From Anthropic Console

### Optional but Recommended
- ⚠️ `STRIPE_SECRET_KEY` - For payments
- ⚠️ `STRIPE_PUBLISHABLE_KEY` - For payments
- ⚠️ `STRIPE_PRO_PRICE_ID` - Pro plan price
- ⚠️ `STRIPE_ENTERPRISE_PRICE_ID` - Enterprise plan price
- ⚠️ `STRIPE_WEBHOOK_SECRET` - From Stripe webhooks

### Optional
- 🔵 `AZURE_AD_CLIENT_ID` - For Microsoft login
- 🔵 `AZURE_AD_CLIENT_SECRET` - For Microsoft login
- 🔵 `AZURE_AD_TENANT_ID` - For Microsoft login
- 🔵 `APPLE_ID` - For Apple Sign In
- 🔵 `NEXT_PUBLIC_TURNSTILE_SITE_KEY` - Bot protection
- 🔵 `TURNSTILE_SECRET_KEY` - Bot protection
- 🔵 `REVENUECAT_PUBLIC_KEY` - For mobile billing
- 🔵 `REVENUECAT_SECRET_KEY` - For mobile billing

---

## Vercel-Specific Configurations

### Build & Development Settings
- **Framework**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`
- **Development Command**: `npm run dev`

### Deployment Protection
- Enable "Vercel Authentication" for production if needed
- Set up "Password Protection" for preview deployments

### Custom Domain (Optional)
1. Go to Vercel Dashboard > Your Project > Settings > Domains
2. Add your custom domain
3. Configure DNS records as instructed
4. Update `NEXTAUTH_URL` to your custom domain

---

## Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify TypeScript has no errors: `npm run build` locally

### OAuth Not Working
- Verify redirect URIs match exactly (including https://)
- Check `NEXTAUTH_URL` is set to production URL
- Ensure OAuth credentials are for the correct environment

### Database Connection Issues
- Use Supabase **connection pooling** URL (contains `.pooler.supabase.com`)
- Verify DATABASE_URL is set in Vercel environment variables
- Check Supabase connection limits

### Stripe Webhooks Failing
- Verify webhook endpoint URL is correct
- Check webhook signing secret matches environment variable
- Test with Stripe CLI: `stripe listen --forward-to https://your-app.vercel.app/api/stripe/webhook`

### Templates Not Showing
- Visit `/api/templates/seed` to seed templates
- Check database connection
- Verify Prisma Client is generated (happens automatically during build)

---

## Monitoring & Analytics

### Vercel Analytics (Optional)
1. Go to Vercel Dashboard > Analytics
2. Enable Web Analytics
3. Enable Speed Insights

### Error Tracking
Consider integrating:
- Sentry (error tracking)
- LogRocket (session replay)
- Vercel Logs (built-in)

---

## Security Checklist

- ✅ All environment variables set in Vercel (not in code)
- ✅ `NEXTAUTH_SECRET` is strong and unique
- ✅ OAuth redirect URIs restricted to your domain
- ✅ Stripe webhook signature verification enabled
- ✅ Database credentials use connection pooling
- ✅ API keys are production keys (not test/dev)
- ✅ HTTPS enforced (automatic with Vercel)

---

## Continuous Deployment

Once connected, Vercel automatically deploys:
- **Production**: Pushes to `main` branch
- **Preview**: Pull requests and other branches

To disable auto-deploy:
1. Go to Settings > Git
2. Configure production branch
3. Disable preview deployments if needed

---

## Getting Help

- **Vercel Docs**: https://vercel.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Supabase Docs**: https://supabase.com/docs
- **Stripe Docs**: https://stripe.com/docs

---

## Your App URLs

After deployment, you'll have:
- **Production**: `https://your-app.vercel.app` or `https://your-domain.com`
- **Preview**: `https://ai-layout-next-git-branch-xantuus-dev.vercel.app`
- **Admin Dashboard**: `https://vercel.com/xantuus-dev/ai-layout-next`

🚀 Your app is now live and ready for users!
