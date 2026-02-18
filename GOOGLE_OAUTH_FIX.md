# Google OAuth 2.0 Error Fix Guide

**Error**: Access blocked: Authorization Error - Error 400: invalid_request

This error occurs when your Google OAuth app is not properly configured. Follow these steps to fix it:

---

## Step 1: Access Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account (darchie@xantuus.com)
3. Select your project (or create one if you haven't)

---

## Step 2: Enable Google+ API (Required)

1. In the left sidebar, go to **APIs & Services** → **Library**
2. Search for **"Google+ API"**
3. Click on it and press **Enable**
4. Also enable **"Google People API"** (search and enable)

---

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** user type (unless you have Google Workspace)
3. Click **Create** or **Edit**

### App Information:
- **App name**: Xantuus AI
- **User support email**: darchie@xantuus.com
- **App logo**: (Optional) Upload your logo
- **Application home page**: https://ai.xantuus.com
- **Application privacy policy**: https://ai.xantuus.com/privacy
- **Application terms of service**: https://ai.xantuus.com/terms
- **Authorized domains**:
  - `xantuus.com`

### Developer Contact:
- **Developer contact email**: darchie@xantuus.com

4. Click **Save and Continue**

### Scopes:
5. Click **Add or Remove Scopes**
6. Add these scopes:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
7. Click **Update** → **Save and Continue**

### Test Users (for Testing phase):
8. Click **Add Users**
9. Add your email: `darchie@xantuus.com`
10. Click **Save and Continue**

### Summary:
11. Review and click **Back to Dashboard**

---

## Step 4: Configure OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Find your OAuth 2.0 Client ID or click **+ Create Credentials** → **OAuth client ID**

### Create OAuth Client:
- **Application type**: Web application
- **Name**: Xantuus AI Web Client

### Authorized JavaScript origins:
Add these URIs:
```
http://localhost:3010
https://ai.xantuus.com
```

### Authorized redirect URIs:
Add these URIs (CRITICAL - must be exact):
```
http://localhost:3010/api/auth/callback/google
https://ai.xantuus.com/api/auth/callback/google
```

3. Click **Create**
4. **Copy** the Client ID and Client Secret

---

## Step 5: Update Environment Variables

Update your `.env.local` (for development):
```bash
GOOGLE_CLIENT_ID="your-client-id-here.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret-here"
NEXTAUTH_URL="http://localhost:3010"
NEXTAUTH_SECRET="your-nextauth-secret"
```

Update your production environment variables on Vercel:
```bash
# Go to Vercel Dashboard → Your Project → Settings → Environment Variables
GOOGLE_CLIENT_ID="your-client-id-here.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret-here"
NEXTAUTH_URL="https://ai.xantuus.com"
NEXTAUTH_SECRET="your-nextauth-secret"
```

---

## Step 6: Publishing Your App (For Production)

If you want to allow all users (not just test users):

1. Go to **OAuth consent screen**
2. Click **Publish App**
3. Click **Confirm**

**Note**: Your app will be in "Testing" status by default, which limits access to only the test users you added. Publishing makes it available to all Google users.

For production use without verification:
- You can keep it in "Testing" mode and add up to 100 test users
- OR publish it (Google will show a warning screen to users but they can proceed)
- OR go through [Google's verification process](https://support.google.com/cloud/answer/9110914) (recommended for production)

---

## Step 7: Test the Fix

1. Clear your browser cookies/cache or use incognito mode
2. Go to your app: https://ai.xantuus.com
3. Click "Sign in with Google"
4. You should now be able to sign in successfully

---

## Common Issues & Solutions

### Issue 1: "redirect_uri_mismatch"
**Solution**: Verify that the redirect URI in Google Cloud Console EXACTLY matches:
- `https://ai.xantuus.com/api/auth/callback/google`

No trailing slashes, must be exact.

### Issue 2: "Access blocked: This app's request is invalid"
**Solution**:
- Ensure Google+ API is enabled
- Ensure Google People API is enabled
- Check that scopes are configured correctly

### Issue 3: "Error 400: invalid_request"
**Solution**:
- Verify OAuth consent screen is fully configured
- Ensure your email is added as a test user (if app is in Testing mode)
- Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct

### Issue 4: "This app isn't verified"
**Solution**: This is normal for apps in development. Users can click "Advanced" → "Go to Xantuus AI (unsafe)" to proceed. To remove this warning:
- Complete Google's verification process
- OR keep app in Testing mode with approved test users

---

## Verification Checklist

Before testing, verify all these are complete:

- [ ] Google+ API enabled
- [ ] Google People API enabled
- [ ] OAuth consent screen fully configured
- [ ] Test user added (darchie@xantuus.com)
- [ ] OAuth credentials created
- [ ] Authorized JavaScript origins added
- [ ] Authorized redirect URIs added (exact match)
- [ ] Environment variables updated
- [ ] Production environment variables updated on Vercel
- [ ] Browser cache cleared

---

## Quick Command Reference

### Generate a new NEXTAUTH_SECRET (if needed):
```bash
openssl rand -base64 32
```

### Restart development server:
```bash
npm run dev
```

### Deploy to Vercel:
```bash
vercel --prod
```

---

## Support Links

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [NextAuth.js Google Provider Docs](https://next-auth.js.org/providers/google)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)

---

## Current Configuration

Your NextAuth configuration is located at:
- `src/lib/auth.ts`

Your callback URLs are:
- **Development**: `http://localhost:3010/api/auth/callback/google`
- **Production**: `https://ai.xantuus.com/api/auth/callback/google`

Make sure these EXACT URLs are in your Google OAuth app's authorized redirect URIs.

---

**Last Updated**: February 17, 2026
