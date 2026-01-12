# Database Integration Map

## Complete Database Usage Analysis

This document shows exactly where and how each database table is used throughout the Xantuus AI application.

## 📊 Database Tables Overview

```
┌─────────────────────────────────────────────────────────────┐
│  6 TABLES IN PRODUCTION DATABASE                            │
├─────────────────────────────────────────────────────────────┤
│  1. User           - 15 fields - Core user data             │
│  2. Account        - 10 fields - OAuth providers            │
│  3. Session        - 4 fields  - Active sessions            │
│  4. UsageRecord    - 7 fields  - API usage tracking         │
│  5. ApiKey         - 6 fields  - User API keys              │
│  6. VerificationToken - 3 fields - Email verification       │
└─────────────────────────────────────────────────────────────┘
```

## 🗂️ Table 1: User

### Fields (15 total)
```typescript
{
  id: string                    // Primary key
  email: string                 // Unique
  name: string?                 // From OAuth
  image: string?                // Avatar URL
  emailVerified: DateTime?      // Verification status

  // Stripe Integration
  stripeCustomerId: string?     // Stripe customer ID
  stripeSubscriptionId: string? // Active subscription
  stripePriceId: string?        // Price tier
  stripeCurrentPeriodEnd: DateTime? // Renewal date

  // Credits & Plan
  plan: string                  // "free", "pro", "enterprise"
  monthlyCredits: number        // Credit limit
  creditsUsed: number          // Current usage
  creditsResetAt: DateTime     // Reset date

  // Timestamps
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Used In (9 locations)

#### ✅ `/api/auth/[...nextauth]/route.ts`
**Lines: 40-61**
**Purpose**: Load user data into session
```typescript
const dbUser = await prisma.user.findUnique({
  where: { id: user.id },
  select: {
    id, plan, monthlyCredits, creditsUsed,
    stripeCustomerId, stripeSubscriptionId, stripeCurrentPeriodEnd
  },
});
// Attach to session for frontend access
```

#### ✅ `/api/chat/route.ts` (UPDATED)
**Lines: 31-40, 117-124**
**Purpose**: Check credits & record usage
```typescript
// Get user
const user = await prisma.user.findUnique({
  where: { email: session.user.email },
});

// Check credit limit
if (user.creditsUsed >= user.monthlyCredits) {
  return error('Credit limit reached');
}

// Update credits after API call
await prisma.user.update({
  where: { id: user.id },
  data: { creditsUsed: { increment: creditsUsed } },
});
```

#### ✅ `/api/stripe/checkout/route.ts`
**Lines: 25-46**
**Purpose**: Get/create Stripe customer
```typescript
const user = await prisma.user.findUnique({
  where: { email: session.user.email },
});

// Create Stripe customer if needed
if (!user.stripeCustomerId) {
  const customer = await stripe.customers.create({...});
  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
  });
}
```

#### ✅ `/api/stripe/webhook/route.ts`
**Lines: 42-128**
**Purpose**: Update subscription data
```typescript
await prisma.user.update({
  where: { id: userId },
  data: {
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
    plan: determinedPlan,
    monthlyCredits: newCreditLimit,
  },
});

// On cancellation
await prisma.user.update({
  where: { stripeSubscriptionId: subscription.id },
  data: {
    plan: 'free',
    monthlyCredits: 1000,
    stripeSubscriptionId: null,
  },
});
```

#### ✅ `/api/stripe/portal/route.ts`
**Lines: 16-27**
**Purpose**: Get customer ID for portal
```typescript
const user = await prisma.user.findUnique({
  where: { email: session.user.email },
});

if (!user.stripeCustomerId) {
  return error('No subscription found');
}
```

#### ✅ `/api/usage/route.ts`
**Lines: 14-22**
**Purpose**: Verify user exists
```typescript
const user = await prisma.user.findUnique({
  where: { email: session.user.email },
});
```

#### ✅ `/api/api-keys/route.ts`
**Lines: 17-24, 59-67, 100-108**
**Purpose**: Link API keys to user
```typescript
// GET - Find user
const user = await prisma.user.findUnique({
  where: { email: session.user.email },
  include: { apiKeys: true },
});

// POST - Create key for user
const user = await prisma.user.findUnique({
  where: { email: session.user.email },
});
const newApiKey = await prisma.apiKey.create({
  data: { userId: user.id, name, key },
});

