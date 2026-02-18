# Sentry Error Tracking Setup Guide

This guide explains how to set up Sentry for error tracking and performance monitoring in the ai-layout-next application.

## Why Sentry?

Sentry provides:
- **Real-time error tracking**: Get notified immediately when errors occur
- **Performance monitoring**: Track slow API routes and database queries
- **User context**: See which users are affected by errors
- **Breadcrumbs**: Understand the sequence of events leading to an error
- **Source maps**: View original source code in stack traces
- **Session replay**: Watch video recordings of user sessions with errors

## Step 1: Create a Sentry Account

1. Go to [https://sentry.io/signup/](https://sentry.io/signup/)
2. Sign up for a free account (includes 5K errors/month)
3. Create a new organization (e.g., "Xantuus")

## Step 2: Create a Sentry Project

1. Click **"Create Project"**
2. Select **Next.js** as the platform
3. Set alert frequency (recommended: "Alert me on every new issue")
4. Name your project: **"ai-layout-next"**
5. Click **"Create Project"**

## Step 3: Get Your DSN

After creating the project, you'll see your **DSN (Data Source Name)**.

It looks like:
```
https://abc123def456@o123456.ingest.sentry.io/789012
```

**Copy this DSN** - you'll need it for environment variables.

## Step 4: Configure Environment Variables

### Development (.env.local)

Create or update `.env.local`:

```bash
# Sentry Configuration
SENTRY_DSN="https://your-dsn-here@o123456.ingest.sentry.io/789012"
NEXT_PUBLIC_SENTRY_DSN="https://your-dsn-here@o123456.ingest.sentry.io/789012"

# Sentry Organization & Project (optional, for source maps)
SENTRY_ORG="your-org-name"
SENTRY_PROJECT="ai-layout-next"

# Auth Token (optional, for uploading source maps)
SENTRY_AUTH_TOKEN="your-auth-token"
```

### Production (Vercel)

Add the same environment variables to your Vercel project:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable:
   - `SENTRY_DSN`
   - `NEXT_PUBLIC_SENTRY_DSN`
   - `SENTRY_ORG`
   - `SENTRY_PROJECT`
   - `SENTRY_AUTH_TOKEN` (optional but recommended)

**Important**: Make sure to add variables for all environments (Production, Preview, Development).

## Step 5: Generate a Sentry Auth Token (Optional but Recommended)

Auth tokens allow Sentry to upload source maps automatically, giving you readable stack traces in production.

1. Go to [https://sentry.io/settings/account/api/auth-tokens/](https://sentry.io/settings/account/api/auth-tokens/)
2. Click **"Create New Token"**
3. Name it: **"ai-layout-next-deployment"**
4. Scopes required:
   - `project:read`
   - `project:releases`
   - `org:read`
5. Click **"Create Token"**
6. **Copy the token** (you won't be able to see it again!)
7. Add it to your environment variables as `SENTRY_AUTH_TOKEN`

## Step 6: Test the Integration

### Test Locally

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Trigger a test error by visiting:
   ```
   http://localhost:3010/api/test-sentry
   ```

3. Check your Sentry dashboard - you should see the error appear within seconds

### Test Error Tracking in Code

Create a test API route:

```typescript
// src/app/api/test-sentry/route.ts
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

export async function GET() {
  try {
    throw new Error('This is a test error from Sentry integration!');
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
}
```

## Step 7: Verify Production Deployment

After deploying to Vercel:

1. Visit your production site
2. Trigger an error (e.g., try to execute an agent task without credits)
3. Check Sentry dashboard for the error

You should see:
- Error details and stack trace
- User ID (if authenticated)
- Task ID and context
- Request URL and user agent
- Breadcrumbs showing events leading to the error

## Features Integrated

### Automatic Error Tracking

Errors are automatically tracked in:
- ✅ Agent execution failures
- ✅ Tool execution errors
- ✅ Step failures
- ✅ API route errors
- ✅ Client-side errors
- ✅ Server-side errors

### Performance Monitoring

Track performance of:
- API routes
- Database queries
- Agent executions
- Tool executions

Sample rate: 10% in production (configurable in `sentry.*.config.ts`)

### Session Replay

See video recordings of user sessions where errors occurred:
- 10% of all sessions
- 100% of sessions with errors

Configured in `sentry.client.config.ts`.

### User Context

All errors include:
- User ID
- Task ID (for agent errors)
- Tool name (for tool errors)
- Step number (for step errors)

### Breadcrumbs

Track user actions:
- Task started
- Step executed
- Tool called
- API requests

## Sentry Dashboard Overview

### Issues Tab
- View all errors grouped by type
- See frequency and user impact
- Mark issues as resolved

### Performance Tab
- View slow transactions
- Identify bottlenecks
- Track database queries

### Releases Tab
- Track errors by deployment
- Compare error rates between versions

### Alerts Tab
- Configure notifications
- Set up Slack/email alerts
- Define alert rules

## Alert Configuration (Recommended)

1. Go to **Settings** → **Alerts**
2. Create a new alert rule:
   - **Name**: "Critical Agent Errors"
   - **Conditions**: When an event is seen with tag `action` containing `step_`
   - **Actions**: Send a notification to Slack/email
3. Create another alert for high error volume:
   - **Name**: "Error Spike"
   - **Conditions**: When error count > 50 in 5 minutes
   - **Actions**: Send a notification

## Integration with Agent System

The following components now report to Sentry:

### AgentExecutor (`src/lib/agent/executor.ts`)
- Task execution failures
- Step failures
- User context tracking
- Breadcrumbs for task start

### Error Utilities (`src/lib/sentry.ts`)
- `captureError()` - Capture errors with context
- `captureAgentError()` - Specialized for agent errors
- `captureToolError()` - Specialized for tool errors
- `captureAPIError()` - Specialized for API errors
- `addBreadcrumb()` - Track user actions
- `setUser()` / `clearUser()` - Manage user context

## Filtering Errors

The configuration automatically filters out:
- ❌ Redis connection errors during development
- ❌ Next.js `DYNAMIC_SERVER_USAGE` errors (not real errors)
- ❌ Browser extension errors
- ❌ Network errors that are not actionable

These filters are in:
- `sentry.client.config.ts` (browser)
- `sentry.server.config.ts` (server)
- `sentry.edge.config.ts` (edge runtime)

## Source Maps

Source maps are automatically uploaded to Sentry when:
- `SENTRY_AUTH_TOKEN` is configured
- Building for production (`npm run build`)
- Deploying to Vercel

This allows you to see the original TypeScript source code in stack traces, not minified JavaScript.

## Cost

**Free Tier** (included):
- 5,000 errors per month
- 10,000 performance units per month
- 500 replays per month
- 90 days of data retention

**Paid Plans** (if you exceed free tier):
- Team: $26/month (50K errors)
- Business: $80/month (100K errors)
- Enterprise: Custom pricing

## Troubleshooting

### Error: "DSN not configured"
**Solution**: Make sure `SENTRY_DSN` is set in your environment variables.

### Error: "Failed to upload source maps"
**Solution**:
1. Verify `SENTRY_AUTH_TOKEN` is correct
2. Verify `SENTRY_ORG` and `SENTRY_PROJECT` match your Sentry settings
3. Check token permissions include `project:releases`

### Errors not appearing in Sentry
**Solution**:
1. Check the error is not in the `ignoreErrors` list
2. Verify DSN is correct
3. Check network requests in browser DevTools (look for requests to `sentry.io`)
4. Ensure you're not in development mode (some errors are filtered)

### Too many errors
**Solution**:
1. Add specific errors to `ignoreErrors` list in config files
2. Adjust `tracesSampleRate` to capture fewer transactions
3. Set up better error boundaries to catch and handle errors gracefully

## Best Practices

1. **Always include context**: Use the utility functions to add user ID, task ID, and other context
2. **Don't log sensitive data**: Never send passwords, tokens, or PII to Sentry
3. **Set up alerts**: Get notified immediately of critical errors
4. **Review issues regularly**: Fix high-frequency errors first
5. **Use releases**: Tag deployments with release versions for better tracking
6. **Filter noise**: Add non-actionable errors to the ignore list
7. **Monitor performance**: Use performance monitoring to identify slow operations

## Next Steps

1. ✅ Set up Sentry account and project
2. ✅ Add environment variables
3. ✅ Deploy to production
4. ⏳ Configure alerts for critical errors
5. ⏳ Set up Slack integration for notifications
6. ⏳ Review errors daily and fix high-priority issues

## Support Links

- [Sentry Documentation](https://docs.sentry.io/)
- [Next.js Integration Guide](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Support](https://sentry.io/support/)
- [Dashboard](https://sentry.io/organizations/your-org/issues/)

---

**Last Updated**: February 18, 2026
