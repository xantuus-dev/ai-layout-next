# Vercel Deployment Guide

## 🚀 Deploy to Vercel

### Quick Deploy

```bash
vercel --prod
```

This will deploy the latest code from GitHub to production.

## 🔧 Required Environment Variables

Make sure these are set in your Vercel project settings:

### Database & Core (Required)
```bash
DATABASE_URL=postgresql://...
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=<your-secret>
```

### AI API Keys (Required for Memory System)
```bash
ANTHROPIC_API_KEY=sk-ant-...
# OR
OPENAI_API_KEY=sk-...
```

### OAuth Providers (Required)
```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Optional: Additional providers
AZURE_AD_CLIENT_ID=...
AZURE_AD_CLIENT_SECRET=...
APPLE_ID=...
APPLE_SECRET=...
```

### Stripe (Required for Billing)
```bash
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...
```

### Memory System (Optional)
```bash
MEMORY_SCHEDULER_ENABLED=true
FACT_EXTRACTION_MODEL=gpt-4o-mini
FACT_MIN_CONFIDENCE=0.6
```

### Security (Optional)
```bash
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
TURNSTILE_SECRET_KEY=...
```

## 📦 Deployment Process

### 1. Pre-Deployment Checklist

- ✅ All changes committed and pushed to GitHub
- ✅ Database schema is up to date
- ✅ Environment variables are set in Vercel
- ✅ Build passes locally: `npm run build`

### 2. Deploy to Production

```bash
# Deploy to production
vercel --prod

# Or let GitHub auto-deploy (if enabled)
git push origin main
```

### 3. Post-Deployment Tasks

#### A. Run Database Setup (One-Time)

The memory system requires pgvector and indices. After first deployment:

```bash
# Connect to your production database
psql $DATABASE_URL_PRODUCTION

# Run the setup script content from scripts/setup-memory-database.sql
```

Or use a migration script:

```bash
# Create a migration
npx prisma migrate dev --name add_memory_system

# Deploy migration to production
npx prisma migrate deploy
```

#### B. Verify Memory System

1. Visit: https://your-domain.vercel.app/settings/memory
2. Check that the dashboard loads
3. Try a test search
4. Trigger manual consolidation

#### C. Set up Webhook URLs

Update webhook URLs in external services:

**Stripe Webhooks:**
- URL: `https://your-domain.vercel.app/api/stripe/webhook`
- Events: `customer.subscription.*`

**RevenueCat Webhooks (if used):**
- URL: `https://your-domain.vercel.app/api/revenuecat/webhook`

## 🔄 Memory System in Production

### Background Consolidation

The memory scheduler cannot run directly on Vercel (serverless). Options:

#### Option 1: Cron Jobs (Recommended)
Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/memory/cron/consolidate",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

Then create API route at `/api/memory/cron/consolidate/route.ts`

#### Option 2: External Cron Service
Use services like:
- Vercel Cron Jobs
- GitHub Actions
- Cron-job.org
- EasyCron

Call: `POST https://your-domain.vercel.app/api/memory/consolidate`

#### Option 3: Manual Triggers
Users can manually trigger consolidation via the dashboard.

### Database Connection Pooling

Vercel uses serverless functions, so use connection pooling:

**Supabase**: Already configured with connection pooling URL
**Other**: Use PgBouncer or similar

## 🐛 Troubleshooting

### Build Fails

```bash
# Check build locally first
npm run build

# Common issues:
# - TypeScript errors
# - Missing environment variables
# - Prisma client not generated
```

### Memory System Not Working

1. **Check pgvector is enabled:**
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'vector';
   ```

2. **Verify environment variables in Vercel:**
   - Settings → Environment Variables
   - Check DATABASE_URL, OPENAI_API_KEY

3. **Check logs:**
   - Vercel Dashboard → Functions → Logs
   - Look for memory-related errors

### Database Connection Issues

- Ensure DATABASE_URL uses connection pooling URL
- Check Supabase project is active
- Verify connection limits aren't exceeded

## 📊 Monitoring

### Vercel Analytics

Monitor in Vercel Dashboard:
- Function invocations
- Response times
- Error rates
- Build logs

### Memory System Metrics

Track in your database:
```sql
-- Check consolidation jobs
SELECT * FROM "ConsolidationJob"
ORDER BY "createdAt" DESC LIMIT 10;

-- Check memory usage
SELECT * FROM memory_usage_stats;

-- Check fact extraction
SELECT * FROM consolidation_stats;
```

## 🔐 Security Considerations

### Production Checklist

- [ ] All API keys use production/live keys (not test keys)
- [ ] NEXTAUTH_SECRET is unique and secure
- [ ] Stripe webhook secret matches production webhook
- [ ] OAuth redirect URIs include production domain
- [ ] Database has appropriate access controls
- [ ] Rate limiting is enabled
- [ ] CORS is properly configured

## 📝 Deployment Commands Reference

```bash
# Deploy to production
vercel --prod

# Deploy to preview (staging)
vercel

# Check deployment status
vercel ls

# View logs
vercel logs [deployment-url]

# Rollback to previous deployment
vercel rollback [deployment-url]

# Pull environment variables
vercel env pull .env.local

# Push environment variables
vercel env add DATABASE_URL production
```

## 🎯 Post-Deployment Verification

1. **Homepage**: https://your-domain.vercel.app
2. **Sign In**: Test OAuth providers
3. **Chat**: Test AI chat functionality
4. **Memory Dashboard**: https://your-domain.vercel.app/settings/memory
5. **API Health**: Check API endpoints respond correctly
6. **Billing**: Test Stripe checkout flow
7. **Usage Tracking**: Verify usage records are created

## 📞 Support

- **Vercel Docs**: https://vercel.com/docs
- **Prisma Docs**: https://prisma.io/docs
- **Next.js Docs**: https://nextjs.org/docs

---

**Deployment Status**: Ready to deploy with memory system integration!

Last updated: February 17, 2026