// DELETE - Verify ownership
const user = await prisma.user.findUnique({
  where: { email: session.user.email },
});
```

#### ✅ `/settings/account/page.tsx`
**Frontend - via session**
**Purpose**: Display user info
```typescript
const { data: session } = useSession();
// Access user data from session:
session.user.plan
session.user.monthlyCredits
session.user.creditsUsed
```

#### ✅ `/settings/billing/page.tsx`
**Frontend - via session**
**Purpose**: Show subscription status
```typescript
session.user.stripeCurrentPeriodEnd
session.user.plan
```

---

## 🗂️ Table 2: Account

### Fields (10 total)
```typescript
{
  id: string                 // Primary key
  userId: string            // Links to User
  type: string              // "oauth"
  provider: string          // "google", "azure-ad", "apple"
  providerAccountId: string // Provider's user ID
  access_token: string?     // OAuth access token
  refresh_token: string?    // OAuth refresh token
  expires_at: number?       // Token expiry
  token_type: string?       // "Bearer"
  scope: string?            // OAuth scopes
  id_token: string?         // OpenID Connect token
  session_state: string?    // OAuth session
}
```

### Used In (1 location)

#### ✅ `/api/auth/[...nextauth]/route.ts`
**Lines: 8** (via PrismaAdapter)
**Purpose**: Store OAuth provider accounts
```typescript
adapter: PrismaAdapter(prisma)
// Automatically manages Account records:
// - Creates Account when user signs in with provider
// - Links multiple providers to same user
// - Stores & refreshes OAuth tokens
```

**Flow:**
1. User clicks "Sign in with Google"
2. OAuth flow completes
3. NextAuth creates/updates Account record
4. Links Account to User via userId

---

## 🗂️ Table 3: Session

### Fields (4 total)
```typescript
{
  id: string           // Primary key
  sessionToken: string // Unique session identifier
  userId: string      // Links to User
  expires: DateTime   // Session expiration
}
```

### Used In (2 locations)

#### ✅ `/api/auth/[...nextauth]/route.ts`
**Lines: 8, 70-72** (via PrismaAdapter)
**Purpose**: Manage user sessions
```typescript
adapter: PrismaAdapter(prisma)
session: { strategy: "database" }
// Automatically manages Session records:
// - Creates session on login
// - Validates sessionToken on requests
// - Deletes expired sessions
// - Handles logout (session deletion)
```

#### ✅ All authenticated pages (via getServerSession)
**Purpose**: Verify user is logged in
```typescript
const session = await getServerSession(authOptions);
// Queries Session table to validate sessionToken
// Returns user data if session is valid & not expired
```

---

## 🗂️ Table 4: UsageRecord

### Fields (7 total)
```typescript
{
  id: string         // Primary key
  userId: string    // Links to User
  type: string      // "chat", "api", "automation"
  model: string?    // AI model used
  tokens: number    // Tokens consumed
  credits: number   // Credits charged
  metadata: Json?   // Additional data
  createdAt: DateTime // When usage occurred
}
```

### Used In (2 locations)

#### ✅ `/api/chat/route.ts` (UPDATED)
**Lines: 101-114**
**Purpose**: Record each API call
```typescript
await prisma.usageRecord.create({
  data: {
    userId: user.id,
    type: 'chat',
    model: anthropicModel,
    tokens: totalTokens,
    credits: creditsUsed,
    metadata: {
      inputTokens,
      outputTokens,
      modelRequested: model,
    },
  },
});
```

#### ✅ `/api/usage/route.ts`
**Lines: 28-45**
**Purpose**: Fetch usage for analytics
```typescript
const usageRecords = await prisma.usageRecord.groupBy({
  by: ['createdAt'],
  where: {
    userId: user.id,
    createdAt: { gte: thirtyDaysAgo },
  },
  _sum: { credits: true },
  _count: { id: true },
});
// Returns aggregated data for charts
```

**Frontend consumption:**
- `/settings/usage/page.tsx` - Displays usage charts

---

## 🗂️ Table 5: ApiKey

### Fields (6 total)
```typescript
{
  id: string         // Primary key
  userId: string    // Links to User
  name: string      // User-given name
  key: string       // Generated API key (xan_...)
  lastUsed: DateTime? // Last usage timestamp
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Used In (2 locations)

#### ✅ `/api/api-keys/route.ts`
**Lines: 23-30, 74-83, 115-123**
**Purpose**: CRUD operations for API keys
```typescript
// GET - List user's keys
const user = await prisma.user.findUnique({
  where: { email: session.user.email },
  include: { apiKeys: { orderBy: { createdAt: 'desc' } } },
});
return user.apiKeys;

// POST - Create new key
const apiKey = `xan_${crypto.randomBytes(32).toString('hex')}`;
const newApiKey = await prisma.apiKey.create({
  data: { userId: user.id, name, key: apiKey },
});

// DELETE - Remove key
await prisma.apiKey.deleteMany({
  where: { id: keyId, userId: user.id },
});
```

**Frontend consumption:**
- `/settings/api-keys/page.tsx` - Manage API keys

---

## 🗂️ Table 6: VerificationToken

### Fields (3 total)
```typescript
{
  identifier: string  // Email or user identifier
  token: string      // Verification token (unique)
  expires: DateTime  // Token expiration
}
```

### Used In (1 location)

#### ✅ `/api/auth/[...nextauth]/route.ts`
**Lines: 8** (via PrismaAdapter)
**Purpose**: Email verification (if enabled)
```typescript
adapter: PrismaAdapter(prisma)
// Used if email provider is configured:
// - Stores magic link tokens
// - Validates email ownership
// - Expires old tokens
```

**Currently**: Not actively used (OAuth only)
**Future**: Can enable email magic links

---

## 📈 Usage Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  USER JOURNEY THROUGH DATABASE                                  │
└─────────────────────────────────────────────────────────────────┘

1. SIGN UP / SIGN IN
   ↓
   User clicks "Sign in with Google"
   ↓
   ┌──────────────────────────────────────┐
   │ CREATE User record                   │
   │   - email, name, image               │
   │   - plan = "free"                    │
   │   - monthlyCredits = 1000            │
   └──────────────────────────────────────┘
   ↓
   ┌──────────────────────────────────────┐
   │ CREATE Account record                │
   │   - provider = "google"              │
   │   - access_token, refresh_token      │
   └──────────────────────────────────────┘
   ↓
   ┌──────────────────────────────────────┐
   │ CREATE Session record                │
   │   - sessionToken (cookie)            │
   │   - expires in 30 days               │
   └──────────────────────────────────────┘

2. USE CHAT
   ↓
   User sends message
   ↓
   ┌──────────────────────────────────────┐
   │ READ User record                     │
   │   - Check creditsUsed < monthlyCredits│
   └──────────────────────────────────────┘
   ↓
   ┌──────────────────────────────────────┐
   │ Call Claude API                      │
   │   - Get response & token count       │
   └──────────────────────────────────────┘
   ↓
   ┌──────────────────────────────────────┐
   │ CREATE UsageRecord                   │
   │   - type = "chat"                    │
   │   - tokens = 1500                    │
   │   - credits = 2                      │
   └──────────────────────────────────────┘
   ↓
   ┌──────────────────────────────────────┐
   │ UPDATE User                          │
   │   - creditsUsed += 2                 │
   └──────────────────────────────────────┘

3. SUBSCRIBE
   ↓
   User clicks "Subscribe to Pro"
   ↓
   ┌──────────────────────────────────────┐
   │ READ User                            │
   │   - Get/create stripeCustomerId      │
   └──────────────────────────────────────┘
   ↓
   Stripe checkout → Payment → Webhook
   ↓
   ┌──────────────────────────────────────┐
   │ UPDATE User                          │
   │   - stripeSubscriptionId = "sub_xxx" │
   │   - plan = "pro"                     │
   │   - monthlyCredits = 50000           │
   └──────────────────────────────────────┘

4. VIEW USAGE
   ↓
   User opens /settings/usage
   ↓
   ┌──────────────────────────────────────┐
   │ READ UsageRecord (last 30 days)      │
   │   - GROUP BY createdAt               │
   │   - SUM credits                      │
   │   - COUNT requests                   │
   └──────────────────────────────────────┘
   ↓
   Display charts

5. CREATE API KEY
   ↓
   User creates key in /settings/api-keys
   ↓
   ┌──────────────────────────────────────┐
   │ CREATE ApiKey                        │
   │   - key = "xan_random64chars"        │
   │   - name = "Production API"          │
   └──────────────────────────────────────┘
```

## 🔍 Database Queries Summary

### Most Frequent Queries

| Query | Frequency | Location |
|-------|-----------|----------|
| `User.findUnique` | Every API call | All `/api/*` routes |
| `Session validation` | Every page load | NextAuth middleware |
| `UsageRecord.create` | Every chat message | `/api/chat` |
| `UsageRecord.groupBy` | Settings page view | `/api/usage` |
| `User.update` (credits) | Every chat message | `/api/chat` |
| `ApiKey CRUD` | API key management | `/settings/api-keys` |

### Write Operations

```typescript
// User writes
prisma.user.create()    // Sign up
prisma.user.update()    // Subscription, credits, Stripe ID

// Session writes
prisma.session.create()  // Login
prisma.session.delete()  // Logout

// Account writes
prisma.account.create()  // OAuth link
prisma.account.update()  // Token refresh

// Usage writes
prisma.usageRecord.create()  // Every API call

// API Key writes
prisma.apiKey.create()  // Key creation
prisma.apiKey.delete()  // Key deletion
```

## 🚀 Next Steps: Setting Up Your Database

### 1. Create Supabase Project
```bash
# Follow: SUPABASE_QUICKSTART.md
# Get your DATABASE_URL
```

### 2. Update .env.local
```env
DATABASE_URL="postgresql://postgres.xxxxx:[PASSWORD]@aws-0-xxx.pooler.supabase.com:5432/postgres"
```

### 3. Create Tables
```bash
npx prisma generate
npx prisma db push
```

### 4. Verify
```bash
npx prisma studio
# Check all 6 tables exist
```

### 5. Test
```bash
npm run dev
# Sign in → Check User table
# Send chat → Check UsageRecord table
# Create API key → Check ApiKey table
```

## 📊 Database Schema Visual

```
                    ┌──────────────────┐
                    │      User        │
                    │  (Central Hub)   │
                    └────────┬─────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ↓                ↓                ↓
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │   Account    │  │   Session    │  │ UsageRecord  │
    │  (OAuth)     │  │  (Login)     │  │ (Analytics)  │
    └──────────────┘  └──────────────┘  └──────────────┘
            │
            ↓
    ┌──────────────┐
    │   ApiKey     │
    │ (API Access) │
    └──────────────┘
```

---

**Your database is the brain of your app** - it stores users, tracks usage, manages subscriptions, and powers all the analytics!
