#!/bin/bash

# Setup Vercel Environment Variables for Stripe Integration
# This script adds all necessary Stripe environment variables to Vercel

echo "🚀 Setting up Vercel environment variables for Stripe..."
echo ""

# NOTE: Replace these placeholder values with your actual Stripe credentials
# You can also set these directly in the Vercel dashboard

# Stripe Secret Key (production only)
echo "Please enter your Stripe Secret Key:"
read -s STRIPE_KEY
vercel env add STRIPE_SECRET_KEY production <<< "$STRIPE_KEY"

# Stripe Webhook Secret (production only)
echo "Please enter your Stripe Webhook Secret:"
read -s WEBHOOK_SECRET
vercel env add STRIPE_WEBHOOK_SECRET production <<< "$WEBHOOK_SECRET"

# Stripe Price IDs (production, preview, and development)
echo ""
echo "📋 Adding Stripe Price IDs..."

# 8K Credits
vercel env add NEXT_PUBLIC_STRIPE_8000_MONTHLY_PRICE_ID production <<< "price_1SsrtOD47f8Khc6JeUTPPxnu"
vercel env add NEXT_PUBLIC_STRIPE_8000_YEARLY_PRICE_ID production <<< "price_1SsrtOD47f8Khc6JboihzPIg"

# 12K Credits
vercel env add NEXT_PUBLIC_STRIPE_12000_MONTHLY_PRICE_ID production <<< "price_1SsrtPD47f8Khc6JRyr0k3xH"
vercel env add NEXT_PUBLIC_STRIPE_12000_YEARLY_PRICE_ID production <<< "price_1SsrtPD47f8Khc6JlTccecnG"

# 16K Credits
vercel env add NEXT_PUBLIC_STRIPE_16000_MONTHLY_PRICE_ID production <<< "price_1SsrtPD47f8Khc6JbZ8ZV253"
vercel env add NEXT_PUBLIC_STRIPE_16000_YEARLY_PRICE_ID production <<< "price_1SsrtPD47f8Khc6JWlmuvETW"

# 20K Credits
vercel env add NEXT_PUBLIC_STRIPE_20000_MONTHLY_PRICE_ID production <<< "price_1SsrtQD47f8Khc6JQWKMb7SP"
vercel env add NEXT_PUBLIC_STRIPE_20000_YEARLY_PRICE_ID production <<< "price_1SsrtQD47f8Khc6JhjYDpYDA"

# 40K Credits
vercel env add NEXT_PUBLIC_STRIPE_40000_MONTHLY_PRICE_ID production <<< "price_1SsrtRD47f8Khc6JDl4R98LG"
vercel env add NEXT_PUBLIC_STRIPE_40000_YEARLY_PRICE_ID production <<< "price_1SsrtRD47f8Khc6J2SiQ4KH0"

# 63K Credits
vercel env add NEXT_PUBLIC_STRIPE_63000_MONTHLY_PRICE_ID production <<< "price_1SsrtRD47f8Khc6JWskWsUye"
vercel env add NEXT_PUBLIC_STRIPE_63000_YEARLY_PRICE_ID production <<< "price_1SsrtSD47f8Khc6JUMWhnGo2"

# 85K Credits
vercel env add NEXT_PUBLIC_STRIPE_85000_MONTHLY_PRICE_ID production <<< "price_1SsrtSD47f8Khc6JJ9cAQofp"
vercel env add NEXT_PUBLIC_STRIPE_85000_YEARLY_PRICE_ID production <<< "price_1SsrtSD47f8Khc6JGIDV1jxq"

# 110K Credits
vercel env add NEXT_PUBLIC_STRIPE_110000_MONTHLY_PRICE_ID production <<< "price_1SsrtTD47f8Khc6JK2mUzxLp"
vercel env add NEXT_PUBLIC_STRIPE_110000_YEARLY_PRICE_ID production <<< "price_1SsrtTD47f8Khc6JhtzQCac8"

# 170K Credits
vercel env add NEXT_PUBLIC_STRIPE_170000_MONTHLY_PRICE_ID production <<< "price_1SsrtUD47f8Khc6JwuuBE5dB"
vercel env add NEXT_PUBLIC_STRIPE_170000_YEARLY_PRICE_ID production <<< "price_1SsrtUD47f8Khc6JQkuLhF3A"

# 230K Credits
vercel env add NEXT_PUBLIC_STRIPE_230000_MONTHLY_PRICE_ID production <<< "price_1SsrtUD47f8Khc6JxXv50e0e"
vercel env add NEXT_PUBLIC_STRIPE_230000_YEARLY_PRICE_ID production <<< "price_1SsrtVD47f8Khc6J9SIgv4aM"

# 350K Credits
vercel env add NEXT_PUBLIC_STRIPE_350000_MONTHLY_PRICE_ID production <<< "price_1SsrtVD47f8Khc6Jbn5ty0CU"
vercel env add NEXT_PUBLIC_STRIPE_350000_YEARLY_PRICE_ID production <<< "price_1SsrtVD47f8Khc6JIxWtkneO"

# 480K Credits
vercel env add NEXT_PUBLIC_STRIPE_480000_MONTHLY_PRICE_ID production <<< "price_1SsrtWD47f8Khc6JiSLEKn0x"
vercel env add NEXT_PUBLIC_STRIPE_480000_YEARLY_PRICE_ID production <<< "price_1SsrtWD47f8Khc6J8XnigEMk"

# 1.2M Credits
vercel env add NEXT_PUBLIC_STRIPE_1200000_MONTHLY_PRICE_ID production <<< "price_1SsrtXD47f8Khc6JVSMkOWIU"
vercel env add NEXT_PUBLIC_STRIPE_1200000_YEARLY_PRICE_ID production <<< "price_1SsrtXD47f8Khc6JTKfuV03L"

echo ""
echo "✅ All Stripe environment variables added to Vercel!"
echo ""
echo "💡 Next steps:"
echo "1. Deploy to Vercel: vercel --prod"
echo "2. Test subscription flow on production"
echo "3. Monitor webhook events in Stripe Dashboard"
