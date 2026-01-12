import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GoogleCalendarClient } from '@/lib/google-calendar';

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

    // Get user with Calendar credentials
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        googleAccessToken: true,
        googleRefreshToken: true,
        googleTokenExpiry: true,
        googleCalendarEnabled: true,
      },
    });

    if (!user?.googleCalendarEnabled || !user.googleAccessToken) {
      return NextResponse.json(
        { error: 'Google Calendar not connected' },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const calendarId = searchParams.get('calendarId') || 'primary';
    const timeMin = searchParams.get('timeMin') || new Date().toISOString();
    const timeMax = searchParams.get('timeMax') || undefined;
    const maxResults = parseInt(searchParams.get('maxResults') || '20');

    // Initialize Calendar client
    const calendarClient = new GoogleCalendarClient(
      user.googleAccessToken,
      user.googleRefreshToken,
      user.googleTokenExpiry
    );

    // List events
    const events = await calendarClient.listEvents({
      calendarId,
      timeMin,
      timeMax,
      maxResults,
    });

    return NextResponse.json({
      success: true,
      events,
    });
  } catch (error) {
    console.error('Error listing calendar events:', error);
    return NextResponse.json(
      { error: 'Failed to list calendar events' },
      { status: 500 }
    );
  }
}
