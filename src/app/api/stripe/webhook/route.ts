import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe, PLANS, isStripeEnabled } from '@/lib/stripe';
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
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode === 'subscription') {
          const subscriptionId = session.subscription as string;
          const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);

          await updateUserSubscription(
            session.metadata?.userId!,
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

        await prisma.user.update({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            stripeSubscriptionId: null,
            stripePriceId: null,
            stripeCurrentPeriodEnd: null,
            plan: 'free',
            monthlyCredits: PLANS.FREE.credits,
          },
        });
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

          // Reset credits on successful payment
          await prisma.user.update({
            where: { stripeSubscriptionId: subscription.id },
            data: {
              creditsUsed: 0,
              creditsResetAt: new Date(),
            },
          });
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function updateUserSubscription(
  userId: string,
  subscription: Stripe.Subscription
) {
  const priceId = subscription.items.data[0].price.id;

  // Determine plan based on price ID
  let plan = 'free';
  let monthlyCredits: number = PLANS.FREE.credits;

  if (priceId === PLANS.PRO.priceId) {
    plan = 'pro';
    monthlyCredits = PLANS.PRO.credits;
  } else if (priceId === PLANS.ENTERPRISE.priceId) {
    plan = 'enterprise';
    monthlyCredits = PLANS.ENTERPRISE.credits;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      stripeCurrentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      plan,
      monthlyCredits,
    },
  });
}
