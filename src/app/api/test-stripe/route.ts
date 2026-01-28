import { NextResponse } from 'next/server';
import { stripe, isStripeEnabled } from '@/lib/stripe';

export async function GET() {
  return NextResponse.json({
    stripeEnabled: isStripeEnabled(),
    hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
    keyPrefix: process.env.STRIPE_SECRET_KEY?.substring(0, 15) || 'not set',
    nodeEnv: process.env.NODE_ENV,
  });
}
