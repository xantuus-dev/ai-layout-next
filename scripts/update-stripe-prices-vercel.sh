#!/bin/bash

# Update Stripe price IDs in Vercel Production
# This script removes old price IDs and adds new ones

set -e

echo "🔄 Updating Stripe Price IDs in Vercel Production..."
echo ""

# Array of price IDs to update
declare -A PRICES=(
  ["NEXT_PUBLIC_STRIPE_8000_MONTHLY_PRICE_ID"]="price_1Sue7jD47f8Khc6JJk9FK72h"
  ["NEXT_PUBLIC_STRIPE_8000_YEARLY_PRICE_ID"]="price_1Sue7jD47f8Khc6JoibNC3ey"
  ["NEXT_PUBLIC_STRIPE_12000_MONTHLY_PRICE_ID"]="price_1Sue7kD47f8Khc6JqYhU7eWv"
  ["NEXT_PUBLIC_STRIPE_12000_YEARLY_PRICE_ID"]="price_1Sue7kD47f8Khc6J4C2UPw1H"
  ["NEXT_PUBLIC_STRIPE_16000_MONTHLY_PRICE_ID"]="price_1Sue7lD47f8Khc6JwiA1hqnh"
  ["NEXT_PUBLIC_STRIPE_16000_YEARLY_PRICE_ID"]="price_1Sue7lD47f8Khc6JXS6uUPkP"
  ["NEXT_PUBLIC_STRIPE_20000_MONTHLY_PRICE_ID"]="price_1Sue7lD47f8Khc6JMpVRlfF0"
  ["NEXT_PUBLIC_STRIPE_20000_YEARLY_PRICE_ID"]="price_1Sue7mD47f8Khc6JfubKjPCB"
  ["NEXT_PUBLIC_STRIPE_40000_MONTHLY_PRICE_ID"]="price_1Sue7mD47f8Khc6JnDaJzXBi"
  ["NEXT_PUBLIC_STRIPE_40000_YEARLY_PRICE_ID"]="price_1Sue7mD47f8Khc6Jc5BY4dd2"
  ["NEXT_PUBLIC_STRIPE_63000_MONTHLY_PRICE_ID"]="price_1Sue7nD47f8Khc6J11sFNgmZ"
  ["NEXT_PUBLIC_STRIPE_63000_YEARLY_PRICE_ID"]="price_1Sue7nD47f8Khc6JZp8OeaCS"
  ["NEXT_PUBLIC_STRIPE_85000_MONTHLY_PRICE_ID"]="price_1Sue7oD47f8Khc6JOaCuKc3r"
  ["NEXT_PUBLIC_STRIPE_85000_YEARLY_PRICE_ID"]="price_1Sue7oD47f8Khc6JWM012U5i"
  ["NEXT_PUBLIC_STRIPE_110000_MONTHLY_PRICE_ID"]="price_1Sue7pD47f8Khc6J5X3dJA1z"
  ["NEXT_PUBLIC_STRIPE_110000_YEARLY_PRICE_ID"]="price_1Sue7pD47f8Khc6JnujgZSHc"
  ["NEXT_PUBLIC_STRIPE_170000_MONTHLY_PRICE_ID"]="price_1Sue7pD47f8Khc6JLbVa8oPh"
  ["NEXT_PUBLIC_STRIPE_170000_YEARLY_PRICE_ID"]="price_1Sue7qD47f8Khc6JTH4Ws0xN"
  ["NEXT_PUBLIC_STRIPE_230000_MONTHLY_PRICE_ID"]="price_1Sue7qD47f8Khc6Jr5aUdJof"
  ["NEXT_PUBLIC_STRIPE_230000_YEARLY_PRICE_ID"]="price_1Sue7qD47f8Khc6J1RoRbVSr"
  ["NEXT_PUBLIC_STRIPE_350000_MONTHLY_PRICE_ID"]="price_1Sue7rD47f8Khc6JL5daCl6O"
  ["NEXT_PUBLIC_STRIPE_350000_YEARLY_PRICE_ID"]="price_1Sue7rD47f8Khc6J90TTIBRO"
  ["NEXT_PUBLIC_STRIPE_480000_MONTHLY_PRICE_ID"]="price_1Sue7sD47f8Khc6JYyrFyoSP"
  ["NEXT_PUBLIC_STRIPE_480000_YEARLY_PRICE_ID"]="price_1Sue7sD47f8Khc6JcGbjBmOX"
  ["NEXT_PUBLIC_STRIPE_1200000_MONTHLY_PRICE_ID"]="price_1Sue7sD47f8Khc6JC7C94pAT"
  ["NEXT_PUBLIC_STRIPE_1200000_YEARLY_PRICE_ID"]="price_1Sue7tD47f8Khc6J3SmtfeRP"
)

for KEY in "${!PRICES[@]}"; do
  VALUE="${PRICES[$KEY]}"
  echo "🔄 Updating $KEY..."

  # Remove old value
  echo "y" | vercel env rm "$KEY" production 2>&1 | grep -q "Removed" && echo "  ✅ Removed old value" || echo "  ℹ️  No old value to remove"

  # Add new value
  printf "$VALUE" | vercel env add "$KEY" production 2>&1 | grep -q "Added" && echo "  ✅ Added new value: $VALUE" || echo "  ❌ Failed to add"

  echo ""
done

echo "✅ All Stripe Price IDs updated!"
echo "🚀 Deploy to apply changes: vercel --prod"
