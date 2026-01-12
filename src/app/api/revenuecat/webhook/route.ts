import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

// RevenueCat webhook event types
type RevenueCatEvent =
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'CANCELLATION'
  | 'UNCANCELLATION'
  | 'NON_RENEWING_PURCHASE'
  | 'SUBSCRIPTION_PAUSED'
  | 'EXPIRATION'
  | 'BILLING_ISSUE'
  | 'PRODUCT_CHANGE'
  | 'TRANSFER';

interface RevenueCatWebhookPayload {
  event: {
    type: RevenueCatEvent;
    app_user_id: string;
    original_app_user_id: string;
    product_id: string;
    period_type: string;
    purchased_at_ms: number;
    expiration_at_ms?: number;
    environment: string;
    entitlement_ids?: string[];
    presented_offering_id?: string;
    transaction_id: string;
    original_transaction_id: string;
    is_trial_conversion?: boolean;
    subscriber_attributes?: Record<string, any>;
    store: string;
    takehome_percentage?: number;
    currency?: string;
    price?: number;
    price_in_purchased_currency?: number;
  };
  api_version: string;
}

// Verify webhook signature (optional but recommended)
function verifyWebhookSignature(
  payload: string,
  signature: string | null
): boolean {
  // RevenueCat webhook secret from environment
  const webhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('REVENUECAT_WEBHOOK_SECRET not configured');
    return true; // Allow in development
  }

  if (!signature) {
    return false;
  }

  // Implement signature verification here
  // RevenueCat uses HMAC SHA256
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', webhookSecret);
  hmac.update(payload);
  const computedSignature = hmac.digest('base64');

  return computedSignature === signature;
}

// Map entitlements to plan name
function getPlanFromEntitlements(entitlements: string[]): string {
  if (!entitlements || entitlements.length === 0) return 'free';

  // Check for enterprise first (higher tier)
  if (entitlements.includes('enterprise')) return 'enterprise';
  if (entitlements.includes('pro')) return 'pro';

  return 'free';
}

// Get credits for plan
function getCreditsForPlan(plan: string): number {
  switch (plan) {
    case 'enterprise':
      return 500000;
    case 'pro':
      return 50000;
    case 'free':
    default:
      return 1000;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = headers().get('x-revenuecat-signature');

    // Verify webhook signature
    if (!verifyWebhookSignature(body, signature)) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const payload: RevenueCatWebhookPayload = JSON.parse(body);
    const { event } = payload;

    console.log(`RevenueCat webhook: ${event.type} for user ${event.app_user_id}`);

    // Find user by RevenueCat user ID or email
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { revenueCatUserId: event.app_user_id },
          { revenueCatUserId: event.original_app_user_id },
          { id: event.app_user_id }, // If using database user ID
        ],
      },
    });

    if (!user) {
      console.error(`User not found for RevenueCat ID: ${event.app_user_id}`);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Handle different event types
    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'UNCANCELLATION':
      case 'PRODUCT_CHANGE': {
        // User has active subscription
        const plan = getPlanFromEntitlements(event.entitlement_ids || []);
        const monthlyCredits = getCreditsForPlan(plan);
        const expirationDate = event.expiration_at_ms
          ? new Date(event.expiration_at_ms)
          : null;

        await prisma.user.update({
          where: { id: user.id },
          data: {
            plan,
            monthlyCredits,
            revenueCatUserId: event.app_user_id,
            revenueCatCustomerId: event.original_app_user_id,
            stripeCurrentPeriodEnd: expirationDate,
            // Reset credits on new subscription/renewal
            creditsUsed: event.type === 'RENEWAL' ? 0 : user.creditsUsed,
            creditsResetAt: event.type === 'RENEWAL' ? new Date() : user.creditsResetAt,
          },
        });

        console.log(`Updated user ${user.id} to plan ${plan}`);
        break;
      }

      case 'CANCELLATION':
      case 'EXPIRATION': {
        // Subscription cancelled or expired - downgrade to free
        await prisma.user.update({
          where: { id: user.id },
          data: {
            plan: 'free',
            monthlyCredits: 1000,
            stripeCurrentPeriodEnd: null,
          },
        });

        console.log(`Downgraded user ${user.id} to free plan`);
        break;
      }

      case 'BILLING_ISSUE': {
        // Handle billing issue - maybe send email notification
        console.warn(`Billing issue for user ${user.id}`);
        // You can add email notification here
        break;
      }

      case 'SUBSCRIPTION_PAUSED': {
        // Subscription paused - optionally downgrade or maintain
        console.log(`Subscription paused for user ${user.id}`);
        break;
      }

      case 'NON_RENEWING_PURCHASE':
      case 'TRANSFER':
        // Handle these cases as needed
        console.log(`Event ${event.type} for user ${user.id}`);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('RevenueCat webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// GET endpoint to verify webhook is accessible
export async function GET() {
  return NextResponse.json({
    message: 'RevenueCat webhook endpoint',
    status: 'active',
  });
}
