/**
 * Sentry Server-Side Configuration
 *
 * This file configures Sentry for the Node.js server environment.
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
    // Redis connection errors during build (expected)
    'ECONNREFUSED',
    'connect ECONNREFUSED 127.0.0.1:6379',
    // Next.js dynamic server errors (not actual errors)
    'DYNAMIC_SERVER_USAGE',
  ],

  beforeSend(event, hint) {
    // Filter out expected errors
    const error = hint.originalException;

    // Filter Redis errors during build/development
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'ECONNREFUSED' && process.env.NODE_ENV !== 'production') {
        return null;
      }
    }

    // Filter Next.js dynamic server usage (not actual errors)
    if (error && typeof error === 'object' && 'digest' in error && error.digest === 'DYNAMIC_SERVER_USAGE') {
      return null;
    }

    return event;
  },

  // Add context to all events
  beforeBreadcrumb(breadcrumb) {
    // Filter out noisy breadcrumbs
    if (breadcrumb.category === 'console' && breadcrumb.level === 'log') {
      return null;
    }
    return breadcrumb;
  },
});
