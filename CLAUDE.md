# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Xantuus AI is a full-stack Next.js 14 SaaS platform providing AI-powered chat with integrated authentication, subscriptions, usage tracking, and analytics. The application uses the App Router architecture with server components and API routes.

## Common Development Commands

### Development Server
```bash
npm run dev          # Start development server on port 3010
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Database Operations
```bash
npx prisma studio             # Open visual database editor (port 5555)
npx prisma generate           # Generate Prisma Client after schema changes
npx prisma db push            # Push schema changes to database (development)
npx prisma migrate dev        # Create and apply migration (production-ready)
npx prisma format             # Format schema file
```

### Stripe Development (if using Stripe)
```bash
stripe listen --forward-to localhost:3010/api/stripe/webhook
stripe trigger customer.subscription.created
```

### Database Setup
```bash
./setup-database.sh           # Interactive database setup script
```

## High-Level Architecture

### Authentication & Session Management
The app uses NextAuth.js with a Prisma adapter for database-backed sessions:
- **Configuration**: `src/app/api/auth/[...nextauth]/route.ts`
- **Prisma integration**: Uses `User`, `Account`, `Session`, and `VerificationToken` tables
- **Session extension**: Custom session type adds `userId` and `credits` (see `src/types/next-auth.d.ts`)
- **OAuth providers**: Google, Microsoft (Azure AD), and Apple Sign In
- **Middleware**: API routes use `getServerSession()` to verify authentication

### Credit System Architecture
The credit system is central to the platform and spans multiple modules:

**Credit Flow**:
1. User authentication → User record created with `monthlyCredits` based on plan
2. Chat/API request → Check credits via `hasEnoughCredits()` in `src/lib/credits.ts`
3. AI API call → Calculate token usage
4. Deduction → `deductCredits()` creates `UsageRecord` and updates `User.creditsUsed`
5. Reset → `checkAndResetCredits()` runs on each API call, resets monthly if needed

**Key Files**:
- `src/lib/credits.ts`: Core credit logic (deduct, check, calculate, reset)
- `src/app/api/chat/route.ts`: Credit deduction on AI chat
- `src/app/api/usage/route.ts`: Usage analytics endpoint
- `prisma/schema.prisma`: `User.creditsUsed`, `User.monthlyCredits`, `UsageRecord` table

**Credit Pricing** (defined in `src/lib/credits.ts`):
- Haiku: 1 credit per 1K tokens
- Sonnet: 3 credits per 1K tokens
- Opus: 15 credits per 1K tokens

### Subscription & Billing System
The platform supports both Stripe and RevenueCat for subscriptions:

**Stripe Integration** (`src/lib/stripe.ts`):
- Plans defined: FREE (4,000 credits), PRO ($29, 12,000 credits), ENTERPRISE ($199, 40,000 credits)
- Checkout flow: `src/app/api/stripe/checkout/route.ts` creates checkout session
- Webhook: `src/app/api/stripe/webhook/route.ts` handles subscription events and updates `User` table
- Portal: `src/app/api/stripe/portal/route.ts` redirects to customer billing portal

**RevenueCat Integration** (mobile/cross-platform):
- Server SDK: `src/lib/revenuecat-server.ts`
- Client SDK: `src/lib/revenuecat.ts`
- Webhook: `src/app/api/revenuecat/webhook/route.ts`

**Subscription Flow**:
1. User clicks "Subscribe" on `/pricing` page
2. API creates Stripe/RevenueCat checkout session
3. User completes payment
4. Webhook receives event → Updates `User.plan`, `User.monthlyCredits`, `User.stripeSubscriptionId`
5. Settings page (`/settings/billing`) reflects new subscription

### Database Schema & Relationships

**Core Tables**:
- `User`: Central table with subscription info, credits, and Google integration tokens
- `Account`: OAuth provider accounts (one-to-many with User)
- `Session`: Active user sessions (one-to-many with User)
- `UsageRecord`: Tracks every AI/API usage with tokens and credits (one-to-many with User)
- `ApiKey`: User-generated API keys (one-to-many with User)
- `PromptTemplate` & `PromptTemplateCategory`: Template system for AI prompts

**Key User Fields**:
- Subscription: `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `stripeCurrentPeriodEnd`
- Credits: `plan`, `monthlyCredits`, `creditsUsed`, `creditsResetAt`
- Google: `googleAccessToken`, `googleRefreshToken`, `googleTokenExpiry`, `google*Enabled` flags
- RevenueCat: `revenueCatUserId`, `revenueCatCustomerId`

