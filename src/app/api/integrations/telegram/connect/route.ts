/**
 * Telegram Bot Registration API
 *
 * Allows users to connect their Telegram bot by providing the bot token.
 * Sets up webhook and stores integration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getTelegramBotInfo,
  setTelegramWebhook,
  getTelegramWebhookInfo,
} from '@/lib/telegram-bot';
import { captureAPIError } from '@/lib/sentry';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * POST /api/integrations/telegram/connect
 *
 * Register a Telegram bot by providing the bot token.
 *
 * Request body:
 *   {
 *     "botToken": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
 *   }
 *
 * Response:
 *   {
 *     "success": true,
 *     "integration": { ... },
 *     "botInfo": { ... }
 *   }
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Parse request body
    const body = await req.json();
    const { botToken } = body;

    if (!botToken || typeof botToken !== 'string') {
      return NextResponse.json(
        { error: 'Bot token is required' },
        { status: 400 }
      );
    }

    // Validate bot token format (basic check)
    if (!/^\d+:[A-Za-z0-9_-]{35}$/.test(botToken)) {
      return NextResponse.json(
        { error: 'Invalid bot token format' },
        { status: 400 }
      );
    }

    // Get bot info to validate token
    let botInfo;
    try {
      botInfo = await getTelegramBotInfo(botToken);
    } catch (error) {
      console.error('Failed to validate Telegram bot token:', error);
      return NextResponse.json(
        { error: 'Invalid bot token or Telegram API error' },
        { status: 400 }
      );
    }

    if (!botInfo.is_bot) {
      return NextResponse.json(
        { error: 'Token does not belong to a bot account' },
        { status: 400 }
      );
    }

    // Generate secret token for webhook security
    const secretToken = crypto.randomBytes(32).toString('hex');

    // Set webhook URL
    const webhookUrl = `${process.env.NEXTAUTH_URL}/api/integrations/telegram/webhook`;

    try {
      await setTelegramWebhook(botToken, webhookUrl, {
        secretToken,
        max_connections: 40,
        allowed_updates: ['message', 'edited_message', 'callback_query'],
      });
    } catch (error) {
      console.error('Failed to set Telegram webhook:', error);
      return NextResponse.json(
        { error: 'Failed to configure webhook' },
        { status: 500 }
      );
    }

    // Verify webhook was set
    let webhookInfo;
    try {
      webhookInfo = await getTelegramWebhookInfo(botToken);
    } catch (error) {
      console.error('Failed to verify webhook:', error);
      // Continue anyway, webhook might still work
    }

    // Store integration in database
    const integration = await prisma.integration.upsert({
      where: {
        userId_provider: {
          userId,
          provider: 'telegram',
        },
      },
      update: {
        name: `Telegram - @${botInfo.username}`,
        accessToken: botToken,
        isActive: true,
        config: {
          botId: botInfo.id,
          botUsername: botInfo.username,
          botName: botInfo.first_name,
          canJoinGroups: botInfo.can_join_groups,
          canReadAllGroupMessages: botInfo.can_read_all_group_messages,
          supportsInlineQueries: botInfo.supports_inline_queries,
          webhookUrl,
          secretToken,
          webhookSetAt: new Date().toISOString(),
          webhookInfo: webhookInfo || null,
        },
      },
      create: {
        userId,
        provider: 'telegram',
        name: `Telegram - @${botInfo.username}`,
        accessToken: botToken,
        isActive: true,
        config: {
          botId: botInfo.id,
          botUsername: botInfo.username,
          botName: botInfo.first_name,
          canJoinGroups: botInfo.can_join_groups,
          canReadAllGroupMessages: botInfo.can_read_all_group_messages,
          supportsInlineQueries: botInfo.supports_inline_queries,
          webhookUrl,
          secretToken,
          webhookSetAt: new Date().toISOString(),
          webhookInfo: webhookInfo || null,
        },
      },
    });

    console.log(
      `[Telegram] Bot connected for user ${userId}: @${botInfo.username}`
    );

    return NextResponse.json({
      success: true,
      integration: {
        id: integration.id,
        provider: integration.provider,
        isActive: integration.isActive,
        createdAt: integration.createdAt,
      },
      botInfo: {
        id: botInfo.id,
        username: botInfo.username,
        name: botInfo.first_name,
      },
      webhookUrl,
    });
  } catch (error) {
    console.error('Error connecting Telegram bot:', error);
    captureAPIError(error as Error, '/api/integrations/telegram/connect', 'POST');

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/integrations/telegram/connect
 *
 * Get current Telegram integration status.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const integration = await prisma.integration.findFirst({
      where: {
        userId: session.user.id,
        provider: 'telegram',
      },
      select: {
        id: true,
        provider: true,
        isActive: true,
        createdAt: true,
        config: true,
      },
    });

    if (!integration) {
      return NextResponse.json({ connected: false });
    }

    const config = integration.config as any;

    return NextResponse.json({
      connected: true,
      integration: {
        id: integration.id,
        provider: integration.provider,
        isActive: integration.isActive,
        createdAt: integration.createdAt,
      },
      botInfo: {
        id: config.botId,
        username: config.botUsername,
        name: config.botName,
      },
      webhookUrl: config.webhookUrl,
    });
  } catch (error) {
    console.error('Error fetching Telegram integration:', error);
    captureAPIError(error as Error, '/api/integrations/telegram/connect', 'GET');

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/integrations/telegram/connect
 *
 * Disconnect Telegram bot integration.
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const integration = await prisma.integration.findFirst({
      where: {
        userId: session.user.id,
        provider: 'telegram',
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'No Telegram integration found' },
        { status: 404 }
      );
    }

    // Optionally delete webhook (not strictly necessary)
    // This would require importing deleteTelegramWebhook and calling it

    // Delete integration
    await prisma.integration.delete({
      where: { id: integration.id },
    });

    console.log(`[Telegram] Bot disconnected for user ${session.user.id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Telegram bot:', error);
    captureAPIError(error as Error, '/api/integrations/telegram/connect', 'DELETE');

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
