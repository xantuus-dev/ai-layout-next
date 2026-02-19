/**
 * Telegram Webhook Handler
 *
 * Receives incoming messages and updates from Telegram Bot API.
 * Handles commands, direct messages, and callback queries.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  sendTelegramMessage,
  sendTelegramChatAction,
  extractTelegramCommands,
  validateTelegramWebhook,
  answerCallbackQuery,
  TelegramUpdate,
  TelegramMessage,
} from '@/lib/telegram-bot';
import { captureAPIError } from '@/lib/sentry';

export const dynamic = 'force-dynamic';

/**
 * POST /api/integrations/telegram/webhook
 *
 * Receives updates from Telegram.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const update: TelegramUpdate = JSON.parse(body);

    // Get secret token from header
    const secretToken = req.headers.get('x-telegram-bot-api-secret-token');

    // Process the update
    const message = update.message || update.edited_message;
    const callbackQuery = update.callback_query;

    if (message) {
      await handleMessage(message, secretToken);
    } else if (callbackQuery) {
      await handleCallbackQuery(callbackQuery, secretToken);
    }

    // Always return 200 OK to acknowledge receipt
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error handling Telegram webhook:', error);
    captureAPIError(error as Error, '/api/integrations/telegram/webhook', 'POST');

    // Still return 200 to prevent Telegram from retrying
    return NextResponse.json({ ok: true });
  }
}

/**
 * Handle incoming message
 */
async function handleMessage(
  message: TelegramMessage,
  secretToken: string | null
) {
  try {
    const chatId = message.chat.id;
    const userId = message.from?.id;
    const text = message.text?.trim();

    if (!text || !userId) {
      return; // Ignore messages without text or sender
    }

    // Find integration by bot that received this message
    // We need to match based on the bot token, but we don't have direct access to it here
    // We'll need to find the integration and validate the secret token
    const integrations = await prisma.integration.findMany({
      where: {
        provider: 'telegram',
        isActive: true,
      },
    });

    // Find the matching integration by validating secret token
    let matchingIntegration = null;
    for (const integration of integrations) {
      const config = integration.config as any;
      if (
        config.secretToken &&
        validateTelegramWebhook(secretToken, config.secretToken)
      ) {
        matchingIntegration = integration;
        break;
      }
    }

    if (!matchingIntegration) {
      console.warn('[Telegram] No matching integration found for webhook');
      return;
    }

    const config = matchingIntegration.config as any;
    const botToken = matchingIntegration.accessToken!;

    // Extract commands
    const commands = extractTelegramCommands(message);

    // Handle commands
    if (commands.length > 0) {
      for (const { command, args } of commands) {
        await handleCommand(
          botToken,
          chatId,
          userId,
          command,
          args,
          matchingIntegration.userId
        );
      }
      return;
    }

    // Handle regular message
    await handleRegularMessage(
      botToken,
      chatId,
      userId,
      text,
      matchingIntegration.userId,
      config.botUsername
    );
  } catch (error) {
    console.error('Error handling Telegram message:', error);
  }
}

/**
 * Handle bot command (e.g., /start, /help)
 */
