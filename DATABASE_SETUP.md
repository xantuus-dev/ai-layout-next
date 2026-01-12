# Database Setup - Supabase Integration

## Database Analysis

### Required Tables

The app uses **6 tables** for complete functionality:

#### 1. **User** Table
**Purpose**: Store user accounts, subscription info, and credits
**Used in**:
- `/api/auth/[...nextauth]` - Authentication
- `/settings/account` - Display user info and plan
- `/settings/billing` - Show subscription status
- `/settings/usage` - Track credit usage
- `/api/stripe/checkout` - Store Stripe customer ID
- `/api/stripe/webhook` - Update subscription data

**Fields**:
- Basic info: id, name, email, image, emailVerified
- Stripe: stripeCustomerId, stripeSubscriptionId, stripePriceId, stripeCurrentPeriodEnd
- Credits: plan, monthlyCredits, creditsUsed, creditsResetAt
- Timestamps: createdAt, updatedAt

#### 2. **Account** Table
**Purpose**: Store OAuth provider accounts (Google, Microsoft, Apple)
**Used in**:
- `/api/auth/[...nextauth]` - Link OAuth accounts to users
- NextAuth Prisma Adapter - Manage provider connections

**Fields**:
- Provider info: provider, providerAccountId, type
- Tokens: access_token, refresh_token, id_token
- OAuth details: expires_at, token_type, scope, session_state

#### 3. **Session** Table
**Purpose**: Store active user sessions
**Used in**:
- `/api/auth/[...nextauth]` - Session management
- All authenticated pages - Verify user sessions
- NextAuth - Track logged-in users

**Fields**:
- sessionToken (unique identifier)
- userId (links to User)
- expires (session expiration)

#### 4. **VerificationToken** Table
**Purpose**: Email verification tokens
**Used in**:
- NextAuth email verification flow (if enabled)

**Fields**:
- identifier, token, expires

#### 5. **UsageRecord** Table
**Purpose**: Track API usage and credit consumption
**Used in**:
- `/api/usage` - Fetch usage analytics
- `/settings/usage` - Display usage charts
- `/api/chat` - Record each API call (when implemented)
- Future: Track automation runs, API calls, etc.

**Fields**:
- type: "chat", "api", "automation"
- model: AI model used
- tokens: Number of tokens consumed
- credits: Credits charged
- metadata: Additional JSON data
- createdAt: For time-based analytics

#### 6. **ApiKey** Table
**Purpose**: Store user-generated API keys
**Used in**:
- `/api/api-keys` - CRUD operations
- `/settings/api-keys` - Display and manage keys
- Future: Authenticate programmatic API access

**Fields**:
- name: User-given name
- key: Generated API key (xan_...)
- lastUsed: Track usage
- createdAt, updatedAt

## Database Relationships

```
User (1) ←→ (N) Account      # One user can have multiple OAuth providers
User (1) ←→ (N) Session      # One user can have multiple active sessions
User (1) ←→ (N) UsageRecord  # One user has many usage records
User (1) ←→ (N) ApiKey       # One user can create multiple API keys
```

## Where Database is Used in the App

### Authentication Flow
```
1. User clicks "Sign in with Google"
2. NextAuth creates/finds User record
3. NextAuth creates Account record (links Google to User)
4. NextAuth creates Session record
5. Session data returned to frontend
```

### Subscription Flow
```
1. User subscribes on /pricing
2. Stripe checkout creates subscription
3. Webhook updates User table:
   - stripeCustomerId
   - stripeSubscriptionId
   - stripePriceId
   - stripeCurrentPeriodEnd
   - plan (free/pro/enterprise)
   - monthlyCredits
```

### Usage Tracking Flow
```
1. User makes API call or uses chat
2. App creates UsageRecord entry
3. App increments User.creditsUsed
4. /settings/usage queries UsageRecord for charts
5. Monthly: Reset creditsUsed to 0
```

### API Key Flow
```
1. User creates API key in /settings/api-keys
2. App generates secure key (xan_...)
3. ApiKey record created
4. Key shown once, then hidden
5. Future: Validate API requests using this key
```

## Setup Instructions

### Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Click "New Project"
3. Fill in:
   - Name: `xantuus-ai`
   - Database Password: (generate strong password)
   - Region: Choose closest to you
4. Wait 2-3 minutes for setup

### Step 2: Get Connection String

1. In Supabase dashboard, go to **Settings** → **Database**
2. Under "Connection string", select **URI** format
3. Copy the connection string
4. Replace `[YOUR-PASSWORD]` with your actual password
5. **IMPORTANT**: Use the **Connection Pooling** URL for serverless/Next.js
   - Format: `postgresql://postgres.xxxxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres`

### Step 3: Configure Environment

Add to `.env.local`:

```env
# Supabase Database (Connection Pooling)
DATABASE_URL="postgresql://postgres.xxxxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
```

### Step 4: Create Tables

Run Prisma migration:

