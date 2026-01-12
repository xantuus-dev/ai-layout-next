# Supabase Quick Start - 5 Minutes Setup

## What You'll Need
- A Supabase account (free tier works great!)
- 5 minutes

## Step-by-Step Guide

### 1. Create Supabase Project (2 minutes)

**Go to:** https://supabase.com

1. Click **"Start your project"** or **"New project"**

2. Sign in with GitHub (recommended) or create account

3. Create a new organization if prompted (name it whatever you like)

4. Fill in project details:
   ```
   Name: xantuus-ai
   Database Password: (click generate - SAVE THIS PASSWORD!)
   Region: [Choose closest to you]
   ```

5. Click **"Create new project"**

6. ⏳ Wait 2-3 minutes while Supabase sets up your database

### 2. Get Your Connection String (1 minute)

Once your project is ready:

1. Click **"Settings"** (gear icon in left sidebar)

2. Click **"Database"** in the settings menu

3. Scroll down to **"Connection string"** section

4. Select **"Connection pooling"** tab (important!)

5. Click **"URI"** button

6. Copy the connection string - it looks like:
   ```
   postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
   ```

7. Replace `[YOUR-PASSWORD]` with the password you saved in step 1.4

### 3. Add to Your Project (30 seconds)

Open `.env.local` and update the `DATABASE_URL`:

```env
DATABASE_URL="postgresql://postgres.xxxxx:YourActualPassword@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
```

**Replace the placeholder with your actual connection string!**

### 4. Create Tables (1 minute)

Run these commands:

```bash
# Generate Prisma client
npx prisma generate

# Create all database tables
npx prisma db push
```

You should see:
```
✔ Generated Prisma Client
✔ Your database is now in sync with your Prisma schema.
```

### 5. Verify Setup (30 seconds)

**Option A:** View in Supabase Dashboard
1. Go back to Supabase dashboard
2. Click **"Table Editor"** in left sidebar
3. You should see 6 tables:
   - User
   - Account
   - Session
   - VerificationToken
   - UsageRecord
   - ApiKey

**Option B:** View with Prisma Studio
```bash
npx prisma studio
```
Opens at http://localhost:5555 - you'll see all 6 tables!

### 6. Test It! (1 minute)

```bash
# Start your app
npm run dev

# Visit http://localhost:3010
# Click "Sign In" and authenticate with Google
```

Then check your database:
1. Go to Supabase **Table Editor**
2. Click **User** table
3. You should see YOUR user record! 🎉

## What Just Happened?

Your app now has a production-ready PostgreSQL database with:

✅ **User authentication** - OAuth accounts stored securely
✅ **Session management** - Active user sessions tracked
✅ **Subscription data** - Stripe integration ready
✅ **Usage analytics** - API calls and credits tracked
✅ **API keys** - User-generated keys for programmatic access

## Connection String Formats

### ❌ WRONG - Direct Connection
```
postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```
❌ Don't use this for Next.js/serverless

### ✅ CORRECT - Connection Pooling
```
postgresql://postgres.xxxxx:[PASSWORD]@aws-0-xxx.pooler.supabase.com:5432/postgres
```
✅ Use this one! Optimized for serverless/edge functions

## Troubleshooting

### "Can't reach database server"
- Double check your DATABASE_URL is correct
- Make sure you replaced `[YOUR-PASSWORD]` with actual password
- Check your Supabase project is running (green dot in dashboard)

### "Column does not exist"
- Run `npx prisma db push` again
- Check Supabase Table Editor to see if tables were created

### "Invalid connection string"
- Make sure you're using the **Connection Pooling** URL
- Ensure no extra spaces or quotes
- Password should be URL-encoded if it has special characters

## Next Steps

Now that your database is connected:

1. ✅ Authentication works (users are stored in DB)
2. ⏭️ Set up Stripe for subscriptions (see SETUP_GUIDE.md)
3. ⏭️ Test the complete flow:
   - Sign in
   - View settings pages
   - Create API keys
   - Check usage dashboard

## Useful Commands

```bash
# View database
npx prisma studio

# Reset database (WARNING: deletes all data!)
npx prisma migrate reset

# Generate client after schema changes
npx prisma generate

# Push schema changes
npx prisma db push
```

## Database Tables Overview

| Table | Purpose | Records |
|-------|---------|---------|
| **User** | User accounts, subscriptions, credits | One per user |
| **Account** | OAuth providers (Google, etc.) | One per provider per user |
| **Session** | Active login sessions | One+ per logged-in user |
| **UsageRecord** | API usage tracking | Many per user |
| **ApiKey** | User-generated API keys | 0+ per user |
| **VerificationToken** | Email verification | Temporary |

## Free Tier Limits

Supabase free tier includes:
- ✅ 500 MB database storage
- ✅ 1 GB file storage
- ✅ 2 GB bandwidth
- ✅ 50,000 monthly active users
- ✅ 500,000 monthly Edge Function invocations

**More than enough for development and early production!**

## Security Notes

1. ✅ Supabase has automatic backups (daily)
2. ✅ Connection pooling is secure and optimized
3. ✅ Your database password is never in Git (it's in .env.local)
4. ✅ Supabase uses encrypted connections (SSL/TLS)
5. ⚠️ Never commit `.env.local` to version control!

## Resources

- **Supabase Docs**: https://supabase.com/docs
- **Prisma Docs**: https://prisma.io/docs
- **Your Supabase Dashboard**: https://supabase.com/dashboard
- **Support**: See DATABASE_SETUP.md for detailed info

---

**You're all set!** Your Xantuus AI app now has a fully functional, production-ready database. 🚀
