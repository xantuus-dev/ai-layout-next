import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { revokeToken } from '@/lib/google-oauth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's current tokens
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        googleAccessToken: true,
        googleRefreshToken: true,
      },
    });

    if (!user?.googleAccessToken) {
      return NextResponse.json(
        { error: 'No Google connection found' },
        { status: 404 }
      );
    }

    // Revoke the token with Google
    try {
      await revokeToken(user.googleAccessToken);
    } catch (error) {
      console.error('Error revoking Google token:', error);
      // Continue even if revocation fails - we'll still clear local tokens
    }

    // Clear all Google tokens and disable services
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiry: null,
        googleDriveEnabled: false,
        googleGmailEnabled: false,
        googleCalendarEnabled: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Google services disconnected successfully',
    });
  } catch (error) {
    console.error('Error disconnecting Google services:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Google services' },
      { status: 500 }
    );
  }
}
