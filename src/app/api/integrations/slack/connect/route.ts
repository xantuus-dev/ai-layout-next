/**
 * Slack OAuth Connect API
 *
 * Initiates the Slack OAuth flow by generating an authorization URL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateSlackAuthUrl } from '@/lib/slack-oauth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get return URL from query params
    const searchParams = req.nextUrl.searchParams;
    const returnUrl = searchParams.get('returnUrl') || '/settings/integrations';

    // Create state parameter with user context
    const stateData = {
      userId: session.user.id,
      returnUrl,
      timestamp: Date.now(),
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64');

    // Generate Slack OAuth URL
    const authUrl = generateSlackAuthUrl(state);

    return NextResponse.json({
      url: authUrl,
      provider: 'slack',
    });
  } catch (error) {
    console.error('Error generating Slack OAuth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    );
  }
}
