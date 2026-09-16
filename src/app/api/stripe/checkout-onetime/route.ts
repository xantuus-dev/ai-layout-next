import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { stripe, isStripeEnabled } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { getCreditPackByPriceId } from '@/lib/pricing-config';

export async function POST(req: NextRequest) {
  try {
    if (!isStripeEnabled() || !stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 503 }
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { priceId, productType } = await req.json();

    if (!priceId) {
      return NextResponse.json({ error: 'priceId is required' }, { status: 400 });
    }

    // A credit purchase must name a price from our own catalog. The webhook
    // resolves the granted amount from this price rather than from anything
    // the caller sends, so an unknown price would take payment and grant
    // nothing — better to refuse here, while the customer can still see why.
    //
    // `credits` is deliberately NOT read from the body any more: it used to be
    // copied into session metadata and granted verbatim.
    if (productType === 'credits' && !getCreditPackByPriceId(priceId)) {
      return NextResponse.json(
        { error: 'Unknown credit pack' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create or get Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
        name: session.user.name || undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create one-time payment checkout
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment', // One-time payment
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXTAUTH_URL}/settings/billing?success=true&product=${productType}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/pricing?canceled=true`,
      metadata: {
        userId: user.id,
        productType, // 'credits', 'template', 'lifetime', etc.
        // No `credits` key: the webhook reads the purchased price off the
        // session's line items and resolves the amount from the catalog.
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Error creating one-time checkout:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
