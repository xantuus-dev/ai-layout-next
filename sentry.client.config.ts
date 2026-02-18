/**
 * Sentry Client-Side Configuration
 *
 * This file configures Sentry for the browser environment.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Capture Replay for 10% of all sessions,
  // plus 100% of sessions with an error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Note: if you want to override the automatic release value, do not set a
  // `release` value here - use the environment variable `SENTRY_RELEASE`, so
  // that it will also get attached to your source maps

  environment: process.env.NODE_ENV,

  // Filtering out common errors
  ignoreErrors: [
    // Browser extensions
    'top.GLOBALS',
    'chrome-extension',
    'moz-extension',
    // Facebook blocked
    'fb_xd_fragment',
    // Network errors that are not actionable
    'NetworkError',
    'Network request failed',
    // Redis connection errors during build (expected)
    'ECONNREFUSED',
  ],

  beforeSend(event, hint) {
    // Filter out Redis errors during development
    if (process.env.NODE_ENV === 'development') {
      const error = hint.originalException;
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ECONNREFUSED') {
        return null;
      }
    }

    return event;
  },

  integrations: [
    Sentry.replayIntegration({
      // Mask all text and images by default
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
