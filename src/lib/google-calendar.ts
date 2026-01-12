import { google, calendar_v3 } from 'googleapis';
import { getAuthenticatedClient } from './google-oauth';

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: { email: string; displayName?: string }[];
  reminders?: {
    useDefault?: boolean;
    overrides?: { method: 'email' | 'popup'; minutes: number }[];
  };
  conferenceData?: {
    createRequest?: {
      requestId: string;
      conferenceSolutionKey: { type: 'hangoutsMeet' };
    };
  };
}

export interface CalendarListItem {
  id: string;
  summary: string;
  description?: string;
  timeZone?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  primary?: boolean;
}

export class GoogleCalendarClient {
  private calendar: calendar_v3.Calendar | null = null;

  constructor(
    private accessToken: string,
    private refreshToken: string | null,
    private expiryDate: Date | null
  ) {}

  /**
   * Initialize the Calendar API client
   */
  private async init() {
    if (!this.calendar) {
      const auth = await getAuthenticatedClient(
        this.accessToken,
        this.refreshToken,
        this.expiryDate
      );
      this.calendar = google.calendar({ version: 'v3', auth });
    }
    return this.calendar;
  }

  /**
   * Create a calendar event
   */
  async createEvent(
    event: CalendarEvent,
    calendarId: string = 'primary',
    conferenceData?: boolean
  ): Promise<CalendarEvent> {
    const calendar = await this.init();

    const response = await calendar.events.insert({
      calendarId,
      conferenceDataVersion: conferenceData ? 1 : undefined,
      requestBody: event as calendar_v3.Schema$Event,
    });

    return response.data as CalendarEvent;
  }

  /**
   * List calendar events
   */
  async listEvents(options?: {
    calendarId?: string;
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    query?: string;
    singleEvents?: boolean;
    orderBy?: 'startTime' | 'updated';
  }): Promise<CalendarEvent[]> {
    const calendar = await this.init();

    const response = await calendar.events.list({
      calendarId: options?.calendarId || 'primary',
      timeMin: options?.timeMin || new Date().toISOString(),
      timeMax: options?.timeMax,
      maxResults: options?.maxResults || 20,
      singleEvents: options?.singleEvents !== false,
      orderBy: options?.orderBy || 'startTime',
      q: options?.query,
    });

    return (response.data.items || []) as CalendarEvent[];
  }

  /**
   * Get a specific event
   */
  async getEvent(eventId: string, calendarId: string = 'primary'): Promise<CalendarEvent> {
    const calendar = await this.init();

    const response = await calendar.events.get({
      calendarId,
      eventId,
    });

    return response.data as CalendarEvent;
  }

  /**
   * Update an event
   */
  async updateEvent(
    eventId: string,
    updates: Partial<CalendarEvent>,
    calendarId: string = 'primary'
  ): Promise<CalendarEvent> {
    const calendar = await this.init();

    const response = await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: updates as calendar_v3.Schema$Event,
    });

    return response.data as CalendarEvent;
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId: string, calendarId: string = 'primary'): Promise<void> {
    const calendar = await this.init();

    await calendar.events.delete({
      calendarId,
      eventId,
    });
  }

  /**
   * List user's calendars
   */
  async listCalendars(): Promise<CalendarListItem[]> {
    const calendar = await this.init();

    const response = await calendar.calendarList.list();

    return (response.data.items || []) as CalendarListItem[];
  }

  /**
   * Get free/busy information
   */
  async getFreeBusy(options: {
    timeMin: string;
    timeMax: string;
    items: { id: string }[];
  }): Promise<any> {
    const calendar = await this.init();

    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: options.timeMin,
        timeMax: options.timeMax,
        items: options.items,
      },
    });

    return response.data;
  }

  /**
   * Create a quick event using natural language
   */
  async quickAdd(text: string, calendarId: string = 'primary'): Promise<CalendarEvent> {
    const calendar = await this.init();

    const response = await calendar.events.quickAdd({
      calendarId,
      text,
    });

    return response.data as CalendarEvent;
  }

  /**
   * Create an event with Google Meet link
   */
  async createMeetingEvent(event: CalendarEvent, calendarId: string = 'primary'): Promise<CalendarEvent> {
    const eventWithConference = {
      ...event,
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' as const },
        },
      },
    };

    return this.createEvent(eventWithConference, calendarId, true);
  }
}
