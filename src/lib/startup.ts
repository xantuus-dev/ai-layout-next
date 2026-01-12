/**
 * Startup initialization
 * Run this once when the application starts
 */

import { logEnvironmentValidation } from './env-validation';

let isInitialized = false;

export function initializeApp() {
  if (isInitialized) {
    return;
  }

  // Only run in server environment
  if (typeof window === 'undefined') {
    console.log('🚀 Initializing Xantuus AI...');

    // Validate environment variables
    logEnvironmentValidation();

    isInitialized = true;
  }
}

// Auto-initialize on import in server context
if (typeof window === 'undefined') {
  initializeApp();
}
