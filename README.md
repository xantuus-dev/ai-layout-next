# Xantuus AI - Full-Stack SaaS Platform

A complete AI-powered SaaS platform with authentication, subscriptions, usage tracking, and analytics.

## ✨ What's Built

### 🔐 Authentication System
- OAuth integration (Google, Microsoft, Apple)
- Cloudflare Turnstile bot protection
- Database-backed sessions
- Secure user management

### 💳 Complete Billing System
- Stripe checkout integration
- 3-tier pricing (Free, Pro $29, Enterprise $199)
- Self-service billing portal
- Automatic subscription management
- Webhook event handling

### 📊 Usage Analytics
- Real-time credit tracking
- Token-based usage calculation
- 30-day analytics charts with Recharts
- Detailed API usage monitoring

### ⚙️ Full Settings Dashboard
- Account management page
- Billing & subscription management
- Usage dashboard with interactive charts
- API key generation and management

### 💬 AI Chat Interface
- Claude-style chat input
- File upload support
- Model selection (Opus, Sonnet, Haiku)
- Extended thinking mode
- Credit tracking per message

### 🎨 Modern UI
- Responsive design
- Dark mode support
- shadcn/ui components
- Tailwind CSS styling
- Professional SaaS aesthetic

## 🗄️ Database (Supabase + PostgreSQL)

**6 Production-Ready Tables:**

| Table | Purpose | Features |
|-------|---------|----------|
| **User** | Accounts & subscriptions | Stripe integration, credit tracking |
| **Account** | OAuth providers | Google, Microsoft, Apple |
| **Session** | Active sessions | Database-backed sessions |
| **UsageRecord** | API usage analytics | Token tracking, charts |
| **ApiKey** | User API keys | Secure key generation |
| **VerificationToken** | Email verification | Optional feature |

## 🚀 Quick Start (3 Steps)

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Database
```bash
# Interactive setup script
chmod +x setup-database.sh
./setup-database.sh

# Or follow the 5-minute guide
cat SUPABASE_QUICKSTART.md
```

### 3. Configure & Run
```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local with your credentials
# - Add DATABASE_URL from Supabase
# - Add Google OAuth credentials (minimum)

# Generate Prisma client
npx prisma generate

# Create database tables
npx prisma db push

# Start development server
npm run dev
```

Visit **http://localhost:3010**

## 📚 Complete Documentation

### 🎯 Quick Guides
- **[SUPABASE_QUICKSTART.md](./SUPABASE_QUICKSTART.md)** - 5-minute database setup ⭐
- **[QUICK_START.md](./QUICK_START.md)** - Fast setup guide
- **[AUTH_SETUP.md](./AUTH_SETUP.md)** - OAuth provider configuration

### 📖 Detailed Guides
- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Complete setup instructions
- **[DATABASE_SETUP.md](./DATABASE_SETUP.md)** - Database reference
- **[DATABASE_INTEGRATION_MAP.md](./DATABASE_INTEGRATION_MAP.md)** - How database is used throughout app

### 🛠️ Scripts
- **[setup-database.sh](./setup-database.sh)** - Interactive database setup

## 🏗️ Tech Stack

### Frontend
- **Next.js 14** - React framework (App Router)
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS
- **shadcn/ui** - Beautiful UI components
- **Recharts** - Analytics charts

### Backend & Database
- **Next.js API Routes** - Serverless functions
- **NextAuth.js** - Authentication
- **Prisma ORM** - Type-safe database queries
- **Supabase** - PostgreSQL hosting
- **Stripe** - Payment processing

### AI & Security
- **Anthropic Claude API** - AI chat
- **Cloudflare Turnstile** - Bot protection
- **OAuth Providers** - Google, Microsoft, Apple

## 📁 Project Structure

```
ai-layout-next/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/   # NextAuth config + Prisma adapter
│   │   │   ├── chat/                 # AI chat with usage tracking
│   │   │   ├── stripe/
│   │   │   │   ├── checkout/         # Create subscriptions
│   │   │   │   ├── webhook/          # Handle Stripe events
│   │   │   │   └── portal/           # Customer billing portal
│   │   │   ├── usage/                # Analytics API
│   │   │   └── api-keys/             # API key CRUD
│   │   ├── pricing/                  # Pricing page
│   │   ├── settings/
│   │   │   ├── account/              # Account settings
│   │   │   ├── billing/              # Subscription management
│   │   │   ├── usage/                # Usage dashboard with charts
│   │   │   └── api-keys/             # API key management
│   │   └── page.tsx                  # Homepage with chat
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components
│   │   └── providers/                # SessionProvider
│   ├── lib/
│   │   ├── prisma.ts                 # Prisma client
│   │   └── stripe.ts                 # Stripe config & plans
│   └── types/
│       └── next-auth.d.ts            # Session type extensions
├── prisma/
│   └── schema.prisma                 # Database schema (6 tables)
├── Documentation (*.md)              # All setup guides
└── .env.local                        # Your secrets (not in Git)
```

