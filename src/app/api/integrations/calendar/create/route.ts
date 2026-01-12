import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GoogleCalendarClient, CalendarEvent } from '@/lib/google-calendar';

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

    // Parse request body
    const { event, calendarId, createMeet } = await req.json();

    if (!event || !event.summary || !event.start || !event.end) {
      return NextResponse.json(
        { error: 'Event summary, start, and end are required' },
        { status: 400 }
      );
    }

    // Initialize Calendar client
    const calendarClient = new GoogleCalendarClient(
      user.googleAccessToken,
      user.googleRefreshToken,
      user.googleTokenExpiry
    );

    // Create event (with or without Google Meet)
    const result = createMeet
      ? await calendarClient.createMeetingEvent(event as CalendarEvent, calendarId)
      : await calendarClient.createEvent(event as CalendarEvent, calendarId);

    return NextResponse.json({
      success: true,
      event: result,
    });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return NextResponse.json(
      { error: 'Failed to create calendar event' },
      { status: 500 }
    );
  }
}
