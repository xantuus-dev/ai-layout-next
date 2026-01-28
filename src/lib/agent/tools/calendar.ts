/**
 * Google Calendar Tools - Event management
 *
 * Integrates with existing Google Calendar integration
 */

import { AgentTool, AgentContext, ToolResult } from '../types';
import { GoogleCalendarClient, CalendarEvent } from '@/lib/google-calendar';

/**
 * Helper to get user with Calendar permissions
 */
async function getUserWithCalendar(userId: string, prisma: any) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleAccessToken: true,
      googleRefreshToken: true,
      googleTokenExpiry: true,
      googleCalendarEnabled: true,
    },
  });

  if (!user?.googleCalendarEnabled || !user.googleAccessToken) {
    throw new Error('Google Calendar not connected. Please connect in /settings/integrations');
  }

  return user;
}

/**
 * Create a calendar event
 */
export class CalendarCreateEventTool implements AgentTool {
  name = 'calendar.createEvent';
  description = 'Create a new calendar event. Provide title (summary), startTime, endTime, and optional description, location, attendees.';
  category = 'integration' as const;

  validate(params: any): { valid: boolean; error?: string } {
    if (!params.title || typeof params.title !== 'string') {
      return { valid: false, error: 'title parameter required (string)' };
    }

    if (!params.startTime || typeof params.startTime !== 'string') {
      return { valid: false, error: 'startTime parameter required (ISO string)' };
    }

    if (!params.endTime || typeof params.endTime !== 'string') {
      return { valid: false, error: 'endTime parameter required (ISO string)' };
    }

    return { valid: true };
  }

  async execute(
    params: {
      title: string;
      startTime: string;
      endTime: string;
      description?: string;
      location?: string;
      attendees?: string[];
      timezone?: string;
    },
    context: AgentContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const user = await getUserWithCalendar(context.userId, context.prisma);

      const calendar = new GoogleCalendarClient(
        user.googleAccessToken!,
        user.googleRefreshToken,
        user.googleTokenExpiry
      );

      const event: CalendarEvent = {
        summary: params.title,
        description: params.description,
        location: params.location,
        start: {
          dateTime: params.startTime,
          timeZone: params.timezone || 'America/New_York',
        },
        end: {
          dateTime: params.endTime,
          timeZone: params.timezone || 'America/New_York',
        },
        attendees: params.attendees?.map(email => ({ email })),
      };

      const result = await calendar.createEvent(event);

      return {
        success: true,
        data: {
          eventId: result.id,
          title: result.summary,
          startTime: result.start.dateTime,
          endTime: result.end.dateTime,
        },
        metadata: {
          duration: Date.now() - startTime,
          credits: 20,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        metadata: {
          duration: Date.now() - startTime,
          credits: 20,
        },
      };
    }
  }

  estimateCost(params: any): number {
    return 20;
  }
}

/**
 * List calendar events
 */
export class CalendarListEventsTool implements AgentTool {
  name = 'calendar.listEvents';
  description = 'List upcoming calendar events. Optionally filter by startDate, endDate, maxResults, or search query.';
  category = 'integration' as const;

  validate(params: any): { valid: boolean; error?: string } {
    return { valid: true };
  }

  async execute(
    params: {
      startDate?: string;
      endDate?: string;
      maxResults?: number;
      query?: string;
    },
    context: AgentContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const user = await getUserWithCalendar(context.userId, context.prisma);

      const calendar = new GoogleCalendarClient(
        user.googleAccessToken!,
        user.googleRefreshToken,
        user.googleTokenExpiry
      );

      const events = await calendar.listEvents({
        timeMin: params.startDate || new Date().toISOString(),
        timeMax: params.endDate,
        maxResults: params.maxResults || 10,
        query: params.query,
      });

      return {
        success: true,
        data: {
          count: events.length,
          events: events.map(e => ({
            id: e.id,
            title: e.summary,
            description: e.description,
            location: e.location,
            startTime: e.start.dateTime || e.start.date,
            endTime: e.end.dateTime || e.end.date,
            attendees: e.attendees?.map(a => a.email),
          })),
        },
        metadata: {
          duration: Date.now() - startTime,
          credits: 10,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        metadata: {
          duration: Date.now() - startTime,
          credits: 10,
        },
      };
    }
  }

  estimateCost(params: any): number {
    return 10;
  }
}

/**
 * Update a calendar event
 */
export class CalendarUpdateEventTool implements AgentTool {
  name = 'calendar.updateEvent';
  description = 'Update an existing calendar event. Provide eventId and the fields to update.';
  category = 'integration' as const;

  validate(params: any): { valid: boolean; error?: string } {
    if (!params.eventId || typeof params.eventId !== 'string') {
      return { valid: false, error: 'eventId parameter required (string)' };
    }

    return { valid: true };
  }

  async execute(
    params: {
      eventId: string;
      title?: string;
      description?: string;
      startTime?: string;
      endTime?: string;
      location?: string;
      timezone?: string;
    },
    context: AgentContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const user = await getUserWithCalendar(context.userId, context.prisma);

      const calendar = new GoogleCalendarClient(
        user.googleAccessToken!,
        user.googleRefreshToken,
        user.googleTokenExpiry
      );

      const updates: Partial<CalendarEvent> = {};

      if (params.title) updates.summary = params.title;
      if (params.description) updates.description = params.description;
      if (params.location) updates.location = params.location;

      if (params.startTime) {
        updates.start = {
          dateTime: params.startTime,
          timeZone: params.timezone || 'America/New_York',
        };
      }

      if (params.endTime) {
        updates.end = {
          dateTime: params.endTime,
          timeZone: params.timezone || 'America/New_York',
        };
      }

      const result = await calendar.updateEvent(params.eventId, updates);

      return {
        success: true,
        data: {
          eventId: result.id,
          title: result.summary,
          updated: true,
        },
        metadata: {
          duration: Date.now() - startTime,
          credits: 15,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        metadata: {
          duration: Date.now() - startTime,
          credits: 15,
        },
      };
    }
  }

  estimateCost(params: any): number {
    return 15;
  }
}

/**
 * Delete a calendar event
 */
export class CalendarDeleteEventTool implements AgentTool {
  name = 'calendar.deleteEvent';
  description = 'Delete a calendar event by its eventId.';
  category = 'integration' as const;

  validate(params: any): { valid: boolean; error?: string } {
    if (!params.eventId || typeof params.eventId !== 'string') {
      return { valid: false, error: 'eventId parameter required (string)' };
    }

    return { valid: true };
  }

  async execute(
    params: { eventId: string },
    context: AgentContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const user = await getUserWithCalendar(context.userId, context.prisma);

      const calendar = new GoogleCalendarClient(
        user.googleAccessToken!,
        user.googleRefreshToken,
        user.googleTokenExpiry
      );

      await calendar.deleteEvent(params.eventId);

      return {
        success: true,
        data: {
          eventId: params.eventId,
          deleted: true,
        },
        metadata: {
          duration: Date.now() - startTime,
          credits: 10,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        metadata: {
          duration: Date.now() - startTime,
          credits: 10,
        },
      };
    }
  }

  estimateCost(params: any): number {
    return 10;
  }
}
