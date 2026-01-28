import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeKey) {
      return NextResponse.json({ error: 'No Stripe key found' });
    }

    // Import Stripe
    const Stripe = (await import('stripe')).default;

    console.log('Creating Stripe client...');
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2024-06-20' as any,
      typescript: true,
      timeout: 30000,
      maxNetworkRetries: 0, // Disable retries for faster error reporting
    });

    console.log('Attempting to create a test checkout session...');

    const successUrl = 'https://ai.xantuus.com/?success=true';
    const cancelUrl = 'https://ai.xantuus.com/?canceled=true';

    console.log('Success URL:', successUrl, 'Length:', successUrl.length);
    console.log('Cancel URL:', cancelUrl, 'Length:', cancelUrl.length);
    console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL);

    // Try to create a minimal checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: 'price_1SsrtPD47f8Khc6JRyr0k3xH',
        quantity: 1,
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    console.log('Session created successfully:', session.id);

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });

  } catch (error: any) {
    console.error('=== DETAILED ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error type:', error.type);
    console.error('Error code:', error.code);
    console.error('Error statusCode:', error.statusCode);
    console.error('Error stack:', error.stack);
    console.error('Full error:', JSON.stringify(error, null, 2));

    return NextResponse.json({
      error: error.message,
      type: error.type,
      code: error.code,
      statusCode: error.statusCode,
      name: error.name,
      raw: error.raw,
    }, { status: 500 });
  }
}
