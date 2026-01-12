# Authentication Setup Guide

This guide will help you set up OAuth authentication with Google, Microsoft, and Apple, plus Cloudflare Turnstile bot protection.

## Prerequisites

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Generate a NextAuth secret:
   ```bash
   openssl rand -base64 32
   ```
   Add it to `.env.local` as `NEXTAUTH_SECRET`

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select an existing one
3. Click "Create Credentials" → "OAuth client ID"
4. Configure consent screen if prompted:
   - User Type: External
   - App name: Xantuus AI
   - User support email: your email
   - Developer contact: your email
5. Application type: Web application
6. Authorized redirect URIs:
   - Development: `http://localhost:3010/api/auth/callback/google`
   - Production: `https://yourdomain.com/api/auth/callback/google`
7. Copy the Client ID and Client Secret to `.env.local`

## Microsoft/Azure AD OAuth Setup

1. Go to [Azure Portal](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Click "New registration"
3. Name: Xantuus AI
4. Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
5. Redirect URI:
   - Platform: Web
   - URI: `http://localhost:3010/api/auth/callback/azure-ad` (development)
   - Add production URI later: `https://yourdomain.com/api/auth/callback/azure-ad`
6. After creation:
   - Copy "Application (client) ID" to `AZURE_AD_CLIENT_ID`
   - Go to "Certificates & secrets" → "New client secret"
   - Copy the secret value to `AZURE_AD_CLIENT_SECRET`

## Apple OAuth Setup

1. Go to [Apple Developer](https://developer.apple.com/account/resources/identifiers/list/serviceId)
2. Click "+" to create a new identifier
3. Select "Services IDs" and continue
4. Description: Xantuus AI
5. Identifier: com.xantuus.signin (or your domain)
6. Enable "Sign in with Apple"
7. Configure:
   - Primary App ID: Create or select an App ID
   - Domains: localhost:3010 (development), yourdomain.com (production)
   - Return URLs:
     - `http://localhost:3010/api/auth/callback/apple`
     - `https://yourdomain.com/api/auth/callback/apple`
8. Create a private key:
   - Go to "Keys" → "+"
   - Enable "Sign in with Apple"
   - Download the .p8 key file
9. Generate client secret (complex process, see [NextAuth Apple Provider docs](https://next-auth.js.org/providers/apple))

**Note:** Apple OAuth is the most complex to set up. You may want to start with just Google and Microsoft.

## Cloudflare Turnstile Setup

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → Turnstile
2. Click "Add a widget"
3. Widget name: Xantuus AI Auth
4. Domain: localhost (development), yourdomain.com (production)
5. Widget mode: Managed (recommended)
6. Copy the Site Key to `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

## Testing

1. Ensure `.env.local` has at least:
   - `NEXTAUTH_SECRET`
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (easiest to test first)
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   - `ANTHROPIC_API_KEY`

2. Restart the development server:
   ```bash
   npm run dev
   ```

3. Test the flow:
   - Click "Sign In" or "Sign Up"
   - Try "Continue with Google"
   - Complete Turnstile verification
   - Verify successful authentication

## Production Deployment

Before deploying:

1. Update `NEXTAUTH_URL` to your production domain
2. Add production redirect URIs to all OAuth providers
3. Add production domain to Cloudflare Turnstile
4. Ensure all secrets are securely stored in your hosting platform's environment variables
5. Never commit `.env.local` to version control

## Troubleshooting

**"Redirect URI mismatch"**
- Verify the redirect URI in OAuth provider matches exactly: `http://localhost:3010/api/auth/callback/{provider}`

**"Invalid client secret"**
- Regenerate the secret in the provider console
- Ensure no extra spaces when copying to `.env.local`

**Turnstile not appearing**
- Check that `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set
- Verify the domain is authorized in Cloudflare dashboard

**Authentication succeeds but session not persisting**
- Verify `NEXTAUTH_SECRET` is set
- Check browser allows cookies
