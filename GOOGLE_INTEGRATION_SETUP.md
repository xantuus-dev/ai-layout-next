# Google Integrations Setup Guide

This guide will help you set up Google OAuth integrations for Drive, Gmail, and Calendar features.

## Prerequisites

- A Google Cloud Platform (GCP) account
- Admin access to your Next.js application

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Create Project" or select an existing project
3. Give your project a name (e.g., "Xantuus AI Integrations")
4. Note your Project ID

## Step 2: Enable Required APIs

1. In the Google Cloud Console, go to **APIs & Services > Library**
2. Search for and enable the following APIs:
   - **Google Drive API**
   - **Gmail API**
   - **Google Calendar API**
   - **Google+ API** (for user profile information)

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services > OAuth consent screen**
2. Select **External** user type (or Internal if using Google Workspace)
3. Click **Create**

4. Fill in the App Information:
   - **App name**: Xantuus AI
   - **User support email**: Your email
   - **App logo**: (Optional) Upload your logo
   - **Application home page**: Your production URL (e.g., https://xantuus.ai)
   - **Application privacy policy link**: Your privacy policy URL
   - **Application terms of service link**: Your terms URL
   - **Authorized domains**: Add your domain (e.g., xantuus.ai)
   - **Developer contact information**: Your email

5. Click **Save and Continue**

6. Add Scopes:
   - Click **Add or Remove Scopes**
   - Add the following scopes:
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/userinfo.profile`
     - `https://www.googleapis.com/auth/drive.file`
     - `https://www.googleapis.com/auth/drive.readonly`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail.compose`
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/calendar`
     - `https://www.googleapis.com/auth/calendar.events`

7. Click **Update** and then **Save and Continue**

8. Add Test Users (if using External user type):
   - Add email addresses of users who will test the integration
   - Click **Save and Continue**

9. Review and click **Back to Dashboard**

## Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Select **Web application**

4. Configure the OAuth client:
   - **Name**: Xantuus AI Web Client

   - **Authorized JavaScript origins**: Add your URLs
     - http://localhost:3000 (for development)
     - https://your-production-domain.com

   - **Authorized redirect URIs**: Add callback URLs
     - http://localhost:3000/api/integrations/google/callback (for development)
     - https://your-production-domain.com/api/integrations/google/callback (for production)

5. Click **Create**

6. **IMPORTANT**: Save your credentials:
   - **Client ID**: Copy this value
   - **Client Secret**: Copy this value
   - Keep these secure and never commit them to version control

## Step 5: Update Environment Variables

Add the following variables to your `.env.local` file:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/integrations/google/callback

# For production, use your production URL:
# GOOGLE_REDIRECT_URI=https://your-domain.com/api/integrations/google/callback
```

## Step 6: Update Next.js Configuration

The OAuth redirect URI is automatically constructed from `NEXTAUTH_URL` if `GOOGLE_REDIRECT_URI` is not set:

```bash
# Make sure NEXTAUTH_URL is set correctly
NEXTAUTH_URL=http://localhost:3000

# For production:
# NEXTAUTH_URL=https://your-domain.com
```

## Step 7: Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `/settings/integrations`

3. Click "Connect Google Services"

4. You should be redirected to Google's OAuth consent screen

5. Grant the requested permissions

6. You should be redirected back to your app with services connected

## Troubleshooting

### "Redirect URI mismatch" error

- Ensure the redirect URI in your environment variables matches exactly what's configured in Google Cloud Console
- Check for trailing slashes - they must match exactly
- If using localhost, ensure the port matches (e.g., 3000)

### "Access blocked: This app's request is invalid"

- Make sure all required scopes are added to the OAuth consent screen
- Verify the OAuth consent screen is configured and published (or in testing mode)

### "Error 400: invalid_grant"

- Your refresh token may have expired or been revoked
- The user needs to reconnect their Google account
- Go to Settings > Integrations > Disconnect and reconnect

### "Unauthorized" or "403 Forbidden"

- Check that the required APIs are enabled in Google Cloud Console
- Verify your credentials are correct in `.env.local`
- Ensure the user has granted all necessary permissions

### Testing with External Users

If your app is in "Testing" mode:
- Only test users added to the OAuth consent screen can use the integration
- You have a limit of 100 test users
- Tokens expire after 7 days (users must reconnect)

To remove the 7-day expiration:
- Go through Google's verification process
- Submit your app for verification in the OAuth consent screen
- This typically takes 1-2 weeks

## Security Best Practices

1. **Never commit credentials to git**
   - Add `.env.local` to `.gitignore`
   - Use environment variables in production

2. **Use different credentials for development and production**
   - Create separate OAuth clients for each environment

3. **Rotate credentials periodically**
   - Generate new client secrets every 6-12 months
   - Update environment variables accordingly

4. **Implement proper error handling**
   - Log OAuth errors for debugging
   - Show user-friendly error messages
   - Provide clear instructions for reconnecting

5. **Handle token refresh**
   - The system automatically refreshes expired access tokens
   - Refresh tokens are stored securely in the database
   - Users need to reconnect if refresh token is revoked

## Production Deployment

Before deploying to production:

1. Create a production OAuth client in Google Cloud Console
2. Update authorized redirect URIs with production URLs
3. Submit your app for verification (if needed)
4. Set production environment variables:
   ```bash
   GOOGLE_CLIENT_ID=prod_client_id
   GOOGLE_CLIENT_SECRET=prod_client_secret
   GOOGLE_REDIRECT_URI=https://your-domain.com/api/integrations/google/callback
   NEXTAUTH_URL=https://your-domain.com
   ```

## API Quotas

Google APIs have usage quotas. Default quotas:

- **Gmail API**: 1 billion quota units per day
- **Drive API**: 1 billion queries per day
- **Calendar API**: 1 million queries per day

Each API call consumes quota units. Monitor usage in Google Cloud Console under **APIs & Services > Dashboard**.

## Support

For issues specific to:
- Google OAuth: [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- Gmail API: [Gmail API Documentation](https://developers.google.com/gmail/api)
- Drive API: [Drive API Documentation](https://developers.google.com/drive/api)
- Calendar API: [Calendar API Documentation](https://developers.google.com/calendar/api)

## Next Steps

After setting up Google integrations:
1. Create templates that use these integrations
2. Test the integration features thoroughly
3. Monitor API usage and quota consumption
4. Implement error handling and user notifications
5. Consider implementing webhook notifications for real-time updates
