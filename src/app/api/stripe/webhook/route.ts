import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe, PLANS, isStripeEnabled, getPlanByPriceId } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

export async function POST(req: NextRequest) {
  if (!isStripeEnabled() || !stripe) {
    return NextResponse.json(
      { error: 'Stripe is not configured' },
      { status: 503 }
    );
  }

  const stripeClient = stripe;

  const body = await req.text();
  const signature = headers().get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripeClient.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  try {
    // Check for duplicate webhook events (idempotency)
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { eventId: event.id },
    });

    if (existingEvent) {
      console.log(`Webhook event ${event.id} already processed, skipping`);
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Process the webhook event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode === 'subscription') {
          const subscriptionId = session.subscription as string;
          const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);

          await updateUserSubscription(
            session.metadata?.userId || subscription.metadata?.userId,
            subscription
          );
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await updateUserSubscription(
          subscription.metadata.userId,
          subscription
        );
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        // Try to find user by subscription ID or metadata
        let user = await prisma.user.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        });

        if (!user && subscription.metadata?.userId) {
          user = await prisma.user.findUnique({
            where: { id: subscription.metadata.userId },
          });
        }

        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              stripeSubscriptionId: null,
              stripePriceId: null,
              stripeCurrentPeriodEnd: null,
              plan: 'free',
              monthlyCredits: PLANS.FREE.credits,
            },
          });
        } else {
          console.error(`User not found for subscription ${subscription.id}`);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;

        // Access subscription through bracket notation to avoid TypeScript error
        const subscriptionField = (invoice as any).subscription;
        const subscriptionId = typeof subscriptionField === 'string'
          ? subscriptionField
          : subscriptionField?.id;

        if (subscriptionId) {
          const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);

          await updateUserSubscription(
            subscription.metadata.userId,
            subscription
          );

          // NOTE: Credit reset is now handled by the credit system (credits.ts)
          // based on creditsResetAt. We only update the subscription fields here.
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Record the webhook event to prevent duplicate processing
    await prisma.webhookEvent.create({
      data: {
        eventId: event.id,
        provider: 'stripe',
        eventType: event.type,
        processed: true,
        payload: event as any, // Store full payload for debugging
      },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);

    // Log the failed webhook attempt
    try {
      await prisma.webhookEvent.create({
        data: {
          eventId: event.id,
          provider: 'stripe',
          eventType: event.type,
          processed: false,
          payload: { error: String(error), event: event as any },
        },
      });
    } catch (logError) {
      console.error('Failed to log webhook error:', logError);
    }

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function updateUserSubscription(
  userId: string | undefined,
  subscription: Stripe.Subscription
) {
  if (!userId) {
    // Try to find user by Stripe customer ID or subscription ID
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { stripeCustomerId: subscription.customer as string },
          { stripeSubscriptionId: subscription.id },
        ],
      },
    });

    if (!user) {
      console.error(`Cannot update subscription: User not found for subscription ${subscription.id}`);
      return;
    }

    userId = user.id;
  }

  const priceId = subscription.items.data[0].price.id;

  // Use centralized plan lookup
  const plan = getPlanByPriceId(priceId);

  if (!plan) {
    console.error(`Unknown price ID: ${priceId}, defaulting to free plan`);
    await prisma.user.update({
      where: { id: userId },
      data: {
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        stripeCurrentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        plan: 'free',
        monthlyCredits: PLANS.FREE.credits,
      },
    });
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      stripeCurrentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      plan: plan.id,
      monthlyCredits: plan.credits,
    },
  });

  console.log(`Updated user ${userId} to plan ${plan.id} with ${plan.credits} credits`);
}
