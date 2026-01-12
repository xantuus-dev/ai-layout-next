/**
 * Environment variable validation
 * Validates required environment variables at startup
 */

interface EnvValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate all required environment variables
 * Returns validation result with errors and warnings
 */
export function validateEnvironmentVariables(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required for basic functionality
  const required = {
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  };

  // Check required variables
  for (const [key, value] of Object.entries(required)) {
    if (!value) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }

  // At least one OAuth provider required
  const hasGoogleAuth = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const hasMicrosoftAuth = !!(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET);
  const hasAppleAuth = !!(process.env.APPLE_ID && process.env.APPLE_SECRET);

  if (!hasGoogleAuth && !hasMicrosoftAuth && !hasAppleAuth) {
    errors.push('At least one OAuth provider must be configured (Google, Microsoft, or Apple)');
  }

  // Warn about missing optional but recommended variables
  const hasStripe = !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET
  );

  const hasRevenueCat = !!(
    process.env.NEXT_PUBLIC_REVENUECAT_PUBLIC_KEY &&
    process.env.REVENUECAT_SECRET_KEY
  );

  if (!hasStripe && !hasRevenueCat) {
    warnings.push('No payment provider configured (Stripe or RevenueCat). Billing features will be disabled.');
  }

  if (hasStripe && !process.env.STRIPE_PRO_PRICE_ID) {
    warnings.push('STRIPE_PRO_PRICE_ID is not set. Pro plan subscriptions will not work.');
  }

  if (hasStripe && !process.env.STRIPE_ENTERPRISE_PRICE_ID) {
    warnings.push('STRIPE_ENTERPRISE_PRICE_ID is not set. Enterprise plan subscriptions will not work.');
  }

  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    warnings.push('Turnstile (Cloudflare bot protection) is not configured.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Log validation results to console
 * Useful for debugging environment configuration
 */
export function logEnvironmentValidation(): void {
  const result = validateEnvironmentVariables();

  if (!result.isValid) {
    console.error('\n❌ Environment Validation Failed:');
    result.errors.forEach(error => console.error(`  - ${error}`));
  } else {
    console.log('\n✅ Environment Validation Passed');
  }

  if (result.warnings.length > 0) {
    console.warn('\n⚠️  Environment Warnings:');
    result.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  console.log(''); // Empty line for readability
}

/**
 * Throw error if environment validation fails
 * Use this in critical paths where invalid environment should stop execution
 */
export function requireValidEnvironment(): void {
  const result = validateEnvironmentVariables();

  if (!result.isValid) {
    throw new Error(
      `Environment validation failed:\n${result.errors.join('\n')}`
    );
  }
}
