#!/usr/bin/env ts-node
/**
 * Stripe Price Setup Utility
 *
 * This script helps you create all necessary Stripe products and prices
 * for the AI Layout platform.
 *
 * USAGE:
 * 1. Set your STRIPE_SECRET_KEY in .env.local
 * 2. Run: npx ts-node scripts/setup-stripe-prices.ts
 * 3. Copy the generated price IDs to your .env.local
 *
 * NOTE: Run this script ONCE for production and ONCE for test mode
 */

import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Credit tiers with pricing (inline to avoid import issues)
const CREDIT_TIER_PRICES = {
  '8000': {
    credits: 8000,
    displayName: '8,000 credits / month',
    monthlyPrice: 40,
    yearlyPrice: 384,
  },
  '12000': {
    credits: 12000,
    displayName: '12,000 credits / month',
    monthlyPrice: 60,
    yearlyPrice: 576,
    popular: true,
  },
  '16000': {
    credits: 16000,
    displayName: '16,000 credits / month',
    monthlyPrice: 80,
    yearlyPrice: 768,
  },
  '20000': {
    credits: 20000,
    displayName: '20,000 credits / month',
    monthlyPrice: 100,
    yearlyPrice: 960,
  },
  '40000': {
    credits: 40000,
    displayName: '40,000 credits / month',
    monthlyPrice: 185,
    yearlyPrice: 1776,
  },
  '63000': {
    credits: 63000,
    displayName: '63,000 credits / month',
    monthlyPrice: 280,
    yearlyPrice: 2688,
  },
  '85000': {
    credits: 85000,
    displayName: '85,000 credits / month',
    monthlyPrice: 370,
    yearlyPrice: 3552,
  },
  '110000': {
    credits: 110000,
    displayName: '110,000 credits / month',
    monthlyPrice: 475,
    yearlyPrice: 4560,
  },
  '170000': {
    credits: 170000,
    displayName: '170,000 credits / month',
    monthlyPrice: 725,
    yearlyPrice: 6960,
  },
  '230000': {
    credits: 230000,
    displayName: '230,000 credits / month',
    monthlyPrice: 975,
    yearlyPrice: 9360,
  },
  '350000': {
    credits: 350000,
    displayName: '350,000 credits / month',
    monthlyPrice: 1470,
    yearlyPrice: 14112,
  },
  '480000': {
    credits: 480000,
    displayName: '480,000 credits / month',
    monthlyPrice: 2010,
    yearlyPrice: 19296,
  },
  '1200000': {
    credits: 1200000,
    displayName: '1,200,000 credits / month',
    monthlyPrice: 5000,
    yearlyPrice: 48000,
  },
};

const stripeKey = process.env.STRIPE_SECRET_KEY;

if (!stripeKey) {
  console.error('❌ STRIPE_SECRET_KEY not found in environment variables');
  console.error('Please add it to your .env.local file');
  process.exit(1);
}

const stripe = new Stripe(stripeKey, {
  apiVersion: '2024-06-20' as any,
  typescript: true,
});

const isTestMode = stripeKey.includes('_test_');

async function createStripeProducts() {
  console.log(`\n🚀 Setting up Stripe products (${isTestMode ? 'TEST' : 'LIVE'} mode)...\n`);

  const envVars: string[] = [];

  for (const [key, tier] of Object.entries(CREDIT_TIER_PRICES)) {
    console.log(`\n📦 Creating product for ${tier.displayName}...`);

    // Create product
    const product = await stripe.products.create({
      name: `AI Layout Pro - ${tier.displayName}`,
      description: `${tier.credits.toLocaleString()} credits per month for AI-powered content generation`,
      metadata: {
        credits: tier.credits.toString(),
        tier: 'pro',
      },
    });

    console.log(`   ✅ Product created: ${product.id}`);

    // Create monthly price
    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: tier.monthlyPrice * 100, // Convert to cents
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      metadata: {
        credits: tier.credits.toString(),
        billingCycle: 'monthly',
      },
    });

    console.log(`   ✅ Monthly price created: ${monthlyPrice.id} ($${tier.monthlyPrice}/month)`);

    // Create yearly price
    const yearlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: tier.yearlyPrice * 100, // Convert to cents
      currency: 'usd',
      recurring: {
        interval: 'year',
      },
      metadata: {
        credits: tier.credits.toString(),
        billingCycle: 'yearly',
      },
    });

    console.log(`   ✅ Yearly price created: ${yearlyPrice.id} ($${tier.yearlyPrice}/year)`);

    // Generate environment variable names
    const creditsKey = tier.credits.toString();
    const monthlyVar = `NEXT_PUBLIC_STRIPE_${creditsKey}_MONTHLY_PRICE_ID="${monthlyPrice.id}"`;
    const yearlyVar = `NEXT_PUBLIC_STRIPE_${creditsKey}_YEARLY_PRICE_ID="${yearlyPrice.id}"`;

    envVars.push(monthlyVar);
    envVars.push(yearlyVar);
  }

  console.log('\n\n✅ All products and prices created successfully!\n');
  console.log('📋 Add these environment variables to your .env.local:\n');
  console.log('# Stripe Price IDs (Auto-generated)');
  envVars.forEach(envVar => console.log(envVar));

  console.log('\n\n💡 Next steps:');
  console.log('1. Copy the environment variables above to your .env.local file');
  console.log('2. Restart your development server');
  console.log('3. Test the pricing page at http://localhost:3010/pricing');
  console.log('4. If in test mode, repeat this process with your live Stripe key for production');
  console.log('\n');
}

// Run the script
createStripeProducts().catch((error) => {
  console.error('\n❌ Error creating Stripe products:', error.message);
  process.exit(1);
});
