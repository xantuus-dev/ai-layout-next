/**
 * Telegram Bot API Helper
 *
 * Utilities for interacting with the Telegram Bot API.
 * Documentation: https://core.telegram.org/bots/api
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org';

/**
 * Telegram Bot Info
 */
export interface TelegramBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
  can_join_groups: boolean;
  can_read_all_group_messages: boolean;
  supports_inline_queries: boolean;
}

/**
 * Telegram User
 */
export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

/**
 * Telegram Chat
 */
export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

/**
 * Telegram Message
 */
export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  entities?: Array<{
    type: string;
    offset: number;
    length: number;
  }>;
  reply_to_message?: TelegramMessage;
}

/**
 * Telegram Update
 */
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  callback_query?: {
    id: string;
    from: TelegramUser;
    message?: TelegramMessage;
    data?: string;
  };
}

/**
 * Send Message Options
 */
export interface SendMessageOptions {
  parse_mode?: 'Markdown' | 'MarkdownV2' | 'HTML';
  disable_web_page_preview?: boolean;
  disable_notification?: boolean;
  reply_to_message_id?: number;
  reply_markup?: {
    inline_keyboard?: Array<
      Array<{
        text: string;
        callback_data?: string;
        url?: string;
      }>
    >;
  };
}

/**
 * Get bot info
 */
export async function getTelegramBotInfo(
  botToken: string
): Promise<TelegramBotInfo> {
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/getMe`);
  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description}`);
  }

  return data.result;
}

/**
 * Set webhook URL for receiving updates
 */
export async function setTelegramWebhook(
  botToken: string,
  webhookUrl: string,
  options?: {
    secretToken?: string;
    max_connections?: number;
    allowed_updates?: string[];
  }
): Promise<boolean> {
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: options?.secretToken,
      max_connections: options?.max_connections || 40,
      allowed_updates: options?.allowed_updates || ['message', 'edited_message'],
    }),
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Failed to set webhook: ${data.description}`);
  }

  return data.result;
}

/**
 * Remove webhook (stop receiving updates)
 */
export async function deleteTelegramWebhook(botToken: string): Promise<boolean> {
  const response = await fetch(
    `${TELEGRAM_API_BASE}/bot${botToken}/deleteWebhook`,
    { method: 'POST' }
  );

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Failed to delete webhook: ${data.description}`);
  }

  return data.result;
}

/**
 * Get webhook info
 */
export async function getTelegramWebhookInfo(
  botToken: string
): Promise<{
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  allowed_updates?: string[];
}> {
  const response = await fetch(
    `${TELEGRAM_API_BASE}/bot${botToken}/getWebhookInfo`
  );
  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description}`);
  }

  return data.result;
}

/**
 * Send text message
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: number | string,
  text: string,
  options?: SendMessageOptions
): Promise<TelegramMessage> {
  const response = await fetch(
    `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...options,
      }),
    }
  );

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Failed to send message: ${data.description}`);
  }

  return data.result;
}

/**
 * Send chat action (typing indicator)
 */
export async function sendTelegramChatAction(
  botToken: string,
  chatId: number | string,
  action: 'typing' | 'upload_photo' | 'upload_document' | 'find_location'
): Promise<boolean> {
  const response = await fetch(
    `${TELEGRAM_API_BASE}/bot${botToken}/sendChatAction`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        action,
      }),
    }
  );

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Failed to send chat action: ${data.description}`);
  }

  return data.result;
}

/**
 * Answer callback query (from inline keyboard buttons)
 */
export async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  options?: {
    text?: string;
    show_alert?: boolean;
    url?: string;
  }
): Promise<boolean> {
  const response = await fetch(
    `${TELEGRAM_API_BASE}/bot${botToken}/answerCallbackQuery`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        ...options,
      }),
    }
  );

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Failed to answer callback query: ${data.description}`);
  }

  return data.result;
}

/**
 * Get chat info
 */
export async function getTelegramChat(
  botToken: string,
  chatId: number | string
): Promise<TelegramChat> {
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/getChat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId }),
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Failed to get chat info: ${data.description}`);
  }

  return data.result;
}

/**
 * Validate Telegram webhook secret token
 */
export function validateTelegramWebhook(
  requestSecretToken: string | null,
  expectedSecretToken: string
): boolean {
  return requestSecretToken === expectedSecretToken;
}

/**
 * Extract commands from message
 */
export function extractTelegramCommands(
  message: TelegramMessage
): Array<{ command: string; args: string }> {
  if (!message.text || !message.entities) {
    return [];
  }

  const commands: Array<{ command: string; args: string }> = [];

  for (const entity of message.entities) {
    if (entity.type === 'bot_command') {
      const commandText = message.text.substring(
        entity.offset,
        entity.offset + entity.length
      );
      const argsText = message.text.substring(entity.offset + entity.length).trim();

      commands.push({
        command: commandText,
        args: argsText,
      });
    }
  }

  return commands;
}

/**
 * Format text with Markdown
 */
export function formatTelegramMarkdown(text: string): string {
  // Escape special Markdown characters
  return text
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!');
}