## 🔑 Required Environment Variables

Minimum to get started:

```env
# Database (required)
DATABASE_URL=postgresql://postgres.xxx:[PASSWORD]@aws-0-xxx.pooler.supabase.com:5432/postgres

# NextAuth (required)
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3010

# Google OAuth (required - easiest to set up)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx

# AI API (required for chat)
ANTHROPIC_API_KEY=sk-ant-xxx
```

Optional for full functionality:

```env
# Additional OAuth providers
AZURE_AD_CLIENT_ID=xxx
AZURE_AD_CLIENT_SECRET=xxx
APPLE_ID=xxx
APPLE_SECRET=xxx

# Cloudflare Turnstile (bot protection)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=xxx

# Stripe (for subscriptions)
STRIPE_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRO_PRICE_ID=price_xxx
STRIPE_ENTERPRISE_PRICE_ID=price_xxx
```

See `.env.example` for complete list with instructions.

## 🎯 Feature Highlights

### Database Integration
✅ Every feature is backed by the database:
- User authentication → `User` + `Account` + `Session` tables
- Chat messages → `UsageRecord` table (token tracking)
- Subscriptions → `User.stripeSubscriptionId` + webhook updates
- API keys → `ApiKey` table
- Usage charts → `UsageRecord` aggregation

### Real-Time Credit Tracking
```typescript
// Each chat message:
1. Checks if user has credits
2. Calls Claude API
3. Counts tokens
4. Records usage in database
5. Updates user's credit count
6. Shows remaining credits
```

### Complete Subscription Flow
```typescript
// User subscribes:
1. Stripe checkout
2. Payment succeeds
3. Webhook updates database
4. User.plan = "pro"
5. User.monthlyCredits = 50000
6. Settings page updates automatically
```

## 📈 Pricing Tiers

| Feature | Free | Pro ($29/mo) | Enterprise ($199/mo) |
|---------|------|--------------|---------------------|
| **Credits/month** | 1,000 | 50,000 | 500,000 |
| **AI Models** | Basic | All | All |
| **Support** | Email | Priority | Dedicated |
| **API Access** | ❌ | ✅ | ✅ |
| **Advanced Automation** | ❌ | ✅ | ✅ |
| **SLA Guarantee** | ❌ | ❌ | ✅ |
| **Custom Model Fine-tuning** | ❌ | ❌ | ✅ |

Configured in `src/lib/stripe.ts`

## 🧪 Testing the Complete Flow

### 1. Test Authentication
```bash
npm run dev
# Visit http://localhost:3010
# Click "Sign In with Google"
# Authenticate

# Check database:
npx prisma studio
# → User table: Your record appears!
# → Account table: Google provider linked
# → Session table: Active session
```

### 2. Test Chat & Usage Tracking
```bash
# Send a chat message
# Check database:
# → UsageRecord table: New record with tokens & credits
# → User.creditsUsed: Incremented

# Visit /settings/usage
# → See your usage on the chart!
```

### 3. Test Subscriptions (requires Stripe setup)
```bash
# Visit /pricing
# Click "Subscribe to Pro"
# Use test card: 4242 4242 4242 4242

# Webhook updates database:
# → User.plan = "pro"
# → User.monthlyCredits = 50000
# → User.stripeSubscriptionId set

# Visit /settings/billing
# → See active subscription
# → Click "Manage Subscription" → Stripe portal
```

### 4. Test API Keys
```bash
# Visit /settings/api-keys
# Create new key

# Check database:
# → ApiKey table: New record with generated key
```

## 🛠️ Development Commands

```bash
# Development
npm run dev          # Start dev server (port 3010)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# Database
npx prisma studio    # Visual database editor (port 5555)
npx prisma generate  # Generate Prisma Client
npx prisma db push   # Push schema changes (development)
npx prisma migrate dev  # Create migration (production)
npx prisma format    # Format schema file

# Stripe (development)
stripe listen --forward-to localhost:3010/api/stripe/webhook
stripe trigger customer.subscription.created
```

