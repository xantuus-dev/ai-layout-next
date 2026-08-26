#!/usr/bin/env ts-node
/**
 * Stripe Price Setup Utility
 *
 * This script helps you create all necessary Stripe products and prices
 * for the AI Layout platform.
 *
 * USAGE:
 * 1. Set your STRIPE_SECRET_KEY in .env.local
 * 2. Run: npx tsx scripts/setup-stripe-prices.ts --only=4000,intro
 * 3. Copy the generated price IDs to your .env.local (or vercel env add)
 *
 * NOTE: Run this script ONCE for production and ONCE for test mode.
 *
 * --only=<ids>  Restrict to specific tiers, comma separated, so a re-run does
 *               not duplicate products that already exist. Stripe has no
 *               natural key for products, so creating them twice is silent and
 *               leaves two products competing for the same tier. Use the credit
 *               count (e.g. 4000) and/or the literal `intro` for the 14-day
 *               introductory offer. Omitting the flag creates EVERY tier, which
 *               is almost never what you want against a live account.
 */

import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Credit tiers with pricing (inline to avoid import issues)
const CREDIT_TIER_PRICES = {
  '4000': {
    credits: 4000,
    displayName: '4,000 credits / month',
    monthlyPrice: 29.95,
    yearlyPrice: 287.52,
  },
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

/**
 * The $9.95 / 14-day introductory offer.
 *
 * Modelled as a real recurring subscription on a 14-day interval, NOT a Stripe
 * trial: the customer is charged today, and a subscription schedule moves them
 * onto the monthly entry tier after one cycle. See INTRO_TRIAL in
 * src/lib/pricing-config.ts for why the Trial Offer API is not used here.
 */
const INTRO_OFFER = {
  price: 9.95,
  days: 14,
  convertsToCredits: 4000,
};

/** Money -> integer cents. 29.95 * 100 is 2994.999... in binary floating point. */
function toCents(amount: number): number {
  return Math.round(amount * 100);
}

const onlyArg = process.argv.slice(2).find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()) : null;
const wants = (id: string) => !only || only.includes(id);

async function createStripeProducts() {
  console.log(`\n🚀 Setting up Stripe products (${isTestMode ? 'TEST' : 'LIVE'} mode)...\n`);

  if (!only) {
    console.log('⚠️  No --only= filter given: this will create EVERY tier as a NEW product.');
    console.log('   Against an account that already has them, that silently duplicates them.');
    console.log('   Pass e.g. --only=4000,intro to create just what is missing.\n');
  }

  const envVars: string[] = [];

  for (const [key, tier] of Object.entries(CREDIT_TIER_PRICES)) {
    if (!wants(key)) continue;
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
      unit_amount: toCents(tier.monthlyPrice),
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
      unit_amount: toCents(tier.yearlyPrice),
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

  // The introductory offer: one product, one 14-day recurring price.
  if (wants('intro')) {
    console.log(`\n📦 Creating product for the $${INTRO_OFFER.price} / ${INTRO_OFFER.days}-day intro offer...`);

    const introProduct = await stripe.products.create({
      name: `Xantuus AI — $${INTRO_OFFER.price} for ${INTRO_OFFER.days} days`,
      description:
        `Introductory offer: ${INTRO_OFFER.days} days of full access for $${INTRO_OFFER.price}, ` +
        `then the ${INTRO_OFFER.convertsToCredits.toLocaleString()}-credit monthly plan.`,
      metadata: {
        tier: 'intro',
        days: String(INTRO_OFFER.days),
        convertsToCredits: String(INTRO_OFFER.convertsToCredits),
      },
    });

    console.log(`   ✅ Product created: ${introProduct.id}`);

    // interval=day + interval_count=14 is what makes this a paid intro rather
    // than a Stripe trial: the charge lands today and the schedule transitions
    // it to the monthly price after one cycle.
    const introPrice = await stripe.prices.create({
      product: introProduct.id,
      unit_amount: toCents(INTRO_OFFER.price),
      currency: 'usd',
      recurring: {
        interval: 'day',
        interval_count: INTRO_OFFER.days,
      },
      metadata: {
        tier: 'intro',
        convertsToCredits: String(INTRO_OFFER.convertsToCredits),
      },
    });

    console.log(`   ✅ Intro price created: ${introPrice.id} ($${INTRO_OFFER.price} / ${INTRO_OFFER.days} days)`);
    envVars.push(`NEXT_PUBLIC_STRIPE_TRIAL_14D_PRICE_ID="${introPrice.id}"`);
  }

  if (envVars.length === 0) {
    console.log('\n⚠️  Nothing matched --only=' + (only ?? []).join(',') + ' — no products created.');
    console.log('   Valid ids: ' + Object.keys(CREDIT_TIER_PRICES).join(', ') + ', intro\n');
    return;
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