### Google Integrations
The platform includes Google Drive, Gmail, and Calendar integrations:

**OAuth Flow**:
1. Connect: `src/app/api/integrations/google/connect/route.ts` redirects to Google OAuth
2. Callback: `src/app/api/integrations/google/callback/route.ts` stores tokens in `User` table
3. Usage: Helper functions in `src/lib/google-*.ts` refresh tokens and call Google APIs
4. Disconnect: `src/app/api/integrations/google/disconnect/route.ts` clears tokens

**Integration Files**:
- `src/lib/google-oauth.ts`: OAuth setup and token refresh
- `src/lib/google-drive.ts`: Drive file listing and uploads
- `src/lib/google-gmail.ts`: Send emails via Gmail API
- `src/lib/google-calendar.ts`: List and create calendar events

**Settings UI**: `/settings/integrations` manages connection status

### Browser Control System
The app includes a Puppeteer-based browser automation system:

**Files**:
- `src/lib/browser-control.ts`: Core browser automation logic with stealth plugin
- `src/app/api/browser/session/route.ts`: Create/manage browser sessions
- `src/app/api/browser/action/route.ts`: Execute browser actions (navigate, click, type, etc.)
- `src/app/browser/page.tsx`: Browser control UI

**Note**: Browser control is resource-intensive and may not work in all serverless environments.

### API Route Patterns

**Authentication Middleware**:
```typescript
const session = await getServerSession(authOptions);
if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Credit Checking Pattern**:
```typescript
import { hasEnoughCredits, deductCredits } from '@/lib/credits';

// Before AI call
const canProceed = await hasEnoughCredits(userId, estimatedCredits);
if (!canProceed) {
  return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
}

