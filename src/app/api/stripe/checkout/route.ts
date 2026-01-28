import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { stripe, isStripeEnabled } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    if (!isStripeEnabled() || !stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 503 }
      );
    }

    const stripeClient = stripe;

    const session = await getServerSession(authOptions);
    const { priceId, billingCycle, credits } = await req.json();

    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID is required' },
        { status: 400 }
      );
    }

    // Handle authenticated users (existing flow)
    if (session?.user?.email) {
      // Get user from database
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
      });

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      // Check if user already has an active subscription
      if (user.stripeSubscriptionId) {
        // User wants to change their plan - update existing subscription instead of creating new one
        try {
          const subscription = await stripeClient.subscriptions.retrieve(user.stripeSubscriptionId);

          // Update the subscription with the new price
          const updatedSubscription = await stripeClient.subscriptions.update(user.stripeSubscriptionId, {
            items: [{
              id: subscription.items.data[0].id,
              price: priceId,
            }],
            proration_behavior: 'create_prorations', // Prorate the charges
            metadata: {
              userId: user.id,
              previousPriceId: subscription.items.data[0].price.id,
            },
          });

          console.log(`Updated subscription ${user.stripeSubscriptionId} to new price ${priceId}`);

          // Redirect to billing page with success message
          return NextResponse.json({
            success: true,
            redirect: '/settings/billing?updated=true',
            message: 'Your subscription has been updated successfully.',
          });
        } catch (error) {
          console.error('Error updating subscription:', error);
          // If update fails, redirect to billing portal
          return NextResponse.json(
            {
              error: 'Could not update subscription',
              redirect: '/settings/billing',
              message: 'Please use the billing portal to change your plan.'
            },
            { status: 400 }
          );
        }
      }

      // Create or get Stripe customer
      let customerId = user.stripeCustomerId;

      if (!customerId) {
        const customer = await stripeClient.customers.create({
          email: session.user.email,
          name: session.user.name || undefined,
          metadata: {
            userId: user.id,
          },
        });

        customerId = customer.id;

        await prisma.user.update({
          where: { id: user.id },
          data: { stripeCustomerId: customerId },
        });
      }

      // Create Stripe checkout session for authenticated user
      const checkoutSession = await stripeClient.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${process.env.NEXTAUTH_URL}/settings/billing?success=true`,
        cancel_url: `${process.env.NEXTAUTH_URL}/pricing?canceled=true`,
        metadata: {
          userId: user.id,
          billingCycle: billingCycle || 'monthly',
          credits: credits?.toString() || '0',
        },
        subscription_data: {
          metadata: {
            userId: user.id,
            billingCycle: billingCycle || 'monthly',
            credits: credits?.toString() || '0',
          },
        },
      });

      return NextResponse.json({ url: checkoutSession.url });
    }

    // Handle guest checkout (no session)
    console.log('Creating guest checkout session');

    const guestCheckoutSession = await stripeClient.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXTAUTH_URL}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/pricing?canceled=true`,
      customer_email: undefined, // Stripe will collect email
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      metadata: {
        isGuestCheckout: 'true',
        priceId,
        billingCycle: billingCycle || 'monthly',
        credits: credits?.toString() || '0',
      },
      subscription_data: {
        metadata: {
          isGuestCheckout: 'true',
          priceId,
          billingCycle: billingCycle || 'monthly',
          credits: credits?.toString() || '0',
        },
      },
    });

    return NextResponse.json({ url: guestCheckoutSession.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
