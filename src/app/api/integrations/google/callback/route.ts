import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTokensFromCode } from '@/lib/google-oauth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.redirect(new URL('/auth/signin', req.url));
    }

    // Get authorization code and state
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/settings/integrations?error=${encodeURIComponent(error)}`, req.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/settings/integrations?error=no_code', req.url)
      );
    }

    // Decode state
    let stateData: {
      userId: string;
      services: string[];
      returnUrl: string;
    };
    try {
      stateData = JSON.parse(Buffer.from(state || '', 'base64').toString());
    } catch {
      return NextResponse.redirect(
        new URL('/settings/integrations?error=invalid_state', req.url)
      );
    }

    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);

    if (!tokens.access_token) {
      throw new Error('No access token received');
    }

    // Determine which services to enable based on scopes
    const scopes = tokens.scope?.toLowerCase() || '';
    const enableDrive = stateData.services.includes('drive') && scopes.includes('drive');
    const enableGmail = stateData.services.includes('gmail') && scopes.includes('gmail');
    const enableCalendar = stateData.services.includes('calendar') && scopes.includes('calendar');

    // Calculate expiry date
    const expiryDate = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000); // Default 1 hour

    // Update user with tokens
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token || undefined,
        googleTokenExpiry: expiryDate,
        googleDriveEnabled: enableDrive,
        googleGmailEnabled: enableGmail,
        googleCalendarEnabled: enableCalendar,
      },
    });

    // Redirect to return URL with success message
    const returnUrl = stateData.returnUrl || '/settings/integrations';
    const successMessage = [
      enableDrive && 'Google Drive',
      enableGmail && 'Gmail',
      enableCalendar && 'Google Calendar'
    ].filter(Boolean).join(', ');

    return NextResponse.redirect(
      new URL(
        `${returnUrl}?success=true&services=${encodeURIComponent(successMessage)}`,
        req.url
      )
    );
  } catch (error) {
    console.error('Error handling Google OAuth callback:', error);
    return NextResponse.redirect(
      new URL('/settings/integrations?error=callback_failed', req.url)
    );
  }
}
