# 🚀 Deploy to Vercel - Simplified Guide

## Step 1: Add Environment Variables (Vercel Dashboard)

**Open this link:**
```
https://vercel.com/david-archies-projects-af46d129/ai-layout-next/settings/environment-variables
```

Or manually:
1. Go to https://vercel.com/dashboard
2. Click on **ai-layout-next** project
3. Go to **Settings** → **Environment Variables**

---

## Step 2: Add Each Variable

Click **"Add New"** and enter:

### Variable 1: DATABASE_URL
```
Name: DATABASE_URL
Value: postgresql://postgres.oydugfovufqzmicgunun:Da013093%21Ba040617@aws-1-us-east-1.pooler.supabase.com:5432/postgres
Environments: ✓ Production ✓ Preview ✓ Development
```

### Variable 2: DIRECT_URL
```
Name: DIRECT_URL
Value: postgresql://postgres.oydugfovufqzmicgunun:Da013093%21Ba040617@aws-1-us-east-1.pooler.supabase.com:5432/postgres
Environments: ✓ Production ✓ Preview ✓ Development
```

### Variable 3: NEXTAUTH_SECRET
```
Name: NEXTAUTH_SECRET
Value: +U9yHEmuAYcYpKhx76VDx/RcUa5exjR+I1DFwFVBKRE=
Environments: ✓ Production ✓ Preview ✓ Development
```

### Variable 4: GOOGLE_CLIENT_ID
```
Name: GOOGLE_CLIENT_ID
Value: YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
Environments: ✓ Production ✓ Preview ✓ Development
```

### Variable 5: GOOGLE_CLIENT_SECRET
```
Name: GOOGLE_CLIENT_SECRET
Value: YOUR_GOOGLE_CLIENT_SECRET
Environments: ✓ Production ✓ Preview ✓ Development
```

### Variable 6: ANTHROPIC_API_KEY
```
Name: ANTHROPIC_API_KEY
Value: sk-ant-YOUR_ANTHROPIC_API_KEY
Environments: ✓ Production ✓ Preview ✓ Development
```

### Variable 7: ADMIN_EMAIL
```
Name: ADMIN_EMAIL
Value: david.archie@me.com
Environments: ✓ Production ✓ Preview ✓ Development
```

### Variable 8: NEXTAUTH_URL (Skip for now - add after deployment)
```
Will add after we get the deployment URL
```

---

## Step 3: Redeploy

After adding all 7 variables, run:

```bash
cd /Users/darchie/platform/ai-layout/ai-layout-next
vercel --prod
```

**This should succeed now!** ✅

---

## Step 4: Get Your Live URL

After successful deployment, you'll see:

```
✔ Production: https://ai-layout-next-xxxxx.vercel.app
```

Copy this URL!

---

## Step 5: Add NEXTAUTH_URL

Go back to Vercel Dashboard → Environment Variables and add:

```
Name: NEXTAUTH_URL
Value: https://ai-layout-next-xxxxx.vercel.app (use YOUR actual URL)
Environments: ✓ Production ✓ Preview ✓ Development
```

Then redeploy one more time:
```bash
vercel --prod
```

---

## Step 6: Update Google OAuth

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click your OAuth 2.0 Client ID
3. Add to **Authorized redirect URIs**:
   ```
   https://ai-layout-next-xxxxx.vercel.app/api/auth/callback/google
   ```
4. Click **Save**

---

## ✅ Done!

Your app should now be live at: `https://ai-layout-next-xxxxx.vercel.app`

Test it by:
1. Opening the URL
2. Clicking "Sign In"
3. Testing the template gallery at `/templates`
4. Accessing admin at `/admin/templates` (using david.archie@me.com)

---

## 🐛 Troubleshooting

### Build Still Fails
```bash
# Check the build logs
vercel logs
```

### Can't Access Dashboard
```bash
# Open dashboard
open "https://vercel.com/dashboard"
```

### Need to See All Values Again
```bash
cat /Users/darchie/platform/ai-layout/ai-layout-next/VERCEL_ENV_VALUES.txt
```
