# 🚀 Deploy to Vercel - Step by Step

Your Next.js app is ready to deploy to Vercel for FREE!

---

## ✅ What's Ready

- ✅ Vercel CLI installed
- ✅ vercel.json configured
- ✅ Environment variables prepared
- ✅ All credentials available

---

## 🚀 Deployment Steps

### Step 1: Login to Vercel

```bash
cd /Users/darchie/platform/ai-layout/ai-layout-next
vercel login
```

This will open your browser. Sign in with:
- GitHub
- GitLab
- Bitbucket
- Email

---

### Step 2: Deploy Your Project

```bash
vercel
```

**Follow the prompts:**
- Set up and deploy? **Y**
- Which scope? **Select your account**
- Link to existing project? **N**
- What's your project name? **xantuus-ai** (or your choice)
- In which directory is your code? **./** (press Enter)
- Want to override settings? **N**

This will:
- ✅ Build your app
- ✅ Deploy to Vercel
- ✅ Give you a preview URL

---

### Step 3: Set Environment Variables

After the first deployment, set your environment variables:

```bash
# Database
vercel env add DATABASE_URL
# Paste: postgresql://postgres.oydugfovufqzmicgunun:Da013093%21Ba040617@aws-1-us-east-1.pooler.supabase.com:5432/postgres

vercel env add DIRECT_URL
# Paste: postgresql://postgres.oydugfovufqzmicgunun:Da013093%21Ba040617@aws-1-us-east-1.pooler.supabase.com:5432/postgres

vercel env add NEXTAUTH_SECRET
# Paste: (generate with: openssl rand -base64 32)

vercel env add GOOGLE_CLIENT_ID
# Paste: YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com

vercel env add GOOGLE_CLIENT_SECRET
# Paste: YOUR_GOOGLE_CLIENT_SECRET

vercel env add ANTHROPIC_API_KEY
# Paste: sk-ant-YOUR_ANTHROPIC_API_KEY

vercel env add ADMIN_EMAIL
# Paste: your-email@example.com
```

**For each variable:**
- Select environment: **Production, Preview, Development** (select all 3)
- Press Enter to confirm

---

### Step 4: Add NEXTAUTH_URL

After deployment, you'll get a URL like: `https://xantuus-ai-xxxxx.vercel.app`

Add this as an environment variable:

```bash
vercel env add NEXTAUTH_URL
# Paste: https://your-app-name.vercel.app (use YOUR actual URL)
```

---

### Step 5: Redeploy with Environment Variables

```bash
vercel --prod
```

This deploys to production with all your environment variables.

---

### Step 6: Update Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Find your OAuth 2.0 Client ID
3. Add these to **Authorized redirect URIs**:
   - `https://your-app-name.vercel.app/api/auth/callback/google`
   - `http://localhost:3010/api/auth/callback/google`

---

## 🎯 Quick Deploy (One Command)

If you want to deploy directly to production:

```bash
vercel --prod
```

---

## 🔧 Vercel Dashboard

Manage your deployment at:
```
https://vercel.com/dashboard
```

You can:
- ✅ View logs
- ✅ Manage environment variables
- ✅ Configure custom domains
- ✅ See analytics
- ✅ Roll back deployments

---

## 💰 Vercel Free Tier

**Included FREE:**
- ✅ Unlimited deployments
- ✅ 100 GB bandwidth/month
- ✅ Automatic SSL certificates
- ✅ Global CDN
- ✅ Preview deployments for Git branches
- ✅ Serverless functions

**No credit card required!**

---

## 🔄 Continuous Deployment

Connect to GitHub for automatic deployments:

1. Push your code to GitHub:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/xantuus-ai.git
   git push -u origin main
   ```

2. In Vercel Dashboard:
   - Import Git Repository
   - Select your repo
   - Vercel will auto-deploy on every push!

---

## 📊 Monitor Your App

### View Logs
```bash
vercel logs
```

### View Deployment Info
```bash
vercel ls
```

### Open in Browser
```bash
vercel open
```

---

## 🐛 Troubleshooting

### Build Fails

Check logs:
```bash
vercel logs --follow
```

### Environment Variables Not Working

List all env vars:
```bash
vercel env ls
```

Pull env vars locally:
```bash
vercel env pull
```

### Database Connection Issues

- Verify DATABASE_URL is correct
- Check Supabase connection pooling is enabled
- Ensure `?sslmode=require` is in connection string

---

## ✨ Your Deployment is Ready!

Just run:

```bash
cd /Users/darchie/platform/ai-layout/ai-layout-next
vercel
```

And follow the prompts. You'll be live in **2-3 minutes**! 🚀

---

## 🆚 Vercel vs GCP

**Vercel Advantages:**
- ✅ No billing required (free tier)
- ✅ Faster deployment (2-3 min vs 10 min)
- ✅ Automatic SSL & CDN
- ✅ Git integration built-in
- ✅ Better for Next.js (built by Vercel)

**GCP Advantages:**
- ✅ More control over infrastructure
- ✅ Can use other Google Cloud services
- ✅ Custom Docker configurations
- ✅ Higher resource limits

For this app, **Vercel is perfect**!
