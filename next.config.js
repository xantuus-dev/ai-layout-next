const { withSentryConfig } = require('@sentry/nextjs');
// Enables the "use workflow" / "use step" directives that the video pipeline
// (src/workflows/) is built on. Must wrap the config before Sentry does.
const { withWorkflow } = require('workflow/next');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  swcMinify: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
  },
  webpack: (config) => {
    // Workflow generates its route handlers as ESM .js files under
    // src/app/.well-known/workflow/. Next 14's webpack parses them as
    // CommonJS and fails with "'import' and 'export' may appear only with
    // sourceType: module". Marking them as ESM is what makes Workflow build
    // on Next 14 — the Workflow docs only cover Next 16.
    config.module.rules.push({
      test: /[\\/]\.well-known[\\/]workflow[\\/].*\.js$/,
      type: 'javascript/esm',
    });
    return config;
  },
}

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only print logs for uploading source maps in CI or when explicitly enabled
  silent: !process.env.CI && process.env.SENTRY_VERBOSE !== 'true',

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Automatically annotate React components to show their full name in breadcrumbs and session replay
  reactComponentAnnotation: {
    enabled: true,
  },

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the Sentry DSN you want to proxy is set in your .env file.
  tunnelRoute: '/monitoring',

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,

  webpack: {
    // Workflow generates its own route handlers under .well-known/workflow/.
    // Sentry's wrappingLoader rewrites route files and prepends an import to
    // them, which leaves those generated modules unparseable ("'import' and
    // 'export' may appear only with 'sourceType: module'") and fails the
    // build. They are internal transport endpoints, so there is nothing to
    // gain from instrumenting them anyway.
    excludeServerRoutes: [/^\/\.well-known\/workflow\//],
  },
};

// Make sure adding Sentry options is the last code to run before exporting
module.exports = withSentryConfig(withWorkflow(nextConfig), sentryWebpackPluginOptions);