async function handleCommand(
  botToken: string,
  chatId: number,
  userId: number,
  command: string,
  args: string,
  ownerId: string
) {
  try {
    switch (command) {
      case '/start':
        await sendTelegramMessage(
          botToken,
          chatId,
          `👋 Welcome to your AI Assistant!\n\nI'm here to help you with tasks, research, and automation.\n\nJust send me a message and I'll get to work!\n\nCommands:\n/help - Show available commands\n/status - Check your account status\n/agents - List your AI agents`
        );
        break;

      case '/help':
        await sendTelegramMessage(
          botToken,
          chatId,
          `🤖 AI Assistant Commands\n\n/start - Start the bot\n/help - Show this help message\n/status - Check account and credits\n/agents - List your configured agents\n\nYou can also just send me any message or question, and I'll process it with your default agent.`
        );
        break;

      case '/status':
        // Fetch user status
        const user = await prisma.user.findUnique({
          where: { id: ownerId },
          select: {
            name: true,
            email: true,
            monthlyCredits: true,
            plan: true,
          },
        });

        if (!user) {
          await sendTelegramMessage(
            botToken,
            chatId,
            '❌ User not found. Please reconnect your Telegram bot.'
          );
          return;
        }

        await sendTelegramMessage(
          botToken,
          chatId,
          `📊 Account Status\n\n👤 Name: ${user.name || 'N/A'}\n📧 Email: ${user.email}\n💎 Plan: ${user.plan || 'Free'}\n⚡ Credits: ${user.monthlyCredits || 0} remaining this month`
        );
        break;

      case '/agents':
        // Fetch user's tasks as agents
        const tasks = await prisma.task.findMany({
          where: { userId: ownerId },
          select: {
            id: true,
            title: true,
            agentType: true,
            status: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });

        if (tasks.length === 0) {
          await sendTelegramMessage(
            botToken,
            chatId,
            '📋 You don\'t have any AI tasks yet.\n\nCreate your first task at: ' +
              process.env.NEXTAUTH_URL
          );
          return;
        }

        const taskList = tasks
          .map(
            (task, i) =>
              `${i + 1}. ${task.status === 'completed' ? '✅' : task.status === 'executing' ? '⚙️' : '📝'} ${task.title}${task.agentType ? ` (${task.agentType})` : ''}`
          )
          .join('\n');

        await sendTelegramMessage(
          botToken,
          chatId,
          `🤖 Your Recent AI Tasks\n\n${taskList}\n\nSend a message to create a new task.`
        );
        break;

      default:
        await sendTelegramMessage(
          botToken,
          chatId,
          `❓ Unknown command: ${command}\n\nTry /help to see available commands.`
        );
    }
  } catch (error) {
    console.error('Error handling command:', error);
    await sendTelegramMessage(
      botToken,
      chatId,
      '❌ An error occurred while processing your command.'
    );
  }
}

/**
 * Handle regular message (send to AI agent)
 */
async function handleRegularMessage(
  botToken: string,
  chatId: number,
  userId: number,
  text: string,
  ownerId: string,
  botUsername: string
) {
  try {
    // Send typing indicator
    await sendTelegramChatAction(botToken, chatId, 'typing');

    // TODO: Create or get existing conversation for this Telegram chat
    // TODO: Add message to conversation
    // TODO: Send to AI agent for processing
    // TODO: Get AI response
    // TODO: Send response back to Telegram

    // For now, send acknowledgment
    const response = `I received your message: "${text}"\n\n🚧 Agent processing is coming soon! Your message will be processed by your AI assistant and I'll respond with the results.`;

    await sendTelegramMessage(botToken, chatId, response);

    console.log(
      `[Telegram] Message from user ${userId} to owner ${ownerId}: ${text}`
    );
  } catch (error) {
    console.error('Error handling regular message:', error);
    await sendTelegramMessage(
      botToken,
      chatId,
      '❌ An error occurred while processing your message. Please try again.'
    );
  }
}

/**
 * Handle callback query (button presses)
 */
async function handleCallbackQuery(
  callbackQuery: NonNullable<TelegramUpdate['callback_query']>,
  secretToken: string | null
) {
  try {
    const { id, data, from, message } = callbackQuery;

    if (!data || !message) {
      return;
    }

    // Find integration by secret token
    const integrations = await prisma.integration.findMany({
      where: {
        provider: 'telegram',
        isActive: true,
      },
    });

    let matchingIntegration = null;
    for (const integration of integrations) {
      const config = integration.config as any;
      if (
        config.secretToken &&
        validateTelegramWebhook(secretToken, config.secretToken)
      ) {
        matchingIntegration = integration;
        break;
      }
    }

    if (!matchingIntegration) {
      console.warn('[Telegram] No matching integration for callback query');
      return;
    }

    const botToken = matchingIntegration.accessToken!;

    // Answer callback query
    await answerCallbackQuery(botToken, id, {
      text: 'Processing...',
    });

    // TODO: Handle different callback data types
    console.log(`[Telegram] Callback query from user ${from.id}: ${data}`);
  } catch (error) {
    console.error('Error handling callback query:', error);
  }
}
