# Quick Deployment Reference

## 🚀 Quick Commands

### Publish to GitHub

```bash
# Run the automated script
./publish-to-github.sh

# Or manually
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/xantuus-ai.git
git push -u origin main
```

---

### Deploy to Google Cloud Run

```bash
# Option 1: Use the deployment script
./deploy.sh

# Option 2: Manual deployment
gcloud run deploy xantuus-ai \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --env-vars-file env.yaml
```

---

## ⚙️ Prerequisites Setup

### 1. Install Required Tools

```bash
# Install gcloud CLI (macOS)
brew install google-cloud-sdk

# Or download from: https://cloud.google.com/sdk/docs/install

# Login to Google Cloud
gcloud auth login
```

### 2. Create GCP Project

```bash
# Create project
gcloud projects create xantuus-ai-prod --name="Xantuus AI"

# Set as default
gcloud config set project xantuus-ai-prod

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

### 3. Configure Environment Variables

```bash
# Copy example file
cp env.yaml.example env.yaml

# Edit with your values
nano env.yaml  # or use your preferred editor
```

**Required variables:**
- `DATABASE_URL` - Your PostgreSQL connection string
- `NEXTAUTH_URL` - Your app URL (will get this after first deployment)
- `NEXTAUTH_SECRET` - Generate with: `openssl rand -base64 32`
- `GOOGLE_CLIENT_ID` - From Google Cloud Console
- `GOOGLE_CLIENT_SECRET` - From Google Cloud Console
- `ANTHROPIC_API_KEY` - Your Anthropic API key
- `ADMIN_EMAIL` - Your admin email address

---

## 📦 First Deployment

### Step-by-Step

```bash
# 1. Ensure you're in the project directory
cd /Users/darchie/platform/ai-layout/ai-layout-next

# 2. Verify environment file exists
ls env.yaml

# 3. Deploy
./deploy.sh

# 4. Get your deployment URL
gcloud run services describe xantuus-ai --region us-central1 --format 'value(status.url)'

# 5. Update NEXTAUTH_URL in env.yaml with the deployment URL

# 6. Redeploy with updated env vars
./deploy.sh
```

---

## 🔄 Update Deployment

```bash
# After making code changes
git add .
git commit -m "Description of changes"
git push

# Deploy to Cloud Run
./deploy.sh
```

---

## 🔍 Monitoring & Logs

```bash
# View recent logs
gcloud run services logs read xantuus-ai --region us-central1 --limit 50

# Stream logs in real-time
gcloud run services logs tail xantuus-ai --region us-central1

# View in browser
gcloud run services describe xantuus-ai --region us-central1 --format 'value(status.consoleUrl)'
```

---

## 🌐 Custom Domain (Optional)

```bash
# Map custom domain
gcloud beta run domain-mappings create \
  --service xantuus-ai \
  --domain app.yourdomain.com \
  --region us-central1

# Get DNS records to add
gcloud beta run domain-mappings describe \
  --domain app.yourdomain.com \
  --region us-central1
```

---

## 🔐 Environment Variables Management

### Update Single Variable

```bash
gcloud run services update xantuus-ai \
  --region us-central1 \
  --update-env-vars ADMIN_EMAIL=new-admin@email.com
```

### Update Multiple Variables

```bash
# Edit env.yaml first, then:
gcloud run services update xantuus-ai \
  --region us-central1 \
  --env-vars-file env.yaml
```

### Using Secret Manager (Recommended)

```bash
# Create secret
echo -n "your-secret-value" | gcloud secrets create NEXTAUTH_SECRET --data-file=-

# Update service to use secret
gcloud run services update xantuus-ai \
  --update-secrets=NEXTAUTH_SECRET=NEXTAUTH_SECRET:latest \
  --region us-central1
```

---

## 📊 Useful Commands

```bash
# Check service status
gcloud run services describe xantuus-ai --region us-central1

# List all services
gcloud run services list

# View service URL
gcloud run services describe xantuus-ai --region us-central1 --format 'value(status.url)'

# Delete service
gcloud run services delete xantuus-ai --region us-central1

# View billing/costs
gcloud beta billing accounts list
gcloud beta billing projects describe xantuus-ai-prod
```

---

## 🐛 Troubleshooting

### Build Fails

```bash
# View build logs
gcloud builds list --limit 5
gcloud builds log BUILD_ID
```

### Service Not Starting

```bash
# Check logs for errors
gcloud run services logs read xantuus-ai --region us-central1 --limit 100

# Check service configuration
gcloud run services describe xantuus-ai --region us-central1
```

### Database Connection Issues

```bash
# Test locally first
npm run db:test

# Verify DATABASE_URL is set correctly
gcloud run services describe xantuus-ai --region us-central1 --format 'value(spec.template.spec.containers[0].env)'
```

---

## 💰 Cost Optimization

```bash
# Set minimum instances to 0 (only pay when serving requests)
gcloud run services update xantuus-ai \
  --min-instances 0 \
  --region us-central1

# Reduce memory/CPU for lower costs
gcloud run services update xantuus-ai \
  --memory 1Gi \
  --cpu 1 \
  --region us-central1

# Set request timeout
gcloud run services update xantuus-ai \
  --timeout 300 \
  --region us-central1
```

---

## 🎯 CI/CD with GitHub Actions

### Setup

1. Create service account:
```bash
gcloud iam service-accounts create github-actions \
  --display-name "GitHub Actions"

gcloud projects add-iam-policy-binding xantuus-ai-prod \
  --member="serviceAccount:github-actions@xantuus-ai-prod.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding xantuus-ai-prod \
  --member="serviceAccount:github-actions@xantuus-ai-prod.iam.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.builder"

gcloud iam service-accounts keys create key.json \
  --iam-account github-actions@xantuus-ai-prod.iam.gserviceaccount.com
```

2. Add `key.json` content to GitHub Secrets as `GCP_SA_KEY`

3. Add other secrets to GitHub:
   - `DATABASE_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `ANTHROPIC_API_KEY`
   - `ADMIN_EMAIL`

4. Push to main branch to trigger deployment

---

## 📞 Support

- **Full Guide**: See `DEPLOYMENT_GUIDE.md`
- **Cloud Run Docs**: https://cloud.google.com/run/docs
- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **Prisma Production**: https://www.prisma.io/docs/guides/deployment
