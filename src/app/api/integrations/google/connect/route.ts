import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateAuthUrl } from '@/lib/google-oauth';

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get requested services from query params
    const searchParams = req.nextUrl.searchParams;
    const servicesParam = searchParams.get('services');
    const validServices = ['drive', 'gmail', 'calendar'] as const;
    const services = servicesParam
      ? servicesParam.split(',').filter((s): s is 'drive' | 'gmail' | 'calendar' =>
          validServices.includes(s as any)
        )
      : ['drive', 'gmail', 'calendar'] as ('drive' | 'gmail' | 'calendar')[];

    // Generate OAuth URL
    const authUrl = generateAuthUrl(services);

    // Store requested services in session/cookie for callback
    // For now, we'll pass it as state parameter
    const stateData = {
      userId: session.user.id,
      services,
      returnUrl: searchParams.get('returnUrl') || '/settings/integrations',
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64');

    const finalUrl = `${authUrl}&state=${encodeURIComponent(state)}`;

    return NextResponse.json({
      url: finalUrl,
      services
    });
  } catch (error) {
    console.error('Error generating Google OAuth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    );
  }
}
