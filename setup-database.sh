#!/bin/bash

# Supabase Database Setup Script for Xantuus AI
# This script helps you set up your Supabase database connection

echo "🚀 Xantuus AI - Supabase Database Setup"
echo "========================================"
echo ""

# Check if DATABASE_URL is already set
if grep -q "^DATABASE_URL=" .env.local 2>/dev/null; then
    echo "✓ DATABASE_URL already configured in .env.local"
    echo ""
    read -p "Do you want to update it? (y/N): " update
    if [[ ! $update =~ ^[Yy]$ ]]; then
        echo "Skipping DATABASE_URL configuration..."
        skip_db_url=true
    fi
fi

if [[ ! $skip_db_url ]]; then
    echo "📝 Step 1: Create Supabase Project"
    echo "-----------------------------------"
    echo "1. Go to https://supabase.com and sign in"
    echo "2. Click 'New Project'"
    echo "3. Fill in:"
    echo "   - Name: xantuus-ai (or your choice)"
    echo "   - Database Password: (generate strong password - SAVE THIS!)"
    echo "   - Region: Choose closest to you"
    echo "4. Wait 2-3 minutes for project to be created"
    echo ""
    read -p "Press ENTER when your Supabase project is ready..."
    echo ""

    echo "📝 Step 2: Get Connection String"
    echo "-----------------------------------"
    echo "1. In Supabase dashboard, go to Settings → Database"
    echo "2. Under 'Connection string', find 'Connection Pooling' section"
    echo "3. Click 'URI' format"
    echo "4. Copy the connection string"
    echo "5. Replace [YOUR-PASSWORD] with your actual database password"
    echo ""
    echo "IMPORTANT: Use 'Connection Pooling' URL, NOT 'Direct connection'"
    echo "Format: postgresql://postgres.xxxxx:[PASSWORD]@aws-0-xxx.pooler.supabase.com:5432/postgres"
    echo ""
    read -p "Paste your DATABASE_URL here: " database_url

    # Validate URL format
    if [[ ! $database_url =~ ^postgresql:// ]]; then
        echo "❌ Error: Invalid PostgreSQL connection string"
        echo "Make sure it starts with postgresql://"
        exit 1
    fi

    # Add to .env.local
    echo "" >> .env.local
    echo "# Database" >> .env.local
    echo "# Get connection string from: https://supabase.com" >> .env.local
    echo "DATABASE_URL=\"$database_url\"" >> .env.local

    echo ""
    echo "✓ DATABASE_URL added to .env.local"
fi

echo ""
echo "📝 Step 3: Generate Prisma Client"
echo "-----------------------------------"
npx prisma generate
if [ $? -eq 0 ]; then
    echo "✓ Prisma Client generated successfully"
else
    echo "❌ Failed to generate Prisma Client"
    exit 1
fi

echo ""
echo "📝 Step 4: Create Database Tables"
echo "-----------------------------------"
echo "This will create 6 tables in your Supabase database:"
echo "  - User (user accounts & subscriptions)"
echo "  - Account (OAuth providers)"
echo "  - Session (active sessions)"
echo "  - VerificationToken (email verification)"
echo "  - UsageRecord (usage analytics)"
echo "  - ApiKey (API keys)"
echo ""
read -p "Create tables now? (Y/n): " create_tables

if [[ ! $create_tables =~ ^[Nn]$ ]]; then
    npx prisma db push
    if [ $? -eq 0 ]; then
        echo ""
        echo "✓ All tables created successfully!"
    else
        echo ""
        echo "❌ Failed to create tables"
        echo "Check your DATABASE_URL and try again"
        exit 1
    fi
fi

echo ""
echo "📝 Step 5: Verify Setup"
echo "-----------------------------------"
echo "Opening Prisma Studio to view your database..."
echo "This will open in your browser at http://localhost:5555"
echo ""
echo "You should see all 6 tables (they'll be empty for now)."
echo "Press Ctrl+C to close Prisma Studio when done."
echo ""
read -p "Press ENTER to open Prisma Studio..."
npx prisma studio

echo ""
echo "✅ Database Setup Complete!"
echo "=========================="
echo ""
echo "Next steps:"
echo "1. Start your dev server: npm run dev"
echo "2. Visit http://localhost:3010"
echo "3. Sign in with Google"
echo "4. Check Supabase Table Editor to see your user record!"
echo ""
echo "Documentation:"
echo "- DATABASE_SETUP.md - Complete database reference"
echo "- QUICK_START.md - Quick start guide"
echo "- SETUP_GUIDE.md - Full setup instructions"
echo ""