## 🗺️ How Database is Used

### User Flow → Database Operations

```
Sign In with Google
  ↓
CREATE User (email, name, plan="free", monthlyCredits=1000)
CREATE Account (provider="google", access_token, ...)
CREATE Session (sessionToken, expires)
  ↓
Send Chat Message
  ↓
READ User (check credits)
  ↓
Claude API Call (get tokens)
  ↓
CREATE UsageRecord (tokens, credits)
UPDATE User (creditsUsed += credits)
  ↓
Subscribe to Pro
  ↓
Stripe Checkout
  ↓
Webhook: UPDATE User (
  stripeSubscriptionId,
  plan="pro",
  monthlyCredits=50000
)
  ↓
View Usage Dashboard
  ↓
READ UsageRecord (last 30 days, GROUP BY date)
  ↓
Display Charts
```

See [DATABASE_INTEGRATION_MAP.md](./DATABASE_INTEGRATION_MAP.md) for complete mapping.

## 🔒 Security Features

- ✅ Environment variables in `.env.local` (gitignored)
- ✅ OAuth authentication (no passwords stored)
- ✅ Database-backed sessions (not JWT-only)
- ✅ Stripe webhook signature verification
- ✅ API route authentication checks
- ✅ Credit limit enforcement
- ✅ Cloudflare Turnstile bot protection
- ✅ SQL injection prevention (Prisma ORM)
- ✅ CORS configuration
- ✅ Type-safe queries (TypeScript + Prisma)

## 🚀 Production Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import to Vercel
3. Add all environment variables
4. Deploy

**Important**: Update in Vercel:
- `NEXTAUTH_URL` → Your domain
- `DATABASE_URL` → Production database
- All Stripe keys → Live keys (remove `_test_`)

### Database Migration
```bash
# After first deployment, run migrations
npx prisma migrate deploy
```

### Stripe Setup
1. Switch to live API keys
2. Create live products (Pro, Enterprise)
3. Add live webhook endpoint in Stripe Dashboard
4. Update price IDs in Vercel env vars

## 🆘 Troubleshooting

### "Can't connect to database"
```bash
# Verify DATABASE_URL format
# Should be Connection Pooling URL from Supabase
npx prisma db push
# Check Supabase dashboard - project should be active
```

### "Prisma Client not generated"
```bash
npx prisma generate
# Restart dev server
rm -rf .next && npm run dev
```

### "Authentication not working"
```bash
# Check NEXTAUTH_SECRET is set
# Verify OAuth redirect URIs match
# Check browser allows cookies
# View database: Session table should populate on login
```

### "Stripe webhook fails"
```bash
# Development: Use Stripe CLI
stripe login
stripe listen --forward-to localhost:3010/api/stripe/webhook
# Copy signing secret to STRIPE_WEBHOOK_SECRET

# Production: Configure in Stripe Dashboard
# Add endpoint: https://yourdomain.com/api/stripe/webhook
```

### "Usage charts not showing"
```bash
# Send some chat messages first
# Check database: UsageRecord table should have entries
# Visit /settings/usage - charts show last 30 days
```

## 📞 Resources

- **Supabase**: https://supabase.com/docs
- **Prisma**: https://prisma.io/docs
- **Stripe**: https://stripe.com/docs
- **NextAuth.js**: https://next-auth.js.org
- **Next.js**: https://nextjs.org/docs
- **shadcn/ui**: https://ui.shadcn.com

## 🎯 What's Next?

After setup, you can:

1. ✅ Customize pricing tiers in `src/lib/stripe.ts`
2. ✅ Add more OAuth providers
3. ✅ Customize credit calculation logic
4. ✅ Add email notifications (subscription events)
5. ✅ Implement team/organization features
6. ✅ Add more AI models
7. ✅ Create admin dashboard
8. ✅ Add usage limits enforcement
9. ✅ Implement referral program

## 📄 Notes

- Port 3010 (not 3000) to avoid conflicts
- Database uses Connection Pooling for serverless
- Credits reset monthly (handled by Stripe webhook)
- Free tier: 1,000 credits = ~1M tokens
- Supabase free tier: 500MB DB, perfect for development

---

**Ready to start?** Follow [SUPABASE_QUICKSTART.md](./SUPABASE_QUICKSTART.md) to set up your database in 5 minutes!

Built with Next.js, Prisma, Stripe, Supabase, and Claude AI.
