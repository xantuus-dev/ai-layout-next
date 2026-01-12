# 🚀 Deploy to GCP - Step by Step

Your environment is **ready to deploy**! Follow these steps:

---

## ✅ What's Already Done

- ✅ Google Cloud SDK installed
- ✅ Environment variables configured (`env.yaml`)
- ✅ Docker configuration ready
- ✅ Next.js configured for production

---

## 📋 Deployment Steps

### Step 1: Login to Google Cloud

Open Terminal and run:

```bash
cd /Users/darchie/platform/ai-layout/ai-layout-next
~/google-cloud-sdk/bin/gcloud auth login
```

This will open your browser. Sign in with your Google account.

---

### Step 2: Create GCP Project

```bash
# Create project
~/google-cloud-sdk/bin/gcloud projects create xantuus-ai-prod --name="Xantuus AI"

# Set as active project
~/google-cloud-sdk/bin/gcloud config set project xantuus-ai-prod

# Enable billing (you'll need to do this in the console if not already done)
# Visit: https://console.cloud.google.com/billing/linkedaccount?project=xantuus-ai-prod
```

---

### Step 3: Enable Required APIs

```bash
~/google-cloud-sdk/bin/gcloud services enable cloudbuild.googleapis.com
~/google-cloud-sdk/bin/gcloud services enable run.googleapis.com
~/google-cloud-sdk/bin/gcloud services enable artifactregistry.googleapis.com
```

This will take a minute or two.

---

### Step 4: Deploy to Cloud Run! 🎉

```bash
cd /Users/darchie/platform/ai-layout/ai-layout-next

~/google-cloud-sdk/bin/gcloud run deploy xantuus-ai \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --env-vars-file env.yaml \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 10 \
  --min-instances 0
```

**This will:**
- Build your Docker container
- Upload to Google Cloud
- Deploy to Cloud Run
- Give you a live URL!

⏱️ **Estimated time:** 5-10 minutes

---

### Step 5: Get Your Live URL

After deployment completes, run:

```bash
~/google-cloud-sdk/bin/gcloud run services describe xantuus-ai \
  --region us-central1 \
  --format 'value(status.url)'
```

Copy this URL - this is your live app!

---

### Step 6: Update NEXTAUTH_URL

**Important:** Update your `env.yaml` with the actual deployment URL:

1. Edit `env.yaml`
2. Replace `NEXTAUTH_URL: "https://temp-url-update-after-first-deploy.run.app"`
3. With your actual URL: `NEXTAUTH_URL: "https://xantuus-ai-xxxxx.run.app"`

Then redeploy:

```bash
~/google-cloud-sdk/bin/gcloud run services update xantuus-ai \
  --region us-central1 \
  --env-vars-file env.yaml
```

---

### Step 7: Update Google OAuth Redirect URIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Find your OAuth 2.0 Client ID
3. Add these to **Authorized redirect URIs**:
   - `https://YOUR-CLOUD-RUN-URL.run.app/api/auth/callback/google`
   - `http://localhost:3010/api/auth/callback/google` (for local dev)

---

## 🎯 Alternative: Use the Deploy Script

Once authenticated, you can use the deploy script:

```bash
cd /Users/darchie/platform/ai-layout/ai-layout-next
./deploy.sh
```

---

## 📊 Monitor Your Deployment

### View Logs
```bash
~/google-cloud-sdk/bin/gcloud run services logs read xantuus-ai \
  --region us-central1 \
  --limit 50
```

### View in Console
```bash
# Open Cloud Run console
open "https://console.cloud.google.com/run?project=xantuus-ai-prod"
```

---

## 💰 Expected Costs

- **Free tier**: 2 million requests/month FREE
- **After free tier**: ~$0.40 per million requests
- **With min-instances=0**: No idle charges
- **Estimated**: $0-50/month for typical usage

---

## 🔧 Troubleshooting

### Build Fails
```bash
# View build logs
~/google-cloud-sdk/bin/gcloud builds list --limit 1
```

### Service Won't Start
```bash
# Check logs for errors
~/google-cloud-sdk/bin/gcloud run services logs read xantuus-ai \
  --region us-central1 \
  --filter="severity>=ERROR"
```

### Database Connection Issues
- Verify DATABASE_URL is correct in env.yaml
- Check Supabase connection pooling is enabled
- Ensure SSL mode is set: `?sslmode=require`

---

## ✨ Your Deployment is Ready!

All configuration files are in place:
- ✅ `env.yaml` - Environment variables
- ✅ `Dockerfile` - Container configuration
- ✅ `next.config.js` - Standalone build mode
- ✅ `.dockerignore` - Optimized build context

**Just run the commands above and you'll be live in minutes!**

---

## 📞 Need Help?

- Full guide: See `DEPLOYMENT_GUIDE.md`
- Quick reference: See `QUICK_DEPLOY.md`
- Cloud Run docs: https://cloud.google.com/run/docs
