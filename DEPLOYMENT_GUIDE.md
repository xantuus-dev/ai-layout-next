# Deployment Guide - Xantuus AI

This guide covers deploying your Xantuus AI application to GitHub and Google Cloud Platform (GCP).

---

## Part 1: Publishing to GitHub

### Step 1: Create .gitignore (if not exists)

Ensure you have a proper `.gitignore` file:

```bash
# .gitignore
node_modules/
.next/
.env
.env.local
.env.production
dist/
build/
*.log
.DS_Store
.vercel
*.tsbuildinfo
```

### Step 2: Initialize Git Repository

```bash
# If not already initialized
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit - Xantuus AI Platform"
```

### Step 3: Create GitHub Repository

1. Go to [GitHub](https://github.com) and sign in
2. Click the "+" icon → "New repository"
3. Name it: `xantuus-ai` (or your preferred name)
4. **Do NOT** initialize with README (we already have one)
5. Click "Create repository"

### Step 4: Push to GitHub

```bash
# Add GitHub remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/xantuus-ai.git

# Verify remote
git remote -v

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 5: Future Updates

```bash
# Add changes
git add .

# Commit with message
git commit -m "Description of changes"

# Push to GitHub
git push
```

---

## Part 2: Deploying to Google Cloud Platform (GCP)

### Prerequisites

1. **Google Cloud Account** - [Create one here](https://cloud.google.com)
2. **gcloud CLI** - [Install here](https://cloud.google.com/sdk/docs/install)
3. **PostgreSQL Database** - Use Supabase (current) or Cloud SQL

### Option A: Deploy to Cloud Run (Recommended - Easier & Cheaper)

Cloud Run is serverless and scales automatically.

#### Step 1: Prepare Your Application

Create a `Dockerfile`:

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

#### Step 2: Update next.config.js for Standalone

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  swcMinify: true,
};

module.exports = nextConfig;
```

#### Step 3: Create .dockerignore

```bash
# .dockerignore
node_modules
.next
.git
.env
.env.local
*.log
README.md
.DS_Store
```

#### Step 4: Initialize GCP Project

```bash
# Login to Google Cloud
gcloud auth login

# Create new project (or use existing)
gcloud projects create xantuus-ai-prod --name="Xantuus AI"

# Set project
gcloud config set project xantuus-ai-prod

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

#### Step 5: Create Environment Variables File for Cloud Run

Create `env.yaml`:

```yaml
# env.yaml (DO NOT COMMIT - add to .gitignore)
DATABASE_URL: "your_database_url_here"
NEXTAUTH_URL: "https://your-app-url.run.app"
NEXTAUTH_SECRET: "your_nextauth_secret_here"
GOOGLE_CLIENT_ID: "your_google_client_id"
GOOGLE_CLIENT_SECRET: "your_google_client_secret"
ANTHROPIC_API_KEY: "your_anthropic_api_key"
ADMIN_EMAIL: "your_admin@email.com"
# Add all other environment variables
```

#### Step 6: Build and Deploy to Cloud Run

```bash
# Set region (choose closest to your users)
export REGION=us-central1

# Build and deploy in one command
gcloud run deploy xantuus-ai \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --env-vars-file env.yaml \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 10 \
  --min-instances 0

# Or build separately with Cloud Build
gcloud builds submit --tag gcr.io/xantuus-ai-prod/xantuus-ai

# Then deploy
gcloud run deploy xantuus-ai \
  --image gcr.io/xantuus-ai-prod/xantuus-ai \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --env-vars-file env.yaml
```

#### Step 7: Get Your Deployment URL

```bash
# Get service URL
gcloud run services describe xantuus-ai --region $REGION --format 'value(status.url)'
```

Update `NEXTAUTH_URL` in your environment variables to this URL.

#### Step 8: Update Environment Variables

```bash
# Update single variable
gcloud run services update xantuus-ai \
  --region $REGION \
  --update-env-vars NEXTAUTH_URL=https://your-app-xyz.run.app

# Or update multiple at once
gcloud run services update xantuus-ai \
  --region $REGION \
  --env-vars-file env.yaml
```

---

### Option B: Deploy to App Engine (Alternative)

App Engine is a traditional PaaS with always-on instances.

#### Step 1: Create app.yaml

```yaml
# app.yaml
runtime: nodejs18

instance_class: F2

env_variables:
  NODE_ENV: "production"
  # Add other non-sensitive env vars here

automatic_scaling:
  min_instances: 0
  max_instances: 10
  target_cpu_utilization: 0.65
```

#### Step 2: Create .gcloudignore

```bash
# .gcloudignore
.git
.gitignore
node_modules/
.next/
.env*
*.log
README.md
```

#### Step 3: Deploy to App Engine

```bash
# Initialize App Engine
gcloud app create --region=us-central

# Deploy
gcloud app deploy

# View logs
gcloud app logs tail -s default
```

---

## Part 3: Database Setup for Production

### Using Supabase (Recommended - Current Setup)

Your current setup with Supabase works great for production:

1. **Keep your Supabase database**
2. **Use pooling URL for production**: `DATABASE_URL`
3. **Enable SSL**: Already configured in your setup

### Using Cloud SQL (Alternative)

If you want to use Google's PostgreSQL:

```bash
# Create Cloud SQL instance
gcloud sql instances create xantuus-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1

# Create database
gcloud sql databases create xantuus_prod --instance=xantuus-db

# Create user
gcloud sql users create xantuus_user \
  --instance=xantuus-db \
  --password=YOUR_SECURE_PASSWORD

# Get connection name
gcloud sql instances describe xantuus-db --format 'value(connectionName)'

# Use Cloud SQL Proxy for connection
# Connection string format:
# postgresql://user:password@/dbname?host=/cloudsql/PROJECT:REGION:INSTANCE
```

---

## Part 4: Environment Variables Management

### Create Production .env

```bash
# .env.production (DO NOT COMMIT)

# Database
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
DIRECT_URL="postgresql://user:password@host:5432/database?sslmode=require"

# NextAuth
NEXTAUTH_URL="https://your-app.run.app"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Anthropic API
ANTHROPIC_API_KEY="your-anthropic-api-key"

# Admin
ADMIN_EMAIL="admin@yourdomain.com"

# Stripe (if using)
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# RevenueCat (if using)
REVENUECAT_API_KEY="your-revenuecat-api-key"
REVENUECAT_PUBLIC_KEY="your-public-key"

# Optional
NODE_ENV="production"
```

### Using Google Secret Manager (Recommended for GCP)

```bash
# Enable Secret Manager API
gcloud services enable secretmanager.googleapis.com

# Create secrets
echo -n "your-secret-value" | gcloud secrets create NEXTAUTH_SECRET --data-file=-

# Grant Cloud Run access to secrets
gcloud secrets add-iam-policy-binding NEXTAUTH_SECRET \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Update Cloud Run to use secrets
gcloud run services update xantuus-ai \
  --update-secrets=NEXTAUTH_SECRET=NEXTAUTH_SECRET:latest
```

---

## Part 5: Custom Domain Setup

### Step 1: Verify Domain

```bash
# Add custom domain to Cloud Run
gcloud beta run domain-mappings create \
  --service xantuus-ai \
  --domain app.yourdomain.com \
  --region $REGION
```

### Step 2: Configure DNS

Add these DNS records to your domain:

```
Type: CNAME
Name: app
Value: ghs.googlehosted.com
```

### Step 3: SSL Certificate

Cloud Run automatically provisions SSL certificates for custom domains.

---

## Part 6: Deployment Scripts

Create deployment scripts for easy updates:

### deploy.sh

```bash
#!/bin/bash
# deploy.sh

set -e

echo "🚀 Deploying Xantuus AI to Cloud Run..."

# Build and deploy
gcloud run deploy xantuus-ai \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --env-vars-file env.yaml \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300

echo "✅ Deployment complete!"

# Get URL
echo "🌐 Your app is live at:"
gcloud run services describe xantuus-ai --region us-central1 --format 'value(status.url)'
```

Make it executable:

```bash
chmod +x deploy.sh
./deploy.sh
```

### package.json scripts

Add to `package.json`:

```json
{
  "scripts": {
    "build": "next build",
    "start": "next start",
    "dev": "next dev",
    "deploy:gcp": "./deploy.sh",
    "db:migrate": "prisma migrate deploy",
    "db:generate": "prisma generate"
  }
}
```

---

## Part 7: CI/CD with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches:
      - main

env:
  PROJECT_ID: xantuus-ai-prod
  SERVICE_NAME: xantuus-ai
  REGION: us-central1

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Google Auth
        uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v1

      - name: Build and Push Container
        run: |
          gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy $SERVICE_NAME \
            --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
            --platform managed \
            --region $REGION \
            --allow-unauthenticated \
            --set-env-vars DATABASE_URL=${{ secrets.DATABASE_URL }} \
            --set-env-vars NEXTAUTH_SECRET=${{ secrets.NEXTAUTH_SECRET }} \
            --set-env-vars NEXTAUTH_URL=${{ secrets.NEXTAUTH_URL }}
```

Add secrets to GitHub:
1. Go to repository → Settings → Secrets and variables → Actions
2. Add each environment variable as a secret

---

## Part 8: Monitoring & Logs

### View Logs

```bash
# Cloud Run logs
gcloud run services logs read xantuus-ai --region $REGION --limit 50

# Stream logs in real-time
gcloud run services logs tail xantuus-ai --region $REGION

# Filter logs
gcloud run services logs read xantuus-ai --region $REGION --filter="severity>=ERROR"
```

### Enable Cloud Monitoring

```bash
# Already enabled by default for Cloud Run
# View metrics at: https://console.cloud.google.com/run
```

---

## Part 9: Cost Optimization

### Cloud Run Pricing Tips

1. **Set min instances to 0** - Only pay when serving requests
2. **Use appropriate memory/CPU** - Start with 1 CPU / 2Gi RAM
3. **Enable request timeout** - Set to 300s max
4. **Use Cloud SQL Proxy** - Reduces database connection overhead

### Estimated Costs (USD/month)

- **Cloud Run**: $0 (free tier) - $50 (with traffic)
- **Cloud SQL**: $10 - $50 (db-f1-micro)
- **Supabase**: $0 (free tier) - $25 (Pro)
- **Total**: ~$10-100/month depending on usage

---

## Quick Start Checklist

- [ ] Code pushed to GitHub
- [ ] GCP project created
- [ ] Cloud Run deployed
- [ ] Environment variables configured
- [ ] Database connected
- [ ] Custom domain added (optional)
- [ ] CI/CD configured (optional)
- [ ] Monitoring enabled

---

## Troubleshooting

### Build Fails

```bash
# Check build logs
gcloud builds log $(gcloud builds list --limit 1 --format 'value(id)')
```

### Database Connection Issues

```bash
# Test database connection
npx prisma db pull

# Check connection string format
echo $DATABASE_URL
```

### Environment Variables Not Working

```bash
# Verify env vars are set
gcloud run services describe xantuus-ai --region $REGION --format 'value(spec.template.spec.containers[0].env)'
```

---

## Support

For deployment issues:
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Prisma Production Best Practices](https://www.prisma.io/docs/guides/deployment/deployment-guides)
