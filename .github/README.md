# GitHub Actions CI/CD Workflows

This repository uses GitHub Actions for automated testing, deployment, and maintenance.

## Workflows

### 1. CI (Continuous Integration)
**File**: `.github/workflows/ci.yml`

**Triggers**:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

**Actions**:
- Linting with ESLint
- TypeScript type checking
- Build verification
- Security scanning (npm audit, secret detection)

### 2. Vercel Deployment
**File**: `.github/workflows/vercel-deploy.yml`

**Triggers**:
- Push to `main` (production deployment)
- Pull requests (preview deployments)
- Manual trigger via `workflow_dispatch`

**Actions**:
- Installs Vercel CLI
- Pulls Vercel environment config
- Builds project artifacts
- Deploys to Vercel (production or preview)
- Comments PR with preview URL

**Required Secrets**:
- `VERCEL_TOKEN` - Your Vercel API token
- `VERCEL_ORG_ID` - Your Vercel organization ID
- `VERCEL_PROJECT_ID` - Your Vercel project ID

### 3. Cloud Run Deployment
**File**: `.github/workflows/deploy-cloud-run.yml`

**Triggers**:
- Push to `main` branch
- Manual trigger via `workflow_dispatch`

**Actions**:
- Builds Docker container
- Pushes to Google Container Registry
- Deploys to Google Cloud Run

**Required Secrets**:
- `GCP_SA_KEY` - Google Cloud service account key (JSON)
- All environment variables (DATABASE_URL, NEXTAUTH_SECRET, etc.)

### 4. Database Migrations
**File**: `.github/workflows/database-migrations.yml`

**Triggers**:
- Manual trigger only (workflow_dispatch)

**Actions**:
- Runs Prisma migrations
- Generates Prisma client
- Seeds database (non-production only)

**Required Secrets**:
- `DATABASE_URL` - Production database connection
- `DIRECT_URL` - Direct database connection (Supabase)
- Optional: staging and dev database URLs

## Setting Up GitHub Secrets

### Vercel Deployment Secrets

1. **Get Vercel Token**:
   ```bash
   vercel login
   vercel whoami
   # Go to: https://vercel.com/account/tokens
   # Create new token
   ```

2. **Get Vercel IDs**:
   ```bash
   # In your project directory
   vercel link
   # This creates .vercel/project.json with your IDs
   cat .vercel/project.json
   ```

3. **Add to GitHub**:
   - Go to: Repository Settings → Secrets and variables → Actions
   - Add these secrets:
     - `VERCEL_TOKEN`: Your Vercel API token
     - `VERCEL_ORG_ID`: From `.vercel/project.json` (orgId)
     - `VERCEL_PROJECT_ID`: From `.vercel/project.json` (projectId)

### Database Secrets

Add these to GitHub Secrets:
- `DATABASE_URL`: Your Supabase connection string (pooling)
- `DIRECT_URL`: Your Supabase direct connection string
- `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
- `NEXTAUTH_URL`: Your production URL (https://your-domain.com)

### OAuth & API Secrets

- `GOOGLE_CLIENT_ID`: From Google Cloud Console
- `GOOGLE_CLIENT_SECRET`: From Google Cloud Console
- `ANTHROPIC_API_KEY`: Your Claude API key
- `ADMIN_EMAIL`: Admin email address

### Stripe Secrets (for payment features)

- `STRIPE_SECRET_KEY`: Your Stripe secret key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Your Stripe publishable key
- `STRIPE_WEBHOOK_SECRET`: Your webhook signing secret
- `STRIPE_PRO_PRICE_ID`: Pro plan price ID
- `STRIPE_ENTERPRISE_PRICE_ID`: Enterprise plan price ID

## Dependabot

**File**: `.github/dependabot.yml`

Automatically creates pull requests for:
- npm package updates (weekly on Mondays)
- GitHub Actions updates (monthly)

## Usage

### Running CI Locally

```bash
# Type check
npm run build

# Lint
npm run lint

# Security audit
npm audit
```

### Manual Deployment Trigger

1. Go to: Actions tab in GitHub
2. Select workflow (e.g., "Deploy to Vercel")
3. Click "Run workflow"
4. Choose branch and options

### Database Migrations

1. Go to: Actions → Database Migrations
2. Click "Run workflow"
3. Select environment (production/staging/development)
4. Click "Run workflow"

⚠️ **Warning**: Be careful with production migrations!

## Best Practices

1. **Never commit secrets** - Always use GitHub Secrets
2. **Test locally first** - Run builds and tests before pushing
3. **Use pull requests** - Get preview deployments for review
4. **Monitor workflows** - Check Actions tab for failures
5. **Keep dependencies updated** - Review Dependabot PRs weekly

## Troubleshooting

### Vercel Deployment Fails

- Check that all secrets are set correctly
- Verify Vercel token hasn't expired
- Check Vercel dashboard for errors

### Cloud Run Deployment Fails

- Verify GCP_SA_KEY is valid JSON
- Check service account has necessary permissions
- Review Cloud Run logs in GCP console

### CI Fails

- Check TypeScript errors locally
- Fix linting issues: `npm run lint -- --fix`
- Review build logs in Actions tab

## Security

- Secrets are encrypted by GitHub
- Workflows run in isolated environments
- Dependencies are scanned for vulnerabilities
- TruffleHog scans for accidentally committed secrets

## Monitoring

Monitor your workflows:
- GitHub Actions tab shows all runs
- Email notifications for failures (configure in settings)
- Slack integration available via GitHub Apps

---

For more information, see [GitHub Actions documentation](https://docs.github.com/en/actions).
