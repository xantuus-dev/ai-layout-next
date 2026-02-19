# Messenger Integrations Guide

Complete guide for Slack and Telegram bot integrations with your AI assistant platform.

---

## 🚀 Overview

Your platform now supports two messenger integrations:
- **Slack**: OAuth-based integration for workspace communication
- **Telegram**: Bot token-based integration for personal and group chats

Both integrations allow users to interact with their AI assistants directly from their preferred messaging platform.

---

## 📱 Telegram Integration

### Prerequisites

1. A Telegram account
2. Access to the Telegram app (mobile or desktop)

### Setup Instructions

#### Step 1: Create a Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Start a chat with BotFather
3. Send the `/newbot` command
4. Follow the prompts:
   - Enter a name for your bot (e.g., "My AI Assistant")
   - Enter a username for your bot (must end in "bot", e.g., "myai_assistant_bot")
5. BotFather will provide you with a **bot token** (format: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)
6. **Save this token** - you'll need it in the next step

#### Step 2: Connect Bot to Platform

1. Log into your AI assistant platform
2. Navigate to **Settings** → **Integrations**
3. Find the **Telegram** card
4. Click **Connect**
5. When prompted, paste your bot token
6. Click OK

The platform will:
- Validate your bot token
- Set up a webhook to receive messages
- Store the integration securely

#### Step 3: Start Chatting

1. Open Telegram and search for your bot's username (e.g., `@myai_assistant_bot`)
2. Click **Start** or send `/start`
3. Your bot will welcome you and is ready to process messages!

### Available Commands

Once connected, your Telegram bot supports these commands:

- `/start` - Initialize the bot and see welcome message
- `/help` - Display available commands
- `/status` - Check your account status and remaining credits
- `/agents` - List your configured AI agents

### How It Works

**Architecture**:
```
Telegram App → Telegram API → Your Platform Webhook → AI Agent → Response → Telegram API → User
```

**Webhook URL**: `https://your-domain.com/api/integrations/telegram/webhook`

**Security**:
- Webhook requests are validated using a secret token
- Bot tokens are encrypted in the database
- Each user's bot is isolated and only processes their messages

### Troubleshooting

**Problem**: "Invalid bot token format"
- **Solution**: Ensure you copied the complete token from BotFather (should be in format `NUMBER:ALPHANUMERIC`)

**Problem**: Bot doesn't respond to messages
- **Solution**:
  1. Check that webhook is properly set (go to Settings → Integrations and verify Telegram shows "Connected")
  2. Ensure your platform URL is publicly accessible (webhooks require HTTPS)
  3. Check server logs for webhook errors

**Problem**: "Failed to configure webhook"
- **Solution**: Verify that `NEXTAUTH_URL` environment variable is set correctly in your `.env` file

---

## 💬 Slack Integration

### Prerequisites

1. A Slack workspace (free or paid)
2. Admin permissions to install apps in that workspace

### Setup Instructions

#### Step 1: Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App** → **From scratch**
3. Enter an app name (e.g., "AI Assistant")
4. Select the workspace where you want to install it
5. Click **Create App**

#### Step 2: Configure OAuth Scopes

1. In the left sidebar, click **OAuth & Permissions**
2. Scroll to **Bot Token Scopes** and add:
   - `chat:write` - Send messages
   - `channels:read` - View channels
   - `channels:history` - Read channel messages
   - `groups:read` - View private channels
   - `groups:history` - Read private channel messages
   - `im:read` - View direct messages
   - `im:history` - Read direct message history
   - `im:write` - Send direct messages
   - `users:read` - View users
   - `users:read.email` - View user emails
   - `commands` - Add slash commands
   - `app_mentions:read` - Receive mentions

3. Under **User Token Scopes**, add (optional):
   - `chat:write` - Send messages as user

#### Step 3: Configure OAuth Redirect URL

1. Still in **OAuth & Permissions**
2. Under **Redirect URLs**, click **Add New Redirect URL**
3. Enter: `https://your-domain.com/api/integrations/slack/callback`
4. Click **Add**
5. Click **Save URLs**

#### Step 4: Enable Events API

1. In the left sidebar, click **Event Subscriptions**
2. Toggle **Enable Events** to ON
3. In **Request URL**, enter: `https://your-domain.com/api/integrations/slack/events`
4. Slack will verify the URL (you must have deployed your app first)
5. Under **Subscribe to bot events**, add:
   - `app_mention` - When bot is mentioned
   - `message.im` - When bot receives DM

6. Click **Save Changes**

