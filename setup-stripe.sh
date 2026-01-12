#!/bin/bash

# Stripe Setup Script for Vercel
# Run this after getting your keys from Stripe Dashboard

echo "🔧 Stripe Configuration Setup"
echo "=============================="
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

echo "📝 This script will help you add Stripe environment variables to Vercel"
echo ""
echo "You'll need the following from your Stripe Dashboard:"
echo "  1. Secret Key (sk_test_... or sk_live_...)"
echo "  2. Publishable Key (pk_test_... or pk_live_...)"
echo "  3. Webhook Secret (whsec_...)"
echo "  4. Pro Plan Price ID (price_...)"
echo "  5. Enterprise Plan Price ID (price_...)"
echo ""

read -p "Press Enter when you're ready to start..."

# Add Secret Key
echo ""
echo "Enter your Stripe Secret Key (sk_test_... or sk_live_...):"
read -s STRIPE_SECRET_KEY
echo $STRIPE_SECRET_KEY | vercel env add STRIPE_SECRET_KEY production

# Add Publishable Key
echo ""
echo "Enter your Stripe Publishable Key (pk_test_... or pk_live_...):"
read STRIPE_PUBLISHABLE_KEY
echo $STRIPE_PUBLISHABLE_KEY | vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production

# Add Webhook Secret
echo ""
echo "Enter your Stripe Webhook Secret (whsec_...):"
read -s STRIPE_WEBHOOK_SECRET
echo $STRIPE_WEBHOOK_SECRET | vercel env add STRIPE_WEBHOOK_SECRET production

# Add Pro Price ID
echo ""
echo "Enter your Pro Plan Price ID (price_...):"
read STRIPE_PRO_PRICE_ID
echo $STRIPE_PRO_PRICE_ID | vercel env add STRIPE_PRO_PRICE_ID production

# Add Enterprise Price ID
echo ""
echo "Enter your Enterprise Plan Price ID (price_...):"
read STRIPE_ENTERPRISE_PRICE_ID
echo $STRIPE_ENTERPRISE_PRICE_ID | vercel env add STRIPE_ENTERPRISE_PRICE_ID production

echo ""
echo "✅ All Stripe environment variables added!"
echo ""
echo "Next steps:"
echo "  1. Redeploy: vercel --prod"
echo "  2. Test checkout at: https://ai-layout-next-4nj8mqh42-david-archies-projects-af46d129.vercel.app/pricing"
echo "  3. Use test card: 4242 4242 4242 4242"
echo ""