// After AI call
await deductCredits(userId, actualCredits, {
  type: 'chat',
  model: 'claude-sonnet-4-5-20250929',
  tokens: tokenCount
});
```

**Database Transaction Pattern**:
```typescript
await prisma.$transaction([
  prisma.usageRecord.create({ data: {...} }),
  prisma.user.update({
    where: { id: userId },
    data: { creditsUsed: { increment: credits } }
  })
]);
```

### Template System
The prompt template system allows users and admins to create reusable AI prompts:

**Structure**:
- Templates can have variables: `{{variable_name}}` placeholders
- Variable config stored as JSON in `PromptTemplate.variables`
- Templates can be tier-gated (free/pro/enterprise) and require specific integrations
- Categories organize templates with icons and ordering

**API Endpoints**:
- `/api/templates`: List templates (filtered by tier, integrations)
- `/api/templates/[id]`: Get specific template
- `/api/templates/[id]/check-access`: Verify user has access
- `/api/admin/templates`: Admin CRUD operations

### Frontend Architecture

**Key Components**:
- `src/app/ChatInterface.tsx`: Main AI chat component with file upload and model selection
- `src/components/ui/claude-style-chat-input.tsx`: Chat input with file attachments
- `src/components/UserProfileDropdown.tsx`: User menu with settings navigation
- `src/components/ThemeToggle.tsx`: Dark/light mode toggle
- `src/components/ErrorBoundary.tsx`: Global error boundary

**Styling**: Tailwind CSS with shadcn/ui components in `src/components/ui/`

**State Management**: Zustand (imported but usage varies by component)

**Providers**: `src/components/providers/SessionProvider.tsx` wraps app with NextAuth session

### Settings Pages Structure
All settings pages are under `/settings/*`:
- `/settings/account`: Account info and danger zone
- `/settings/billing`: Subscription management and Stripe portal
- `/settings/usage`: Usage charts (Recharts) from `UsageRecord` table
- `/settings/api-keys`: API key generation and management
- `/settings/integrations`: Google services connection status

### Environment Variables
The app uses `.env.local` for configuration. Key required variables:

**Essential**:
- `DATABASE_URL`: PostgreSQL connection string (use Supabase connection pooling URL)
- `NEXTAUTH_SECRET`: Session encryption key (generate with `openssl rand -base64 32`)
- `NEXTAUTH_URL`: App URL (http://localhost:3010 for dev)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: OAuth credentials
- `ANTHROPIC_API_KEY`: Claude API key for AI chat

**Optional**:
- Stripe keys for subscriptions
- Azure AD / Apple credentials for additional OAuth
- Cloudflare Turnstile for bot protection
- RevenueCat API key for mobile billing

See `.env.example` for complete list with instructions.

## Important Patterns & Conventions

### Port Number
The app runs on **port 3010** (not 3000) to avoid conflicts. This is configured in the dev script.

### Prisma Client Singleton
`src/lib/prisma.ts` implements a singleton pattern to prevent multiple Prisma Client instances in development (hot reload issue).

### Type Safety
- TypeScript strict mode enabled
- Prisma generates types for all database models
- NextAuth types extended in `src/types/next-auth.d.ts`

### API Response Format
Most API routes return JSON with either:
- Success: `{ data: {...} }` or `{ success: true, ... }`
- Error: `{ error: 'message' }` with appropriate HTTP status code

### Credit Reset Strategy
Credits reset monthly based on `User.creditsResetAt`, not on subscription billing cycle. This is checked on every API call via `checkAndResetCredits()`.

### Webhook Signature Verification
Both Stripe and RevenueCat webhooks verify signatures to ensure authenticity:
- Stripe: Uses `stripe.webhooks.constructEvent()` with `STRIPE_WEBHOOK_SECRET`
- RevenueCat: Verifies signature header in webhook handler

## Testing the Platform

### Test Authentication Flow
1. Start dev server: `npm run dev`
2. Visit http://localhost:3010
3. Click "Sign In with Google"
4. Check database: `npx prisma studio` → User, Account, Session tables populated

### Test Credit System
1. Send a chat message
2. Check `UsageRecord` table for new entry
3. Verify `User.creditsUsed` incremented
4. Visit `/settings/usage` to see usage chart

### Test Subscription (Stripe)
1. Ensure Stripe keys configured
2. Visit `/pricing` and subscribe to Pro
3. Use test card: 4242 4242 4242 4242
4. Webhook updates `User.plan` and `User.monthlyCredits`
5. Visit `/settings/billing` to see active subscription

### Test API Keys
1. Visit `/settings/api-keys`
2. Create new key
3. Check `ApiKey` table for generated key

## Deployment Notes

### Vercel Deployment
1. Push to GitHub
2. Import to Vercel
3. Add all environment variables (update `NEXTAUTH_URL` to production domain)
4. Deploy

**Post-deployment**:
- Run `npx prisma migrate deploy` to apply migrations
- Update Stripe webhook endpoint to production URL
- Switch to Stripe live keys (remove `_test_` prefix)
- Update OAuth redirect URIs to production domain

### Database Migrations
- Development: Use `npx prisma db push` for quick iterations
- Production: Use `npx prisma migrate dev` to create migrations, then `npx prisma migrate deploy` in production

## Troubleshooting

### Prisma Client Issues
If you get "Prisma Client not generated" errors:
```bash
npx prisma generate
rm -rf .next
npm run dev
```

### Database Connection Issues
Verify `DATABASE_URL` is the connection pooling URL from Supabase (contains `.pooler.supabase.com`).

### Webhook Testing (Stripe)
Use Stripe CLI in development:
```bash
stripe listen --forward-to localhost:3010/api/stripe/webhook
# Copy webhook signing secret to STRIPE_WEBHOOK_SECRET in .env.local
```

### Authentication Debugging
- Ensure `NEXTAUTH_SECRET` is set
- Check OAuth redirect URIs match in provider console
- Verify browser allows cookies
- Check `Session` table in database after login attempt

## Key Dependencies

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type safety
- **Prisma**: ORM for PostgreSQL
- **NextAuth.js**: Authentication with OAuth
- **Stripe**: Payment processing
- **Anthropic SDK**: Claude AI API
- **shadcn/ui**: UI component library
- **Recharts**: Analytics charts
- **Puppeteer**: Browser automation (stealth mode)
- **Zustand**: State management
- **date-fns**: Date manipulation
