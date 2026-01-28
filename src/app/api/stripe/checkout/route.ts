import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { stripe, isStripeEnabled } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    // Initialize Stripe client directly in the handler
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    console.log('=== STRIPE CHECKOUT DEBUG ===');
    console.log('Has Stripe key:', !!stripeSecretKey);
    console.log('Key prefix:', stripeSecretKey?.substring(0, 15));
    console.log('Node env:', process.env.NODE_ENV);
    console.log('Next URL:', process.env.NEXTAUTH_URL);

    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 503 }
      );
    }

    // Try a simple fetch first to test connectivity
    console.log('Testing direct Stripe API connectivity...');
    try {
      const testResponse = await fetch('https://api.stripe.com/v1/customers', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
        },
      });
      console.log('Direct API test status:', testResponse.status);
      console.log('Direct API test ok:', testResponse.ok);
    } catch (fetchError: any) {
      console.error('Direct API test failed:', fetchError.message);
    }

    console.log('Initializing Stripe SDK...');
    const Stripe = (await import('stripe')).default;
    const stripeClient = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20' as any,
      typescript: true,
      timeout: 30000, // 30 second timeout
      maxNetworkRetries: 2,
    });
    console.log('Stripe SDK initialized');

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
    console.log('Creating guest checkout session with priceId:', priceId);
    console.log('Stripe client initialized:', !!stripeClient);
    console.log('About to call Stripe API...');

    // Validate price ID format
    if (!priceId.startsWith('price_')) {
      console.error('Invalid price ID format:', priceId);
      return NextResponse.json(
        { error: 'Invalid price ID format' },
        { status: 400 }
      );
    }

    try {
      console.log('Calling stripe.checkout.sessions.create...');
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
      // Omit customer_email to let Stripe collect it during checkout
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

      console.log('Guest checkout session created successfully:', guestCheckoutSession.id);
      return NextResponse.json({ url: guestCheckoutSession.url });
    } catch (stripeError: any) {
      console.error('Stripe API error:', {
        message: stripeError.message,
        type: stripeError.type,
        code: stripeError.code,
        statusCode: stripeError.statusCode,
        raw: JSON.stringify(stripeError.raw || {}),
        stack: stripeError.stack,
      });
      throw stripeError;
    }
  } catch (error: any) {
    console.error('Error creating checkout session:', {
      message: error.message,
      type: error.type,
      code: error.code,
      statusCode: error.statusCode,
      raw: error.raw,
    });

    // Return more specific error message if available
    const errorMessage = error.message || 'Failed to create checkout session';
    return NextResponse.json(
      { error: errorMessage, details: error.type || 'unknown' },
      { status: 500 }
    );
  }
}
