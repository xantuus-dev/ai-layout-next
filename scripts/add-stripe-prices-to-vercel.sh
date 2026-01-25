#!/bin/bash

# Add all Stripe Price IDs to Vercel
echo "📋 Adding Stripe Price IDs to Vercel..."

# 8K Credits
echo "price_1SsrtOD47f8Khc6JeUTPPxnu" | vercel env add NEXT_PUBLIC_STRIPE_8000_MONTHLY_PRICE_ID production
echo "price_1SsrtOD47f8Khc6JboihzPIg" | vercel env add NEXT_PUBLIC_STRIPE_8000_YEARLY_PRICE_ID production

# 12K Credits
echo "price_1SsrtPD47f8Khc6JRyr0k3xH" | vercel env add NEXT_PUBLIC_STRIPE_12000_MONTHLY_PRICE_ID production
echo "price_1SsrtPD47f8Khc6JlTccecnG" | vercel env add NEXT_PUBLIC_STRIPE_12000_YEARLY_PRICE_ID production

# 16K Credits
echo "price_1SsrtPD47f8Khc6JbZ8ZV253" | vercel env add NEXT_PUBLIC_STRIPE_16000_MONTHLY_PRICE_ID production
echo "price_1SsrtPD47f8Khc6JWlmuvETW" | vercel env add NEXT_PUBLIC_STRIPE_16000_YEARLY_PRICE_ID production

# 20K Credits
echo "price_1SsrtQD47f8Khc6JQWKMb7SP" | vercel env add NEXT_PUBLIC_STRIPE_20000_MONTHLY_PRICE_ID production
echo "price_1SsrtQD47f8Khc6JhjYDpYDA" | vercel env add NEXT_PUBLIC_STRIPE_20000_YEARLY_PRICE_ID production

# 40K Credits
echo "price_1SsrtRD47f8Khc6JDl4R98LG" | vercel env add NEXT_PUBLIC_STRIPE_40000_MONTHLY_PRICE_ID production
echo "price_1SsrtRD47f8Khc6J2SiQ4KH0" | vercel env add NEXT_PUBLIC_STRIPE_40000_YEARLY_PRICE_ID production

# 63K Credits
echo "price_1SsrtRD47f8Khc6JWskWsUye" | vercel env add NEXT_PUBLIC_STRIPE_63000_MONTHLY_PRICE_ID production
echo "price_1SsrtSD47f8Khc6JUMWhnGo2" | vercel env add NEXT_PUBLIC_STRIPE_63000_YEARLY_PRICE_ID production

# 85K Credits
echo "price_1SsrtSD47f8Khc6JJ9cAQofp" | vercel env add NEXT_PUBLIC_STRIPE_85000_MONTHLY_PRICE_ID production
echo "price_1SsrtSD47f8Khc6JGIDV1jxq" | vercel env add NEXT_PUBLIC_STRIPE_85000_YEARLY_PRICE_ID production

# 110K Credits
echo "price_1SsrtTD47f8Khc6JK2mUzxLp" | vercel env add NEXT_PUBLIC_STRIPE_110000_MONTHLY_PRICE_ID production
echo "price_1SsrtTD47f8Khc6JhtzQCac8" | vercel env add NEXT_PUBLIC_STRIPE_110000_YEARLY_PRICE_ID production

# 170K Credits
echo "price_1SsrtUD47f8Khc6JwuuBE5dB" | vercel env add NEXT_PUBLIC_STRIPE_170000_MONTHLY_PRICE_ID production
echo "price_1SsrtUD47f8Khc6JQkuLhF3A" | vercel env add NEXT_PUBLIC_STRIPE_170000_YEARLY_PRICE_ID production

# 230K Credits
echo "price_1SsrtUD47f8Khc6JxXv50e0e" | vercel env add NEXT_PUBLIC_STRIPE_230000_MONTHLY_PRICE_ID production
echo "price_1SsrtVD47f8Khc6J9SIgv4aM" | vercel env add NEXT_PUBLIC_STRIPE_230000_YEARLY_PRICE_ID production

# 350K Credits
echo "price_1SsrtVD47f8Khc6Jbn5ty0CU" | vercel env add NEXT_PUBLIC_STRIPE_350000_MONTHLY_PRICE_ID production
echo "price_1SsrtVD47f8Khc6JIxWtkneO" | vercel env add NEXT_PUBLIC_STRIPE_350000_YEARLY_PRICE_ID production

# 480K Credits
echo "price_1SsrtWD47f8Khc6JiSLEKn0x" | vercel env add NEXT_PUBLIC_STRIPE_480000_MONTHLY_PRICE_ID production
echo "price_1SsrtWD47f8Khc6J8XnigEMk" | vercel env add NEXT_PUBLIC_STRIPE_480000_YEARLY_PRICE_ID production

# 1.2M Credits
echo "price_1SsrtXD47f8Khc6JVSMkOWIU" | vercel env add NEXT_PUBLIC_STRIPE_1200000_MONTHLY_PRICE_ID production
echo "price_1SsrtXD47f8Khc6JTKfuV03L" | vercel env add NEXT_PUBLIC_STRIPE_1200000_YEARLY_PRICE_ID production

echo ""
echo "✅ All Stripe Price IDs added to Vercel production!"
