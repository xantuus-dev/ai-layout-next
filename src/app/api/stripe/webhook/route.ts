import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe, PLANS, isStripeEnabled, getPlanByPriceId } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import { getPriceTierByPriceId, getBillingCycleFromPriceId } from '@/lib/pricing-config';

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

          // Handle guest checkout - create user account
          if (session.metadata?.isGuestCheckout === 'true' && session.customer_email) {
            console.log('Processing guest checkout for:', session.customer_email);

            // Check if user already exists
            let user = await prisma.user.findUnique({
              where: { email: session.customer_email },
            });

            if (!user) {
              // Create new user account
              const credits = parseInt(session.metadata.credits || '4000');
              const billingCycle = session.metadata.billingCycle || 'monthly';

              user = await prisma.user.create({
                data: {
                  email: session.customer_email,
                  name: session.customer_details?.name || session.customer_email.split('@')[0],
                  stripeCustomerId: session.customer as string,
                  stripeSubscriptionId: subscriptionId,
                  stripePriceId: session.metadata.priceId,
                  stripeCurrentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
                  plan: credits > 4000 ? 'pro' : 'free',
                  monthlyCredits: credits,
                  billingCycle: billingCycle as string,
                  creditsResetAt: new Date(),
                },
              });

              console.log(`Created new user account for ${session.customer_email} with ${credits} credits`);
            } else {
              // User exists, update their subscription
              await updateUserSubscription(user.id, subscription);
            }
          } else {
            // Regular authenticated checkout
            await updateUserSubscription(
              session.metadata?.userId || subscription.metadata?.userId,
              subscription
            );
          }
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

          // Clear any payment failed status
          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { stripeCustomerId: subscription.customer as string },
                { stripeSubscriptionId: subscription.id },
              ],
            },
          });

          if (user) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                paymentFailed: false,
                paymentFailedAt: null,
              },
            });
          }

          // NOTE: Credit reset is now handled by the credit system (credits.ts)
          // based on creditsResetAt. We only update the subscription fields here.
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;

        // Access subscription through bracket notation
        const subscriptionField = (invoice as any).subscription;
        const subscriptionId = typeof subscriptionField === 'string'
          ? subscriptionField
          : subscriptionField?.id;

        if (subscriptionId) {
          // Find user by subscription ID or customer ID
          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { stripeSubscriptionId: subscriptionId },
                { stripeCustomerId: invoice.customer as string },
              ],
            },
          });

          if (user) {
            // Mark payment as failed
            await prisma.user.update({
              where: { id: user.id },
              data: {
                paymentFailed: true,
                paymentFailedAt: new Date(),
              },
            });

            console.log(`Payment failed for user ${user.id}, subscription ${subscriptionId}`);
            // TODO: Send email notification to user about failed payment
          }
        }
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription;

        // Find user and notify them about trial ending
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { stripeSubscriptionId: subscription.id },
              { stripeCustomerId: subscription.customer as string },
            ],
          },
        });

        if (user) {
          console.log(`Trial ending soon for user ${user.id}, subscription ${subscription.id}`);
          // TODO: Send email notification about trial ending
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

  // First check if this is a custom pricing tier
  const priceTier = getPriceTierByPriceId(priceId);
  const billingCycle = getBillingCycleFromPriceId(priceId);

  if (priceTier) {
    // Custom pricing tier (Pro with variable credits)
    await prisma.user.update({
      where: { id: userId },
      data: {
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        stripeCurrentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        plan: 'pro', // All custom tiers are Pro plan
        monthlyCredits: priceTier.credits,
        billingCycle: billingCycle || 'monthly',
      },
    });

    console.log(`Updated user ${userId} to Pro plan (${billingCycle}) with ${priceTier.credits} credits`);
    return;
  }

  // Fall back to standard plan lookup
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
