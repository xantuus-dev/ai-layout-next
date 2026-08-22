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
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { postSlackMessage } from '@/lib/slack-oauth';
import { captureAPIError } from '@/lib/sentry';

export const dynamic = 'force-dynamic';

// Reject requests older than this to blunt replay attacks (Slack's own recommendation)
const SLACK_TIMESTAMP_TOLERANCE_SECONDS = 60 * 5;

/**
 * Verify a request actually came from Slack.
 * https://api.slack.com/authentication/verifying-requests-from-slack
 *
 * Slack signs the raw request body, so `body` must be the unparsed text.
 */
function verifySlackRequest(req: NextRequest, body: string): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  // In production, the signing secret is REQUIRED
  if (!signingSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('SLACK_SIGNING_SECRET not configured in production!');
      return false; // REJECT in production
    }
    console.warn('SLACK_SIGNING_SECRET not configured - allowing in development only');
    return true; // Allow in development only
  }

  const signature = req.headers.get('x-slack-signature');
  const timestamp = req.headers.get('x-slack-request-timestamp');

  if (!signature || !timestamp) {
    console.warn('Slack request missing signature or timestamp header');
    return false;
  }

  // Reject stale requests so a captured payload can't be replayed later
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    console.warn('Slack request has a non-numeric timestamp header');
    return false;
  }

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds);
  if (ageSeconds > SLACK_TIMESTAMP_TOLERANCE_SECONDS) {
    console.warn(`Slack request timestamp outside tolerance (${ageSeconds}s old)`);
    return false;
  }

  const expected =
    'v0=' +
    crypto
      .createHmac('sha256', signingSecret)
      .update(`v0:${timestamp}:${body}`)
      .digest('hex');

  // timingSafeEqual throws on length mismatch, so check that first
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const signatureBuffer = Buffer.from(signature, 'utf8');
  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
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

    // Verify authenticity before parsing or acting on anything, including the
    // url_verification handshake — Slack signs that request too
    if (!verifySlackRequest(req, body)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload: SlackEvent = JSON.parse(body);

    // Handle URL verification challenge (Slack's initial setup)
    if (payload.type === 'url_verification') {
      return NextResponse.json({
        challenge: payload.challenge,
      });
    }

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

    // TODO: Create conversation or add to exi```````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````````sting conversation
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
