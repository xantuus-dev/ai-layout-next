#!/bin/bash

# Production Stripe Deployment Script
# Run this after getting your LIVE Stripe keys

set -e  # Exit on error

echo "🔴 PRODUCTION STRIPE DEPLOYMENT"
echo "================================"
echo ""
echo "⚠️  WARNING: This will add LIVE Stripe keys to production!"
echo "⚠️  Make sure you have your LIVE keys (pk_live_, sk_live_, etc.)"
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "📝 Enter your LIVE Stripe credentials..."
echo ""

# Function to add env var
add_env() {
    local name=$1
    local prompt_text=$2
    echo "$prompt_text"
    read -s value
    echo ""
    echo $value | vercel env add $name production --force
    echo "✅ $name added"
    echo ""
}

# Add all Stripe environment variables
add_env "STRIPE_SECRET_KEY" "Enter STRIPE_SECRET_KEY (sk_live_...):"
add_env "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" "Enter NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_live_...):"
add_env "STRIPE_WEBHOOK_SECRET" "Enter STRIPE_WEBHOOK_SECRET (whsec_...):"
add_env "STRIPE_PRO_PRICE_ID" "Enter STRIPE_PRO_PRICE_ID (price_...):"
add_env "STRIPE_ENTERPRISE_PRICE_ID" "Enter STRIPE_ENTERPRISE_PRICE_ID (price_...):"

echo ""
echo "✅ All Stripe environment variables added to Vercel!"
echo ""
echo "🚀 Deploying to production..."
echo ""

# Deploy to production
vercel --prod

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo ""
echo "🎉 Your payment system is now LIVE!"
echo ""
echo "🧪 Test it:"
echo "   1. Visit: https://ai-layout-next-4nj8mqh42-david-archies-projects-af46d129.vercel.app/pricing"
echo "   2. Click 'Upgrade to Pro'"
echo "   3. Use a REAL card with a small amount ($0.50)"
echo "   4. Complete the purchase"
echo "   5. Immediately refund in Stripe Dashboard"
echo ""
echo "⚠️  IMPORTANT: Test with $0.50 first, then refund it!"
echo ""
echo "📊 Monitor your first payments:"
echo "   - Stripe Dashboard: https://dashboard.stripe.com/payments"
echo "   - Webhook logs: https://dashboard.stripe.com/webhooks"
echo "   - Vercel logs: vercel logs --follow"
echo ""
echo "💰 You're now ready to accept real payments!"
echo ""