#### Step 5: Get Credentials

1. In the left sidebar, click **Basic Information**
2. Under **App Credentials**, you'll find:
   - **Client ID**
   - **Client Secret**
   - **Signing Secret**

3. Copy these values

#### Step 6: Configure Environment Variables

Add to your `.env` file:

```bash
SLACK_CLIENT_ID=your_client_id_here
SLACK_CLIENT_SECRET=your_client_secret_here
SLACK_SIGNING_SECRET=your_signing_secret_here
```

#### Step 7: Connect Workspace

1. Log into your AI assistant platform
2. Navigate to **Settings** → **Integrations**
3. Find the **Slack** card
4. Click **Connect**
5. You'll be redirected to Slack to authorize the app
6. Select the workspace and click **Allow**
7. You'll be redirected back with a success message

#### Step 8: Test the Integration

1. In Slack, invite your bot to a channel: `/invite @AI Assistant`
2. Mention the bot: `@AI Assistant hello!`
3. Or send it a direct message
4. The bot should respond!

### Available Commands

Once connected, you can interact with your AI assistant in Slack:

- **Mention in channel**: `@AI Assistant [your message]`
- **Direct message**: Just send a DM to the bot
- **Slash commands** (coming soon): `/ai ask [question]`

### How It Works

**Architecture**:
```
Slack App → Events API → Your Platform Webhook → AI Agent → Response → Slack API → Channel/DM
```

**Event Processing**:
1. User mentions bot or sends DM
2. Slack sends event to your webhook
3. Platform validates request signature
4. Message is routed to user's default AI agent
5. Agent processes and generates response
6. Response is sent back to Slack via API

**Security**:
- All webhook requests are verified using Slack's signing secret
- OAuth tokens are encrypted in database
- User isolation ensures agents only access their own data

### Troubleshooting

**Problem**: "URL verification failed"
- **Solution**: Ensure your platform is deployed and publicly accessible at the URL you provided. The endpoint must return the `challenge` parameter during verification.

**Problem**: Bot doesn't respond to mentions
- **Solution**:
  1. Verify the bot is invited to the channel
  2. Check that Event Subscriptions are properly configured
  3. Review server logs for webhook errors
  4. Ensure `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET` are correctly set

**Problem**: "Invalid signing secret"
- **Solution**: Double-check that `SLACK_SIGNING_SECRET` in `.env` matches the signing secret in your Slack app settings

