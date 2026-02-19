/**
 * Slack Events API Handler
 *
 * Handles incoming events from Slack:
 * - URL verification challenge
 * - App mentions (@bot)
 * - Direct messages
 * - Message events
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { postSlackMessage } from '@/lib/slack-oauth';
import { captureAPIError } from '@/lib/sentry';

export const dynamic = 'force-dynamic';

// Slack sends a signing secret to verify requests
// We'll implement this for security
function verifySlackRequest(req: NextRequest, body: string): boolean {
  // TODO: Implement Slack signature verification
  // https://api.slack.com/authentication/verifying-requests-from-slack
  // For now, we'll accept all requests (NOT PRODUCTION READY)
  return true;
}

interface SlackEvent {
  type: string;
  event?: {
    type: string;
    user: string;
    text: string;
    ts: string;
    channel: string;
    event_ts: string;
    channel_type?: string;
    thread_ts?: string;
    bot_id?: string;
  };
  challenge?: string; // For URL verification
  team_id?: string;
  api_app_id?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const payload: SlackEvent = JSON.parse(body);

    // Handle URL verification challenge (Slack's initial setup)
    if (payload.type === 'url_verification') {
      return NextResponse.json({
        challenge: payload.challenge,
      });
    }

    // Verify request authenticity (TODO: implement)
    // if (!verifySlackRequest(req, body)) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    // }

    // Handle event callbacks
    if (payload.type === 'event_callback' && payload.event) {
      const event = payload.event;

      // Ignore bot messages to prevent loops
      if (event.bot_id) {
        return NextResponse.json({ ok: true });
      }

      // Find integration for this team
      const integration = await prisma.integration.findFirst({
        where: {
          provider: 'slack',
          config: {
            path: ['teamId'],
            equals: payload.team_id,
          },
          isActive: true,
        },
      });

      if (!integration) {
        console.warn(`No active Slack integration found for team: ${payload.team_id}`);
        return NextResponse.json({ ok: true }); // Acknowledge but don't process
      }

      // Handle different event types
      switch (event.type) {
        case 'app_mention':
          await handleAppMention(integration, event);
          break;

        case 'message':
          // Only process DMs (im channel type)
          if (event.channel_type === 'im') {
            await handleDirectMessage(integration, event);
          }
          break;

        default:
          console.log(`Unhandled Slack event type: ${event.type}`);
      }
    }

    // Acknowledge receipt
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error handling Slack event:', error);
    captureAPIError(error as Error, '/api/integrations/slack/events', 'POST');

    // Still acknowledge to Slack to prevent retries
    return NextResponse.json({ ok: true });
  }
}

/**
 * Handle app mention (@bot messages)
 */
async function handleAppMention(
  integration: any,
  event: NonNullable<SlackEvent['event']>
) {
  try {
    // Extract user message (remove bot mention)
    const botUserId = (integration.config as any)?.botUserId;
    const userMessage = event.text.replace(new RegExp(`<@${botUserId}>`, 'g'), '').trim();

    if (!userMessage) {
      return; // Empty message
    }

    // TODO: Create conversation or add to existing conversation
    // TODO: Send message to AI agent
    // TODO: Get AI response

    // For now, send acknowledgment
    const response = `I received your message: "${userMessage}". Agent processing is coming soon!`;

    await postSlackMessage(
      integration.accessToken!,
      event.channel,
      response,
      {
        thread_ts: event.thread_ts || event.ts, // Reply in thread
      }
    );

    // TODO: Queue agent task for processing
    console.log(`[Slack] App mention from user ${event.user}: ${userMessage}`);
  } catch (error) {
    console.error('Error handling app mention:', error);
  }
}

/**
 * Handle direct message
 */
async function handleDirectMessage(
  integration: any,
  event: NonNullable<SlackEvent['event']>
) {
  try {
    const userMessage = event.text.trim();

    if (!userMessage) {
      return; // Empty message
    }

    // TODO: Create conversation or add to existing conversation
    // TODO: Send message to AI agent
    // TODO: Get AI response

    // For now, send acknowledgment
    const response = `I received your DM: "${userMessage}". Agent processing is coming soon!`;

    await postSlackMessage(
      integration.accessToken!,
      event.channel,
      response
    );

    // TODO: Queue agent task for processing
    console.log(`[Slack] DM from user ${event.user}: ${userMessage}`);
  } catch (error) {
    console.error('Error handling direct message:', error);
  }
}
