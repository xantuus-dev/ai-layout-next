/**
 * Slack OAuth Integration
 *
 * Handles OAuth flow, token management, and API interactions for Slack.
 */

// Slack OAuth Configuration
export const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
export const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
export const SLACK_REDIRECT_URI =
  process.env.SLACK_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/integrations/slack/callback`;

// Slack OAuth scopes
// https://api.slack.com/scopes
export const SLACK_SCOPES = [
  // Bot token scopes
  'chat:write',           // Send messages as bot
  'channels:read',        // View channels
  'channels:history',     // View messages in channels
  'groups:read',          // View private channels
  'groups:history',       // View messages in private channels
  'im:read',              // View DMs
  'im:history',           // View DM history
  'im:write',             // Send DMs
  'users:read',           // View user info
  'users:read.email',     // View user email
  'commands',             // Receive slash commands
  'app_mentions:read',    // Receive @mentions
].join(',');

// User token scopes (if needed)
export const SLACK_USER_SCOPES = [
  'identify',             // View basic user info
  'chat:write',           // Send messages as user
].join(',');

export interface SlackTokens {
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id?: string;
  app_id?: string;
  team?: {
    id: string;
    name: string;
  };
  authed_user?: {
    id: string;
    scope: string;
    access_token?: string;
    token_type?: string;
  };
  enterprise?: {
    id: string;
    name: string;
  };
}

/**
 * Generate Slack OAuth URL for user authorization
 */
export function generateSlackAuthUrl(state?: string): string {
  if (!SLACK_CLIENT_ID) {
    throw new Error('SLACK_CLIENT_ID environment variable is not set');
  }

  const params = new URLSearchParams({
    client_id: SLACK_CLIENT_ID,
    scope: SLACK_SCOPES,
    user_scope: SLACK_USER_SCOPES,
    redirect_uri: SLACK_REDIRECT_URI!,
    ...(state && { state }),
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function getSlackTokensFromCode(code: string): Promise<SlackTokens> {
  if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
    throw new Error('Slack OAuth credentials are not configured');
  }

  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      code,
      redirect_uri: SLACK_REDIRECT_URI!,
    }),
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Slack OAuth error: ${data.error || 'Unknown error'}`);
  }

  return data as SlackTokens;
}

/**
 * Revoke Slack token
 */
export async function revokeSlackToken(token: string): Promise<void> {
  if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
    throw new Error('Slack OAuth credentials are not configured');
  }

  const response = await fetch('https://slack.com/api/auth.revoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      token,
    }),
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Failed to revoke Slack token: ${data.error}`);
  }
}

/**
 * Test token validity
 */
export async function testSlackToken(token: string): Promise<{
  ok: boolean;
  url?: string;
  team?: string;
  user?: string;
  team_id?: string;
  user_id?: string;
  bot_id?: string;
  error?: string;
}> {
  const response = await fetch('https://slack.com/api/auth.test', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return response.json();
}

/**
 * Post message to Slack channel
 */
export async function postSlackMessage(
  token: string,
  channel: string,
  text: string,
  options?: {
    thread_ts?: string; // Reply to thread
    blocks?: any[]; // Rich formatting
    attachments?: any[]; // Legacy attachments
  }
): Promise<{ ok: boolean; ts?: string; error?: string }> {
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel,
      text,
      ...options,
    }),
  });

  return response.json();
}

/**
 * Get user info
 */
export async function getSlackUser(
  token: string,
  userId: string
): Promise<{
  ok: boolean;
  user?: {
    id: string;
    name: string;
    real_name: string;
    profile: {
      email?: string;
      image_192?: string;
      [key: string]: any;
    };
  };
  error?: string;
}> {
  const response = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.json();
}

/**
 * Get conversations (channels) list
 */
export async function getSlackConversations(
  token: string,
  types: string = 'public_channel,private_channel,im,mpim'
): Promise<{
  ok: boolean;
  channels?: Array<{
    id: string;
    name: string;
    is_channel: boolean;
    is_group: boolean;
    is_im: boolean;
    is_mpim: boolean;
    is_private: boolean;
  }>;
  error?: string;
}> {
  const response = await fetch(`https://slack.com/api/conversations.list?types=${types}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.json();
}
