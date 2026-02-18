/**
 * Sentry Edge Runtime Configuration
 *
 * This file configures Sentry for Edge Functions (middleware, edge API routes).
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  environment: process.env.NODE_ENV,

  // Filtering out common errors
  ignoreErrors: [
    // Redis connection errors (not applicable to edge but added for consistency)
    'ECONNREFUSED',
  ],
});