```bash
# Generate Prisma Client
npx prisma generate

# Push schema to database (creates all tables)
npx prisma db push
```

This creates:
- ✅ User table
- ✅ Account table
- ✅ Session table
- ✅ VerificationToken table
- ✅ UsageRecord table
- ✅ ApiKey table

### Step 5: Verify Setup

Open Prisma Studio to view your database:

```bash
npx prisma studio
```

Or check in Supabase:
1. Go to **Table Editor** in Supabase dashboard
2. You should see all 6 tables

### Step 6: Test Authentication

```bash
npm run dev
```

Visit http://localhost:3010 and:
1. Click "Sign In"
2. Authenticate with Google
3. Check Supabase Table Editor → `User` table
4. You should see your user record!

## Database Schema Diagram

```
┌─────────────────────────────────────────────────┐
│                    User                         │
├─────────────────────────────────────────────────┤
│ id (PK)                                        │
│ email (unique)                                  │
│ name, image, emailVerified                      │
│ stripeCustomerId, stripeSubscriptionId          │
│ plan, monthlyCredits, creditsUsed               │
│ createdAt, updatedAt                            │
└───────────┬─────────────────────────────────────┘
            │
            ├─────► Account (OAuth providers)
            │       - provider (google/microsoft/apple)
            │       - access_token, refresh_token
            │
            ├─────► Session (active sessions)
            │       - sessionToken
            │       - expires
            │
            ├─────► UsageRecord (analytics)
            │       - type, model, tokens, credits
            │       - createdAt (for charts)
            │
            └─────► ApiKey (API access)
                    - name, key
                    - lastUsed
```

## Indexes for Performance

The schema includes optimized indexes:

```sql
-- UsageRecord: Fast queries by user and date
CREATE INDEX "UsageRecord_userId_createdAt_idx" ON "UsageRecord"("userId", "createdAt");

-- ApiKey: Fast lookup by user
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");
```

## Data Flow Examples

### Example 1: New User Signs Up
```
1. User clicks "Sign in with Google"
2. INSERT into User (email, name, image, plan="free", monthlyCredits=1000)
3. INSERT into Account (userId, provider="google", access_token, ...)
4. INSERT into Session (userId, sessionToken, expires)
5. User redirected to homepage (authenticated)
```

### Example 2: User Subscribes to Pro Plan
```
1. User clicks "Subscribe" on Pro plan
2. Stripe checkout → payment successful
3. Webhook received at /api/stripe/webhook
4. UPDATE User SET:
   - stripeCustomerId = "cus_xxx"
   - stripeSubscriptionId = "sub_xxx"
   - plan = "pro"
   - monthlyCredits = 50000
5. User sees updated plan in /settings/account
```

### Example 3: User Makes API Call
```
1. User sends chat message
2. Claude API processes request
3. INSERT into UsageRecord:
   - userId = current user
   - type = "chat"
   - model = "claude-sonnet-4-5"
   - tokens = 1500
   - credits = 3
4. UPDATE User SET creditsUsed = creditsUsed + 3
5. Usage chart in /settings/usage shows new data point
```

### Example 4: User Creates API Key
```
1. User enters name in /settings/api-keys
2. Server generates: key = "xan_" + random(64 chars)
3. INSERT into ApiKey (userId, name, key)
4. Return full key to user (shown once)
5. Future requests can authenticate with this key
```

## Migration Commands Reference

```bash
# Generate Prisma Client (after schema changes)
npx prisma generate

# Push schema to database (development)
npx prisma db push

# Create migration (production)
npx prisma migrate dev --name init

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Open database viewer
npx prisma studio

# Validate schema
npx prisma validate

# Format schema file
npx prisma format
```

## Troubleshooting

### "Can't reach database server"
- Check DATABASE_URL is correct
- Ensure Supabase project is running
- Check IP allowlist in Supabase (should allow all for development)

### "Relation does not exist"
- Run `npx prisma db push` to create tables
- Check Supabase Table Editor to verify tables exist

### "Invalid connection string"
- Use Connection Pooling URL, not Direct URL
- Ensure password is URL-encoded if it contains special characters
- Format: `postgresql://USER:PASSWORD@HOST:5432/DATABASE`

### "Prisma Client not generated"
- Run `npx prisma generate`
- Restart dev server
- Check node_modules/@prisma/client exists

## Security Best Practices

1. **Never commit .env.local** - Contains sensitive database credentials
2. **Use connection pooling** - Better for serverless functions
3. **Enable Row Level Security** in Supabase (optional but recommended)
4. **Backup regularly** - Supabase has automatic backups (check Settings)
5. **Monitor usage** - Check Supabase dashboard for query performance

## Next Steps After Setup

1. ✅ Test authentication flow
2. ✅ Create test subscription
3. ✅ Generate API key
4. ✅ Check usage tracking works
5. ✅ Verify all settings pages load correctly

Your database is now fully integrated and ready for production!