**Problem**: OAuth redirect fails
- **Solution**: Verify the redirect URL in Slack app settings exactly matches your callback URL (including https://)

---

## 🔧 Technical Implementation

### File Structure

```
src/
├── lib/
│   ├── slack-oauth.ts              # Slack OAuth helpers
│   └── telegram-bot.ts             # Telegram Bot API helpers
├── app/api/integrations/
│   ├── slack/
│   │   ├── connect/route.ts        # Slack OAuth initiation
│   │   ├── callback/route.ts       # Slack OAuth callback
│   │   └── events/route.ts         # Slack event webhook
│   └── telegram/
│       ├── connect/route.ts        # Telegram bot registration
│       └── webhook/route.ts        # Telegram message webhook
└── app/settings/integrations/
    └── page.tsx                    # Integrations UI
```

### Database Schema

Both integrations use the `Integration` model:

```prisma
model Integration {
  id            String   @id @default(cuid())
  userId        String
  provider      String   // 'slack' or 'telegram'
  name          String?
  accessToken   String?  @db.Text
  refreshToken  String?  @db.Text
  scopes        String[]
  config        Json?    // Provider-specific data
  isActive      Boolean  @default(true)
  lastSyncAt    DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, provider])
}
```

**Slack config**:
```json
{
  "teamId": "T123456",
  "teamName": "My Workspace",
  "userId": "U123456",
  "botUserId": "B123456",
  "appId": "A123456",
  "url": "https://myworkspace.slack.com"
}
```

**Telegram config**:
```json
{
  "botId": 123456789,
  "botUsername": "myai_assistant_bot",
  "botName": "My AI Assistant",
  "canJoinGroups": true,
  "canReadAllGroupMessages": false,
  "supportsInlineQueries": false,
  "webhookUrl": "https://your-domain.com/api/integrations/telegram/webhook",
  "secretToken": "random_secret_string",
  "webhookSetAt": "2024-01-15T10:30:00Z"
}
```

### API Endpoints

#### Slack

- `GET /api/integrations/slack/connect` - Initiate OAuth flow
- `GET /api/integrations/slack/callback` - Handle OAuth callback
- `POST /api/integrations/slack/events` - Receive Slack events
- `DELETE /api/integrations/slack/connect` - Disconnect integration

#### Telegram

- `POST /api/integrations/telegram/connect` - Register bot token
- `GET /api/integrations/telegram/connect` - Get connection status
- `POST /api/integrations/telegram/webhook` - Receive Telegram updates
- `DELETE /api/integrations/telegram/connect` - Disconnect bot

### Environment Variables Required

```bash
# Slack (required for Slack integration)
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=

# Telegram (no credentials needed - users provide bot tokens)

# Platform URL (required for both webhooks)
NEXTAUTH_URL=https://your-domain.com
```

---

## 🧪 Testing

### Local Development with ngrok

Both integrations require publicly accessible HTTPS endpoints. For local testing:

1. Install ngrok: `npm install -g ngrok`
2. Start your dev server: `npm run dev`
3. In another terminal, start ngrok: `ngrok http 3010`
4. Use the ngrok HTTPS URL (e.g., `https://abc123.ngrok.io`) as your webhook URL
5. Update `NEXTAUTH_URL` in `.env` to the ngrok URL
6. Restart your dev server

### Testing Slack

1. Set up Slack app with ngrok URL
2. Install app to test workspace
3. Mention bot in channel or send DM
4. Check server logs for webhook activity
5. Verify response is sent back to Slack

### Testing Telegram

1. Create bot with @BotFather
2. Connect bot using ngrok URL
3. Send `/start` command
4. Check server logs for webhook activity
5. Send a test message and verify response

---

## 📊 Monitoring

### Logs to Watch

**Slack**:
```
[Slack] App connected for user <userId>
[Slack] App mention from user <slackUserId>: <message>
[Slack] DM from user <slackUserId>: <message>
```

**Telegram**:
```
[Telegram] Bot connected for user <userId>: @<username>
[Telegram] Message from user <telegramUserId> to owner <userId>: <message>
[Telegram] Callback query from user <telegramUserId>: <data>
```

### Error Handling

Both integrations:
- Always return 200 OK to webhooks (prevents retries)
- Log errors to Sentry
- Show user-friendly error messages in messenger
- Gracefully handle missing integrations

---

## 🔮 Future Enhancements

### Planned Features

- [ ] **Agent Selection**: Allow users to specify which agent processes their message
- [ ] **Conversation Threading**: Maintain conversation context across messages
- [ ] **Rich Formatting**: Support markdown, buttons, and interactive elements
- [ ] **File Handling**: Process images and documents sent via messenger
- [ ] **Group Chat Support**: Enable multi-user conversations with shared context
- [ ] **Slash Commands**: Custom commands for common operations
- [ ] **Status Indicators**: Show when agent is processing (typing indicators)
- [ ] **Message Queuing**: Handle high volume with proper queue management
- [ ] **Analytics**: Track message volume, response times, user engagement

### Integration Ideas

- **Microsoft Teams**: Enterprise communication platform
- **Discord**: Gaming and community platform
- **WhatsApp Business**: Customer communication
- **Line**: Popular in Asia
- **WeChat**: China market

---

## 🆘 Support

### Common Issues

1. **Webhook verification fails**
   - Ensure public HTTPS URL
   - Check firewall/security group settings
   - Verify endpoint returns correct response format

2. **Bot doesn't respond**
   - Check integration status in Settings
   - Verify bot has necessary permissions
   - Review server logs for errors
   - Test webhook endpoint manually

3. **Authorization errors**
   - Re-connect the integration
   - Verify credentials in environment variables
   - Check token hasn't expired (Slack tokens don't expire, Telegram tokens are permanent)

### Getting Help

- Check server logs first
- Test webhook endpoint with curl
- Verify environment variables are set
- Review Slack/Telegram API documentation
- Contact support with integration ID and error logs

---

## ✅ Deployment Checklist

Before deploying to production:

- [ ] Set production `NEXTAUTH_URL` in environment
- [ ] Configure Slack app with production webhook URLs
- [ ] Update Slack OAuth redirect URLs
- [ ] Test Slack events endpoint verification
- [ ] Test Telegram webhook setup
- [ ] Verify SSL certificate is valid
- [ ] Enable error logging and monitoring
- [ ] Set up alerts for webhook failures
- [ ] Document bot usernames for users
- [ ] Create onboarding guide for end users
- [ ] Test with real users before general availability

---

## 📝 License

MIT License - See LICENSE file for details.
