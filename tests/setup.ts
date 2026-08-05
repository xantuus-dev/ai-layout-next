// Loads the same env files Next.js uses in development (.env, then
// .env.local overriding it — matching Next's own precedence), so tests
// see real Stripe price IDs / API keys and hit the real dev database.
import { config } from 'dotenv';

config({ path: '.env' });
config({ path: '.env.local', override: true });
