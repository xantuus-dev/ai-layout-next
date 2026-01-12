import { google, gmail_v1 } from 'googleapis';
import { getAuthenticatedClient } from './google-oauth';

export interface EmailMessage {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
}

export interface SentEmail {
  id: string;
  threadId: string;
  labelIds?: string[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
  labelIds?: string[];
}

export class GoogleGmailClient {
  private gmail: gmail_v1.Gmail | null = null;

  constructor(
    private accessToken: string,
    private refreshToken: string | null,
    private expiryDate: Date | null
  ) {}

  /**
   * Initialize the Gmail API client
   */
  private async init() {
    if (!this.gmail) {
      const auth = await getAuthenticatedClient(
        this.accessToken,
        this.refreshToken,
        this.expiryDate
      );
      this.gmail = google.gmail({ version: 'v1', auth });
    }
    return this.gmail;
  }

  /**
   * Create email MIME message
   */
  private createMimeMessage(email: EmailMessage): string {
    const boundary = '----=_Part_' + Math.random().toString(36).substring(7);
    const toAddresses = Array.isArray(email.to) ? email.to.join(', ') : email.to;
    const ccAddresses = email.cc ? (Array.isArray(email.cc) ? email.cc.join(', ') : email.cc) : '';
    const bccAddresses = email.bcc ? (Array.isArray(email.bcc) ? email.bcc.join(', ') : email.bcc) : '';

    let message = [
      'MIME-Version: 1.0',
      `To: ${toAddresses}`,
      ...(ccAddresses ? [`Cc: ${ccAddresses}`] : []),
      ...(bccAddresses ? [`Bcc: ${bccAddresses}`] : []),
      `Subject: ${email.subject}`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      `Content-Type: ${email.isHtml ? 'text/html' : 'text/plain'}; charset=UTF-8`,
      'Content-Transfer-Encoding: 7bit',
      '',
      email.body,
    ].join('\r\n');

    // Add attachments if present
    if (email.attachments && email.attachments.length > 0) {
      for (const attachment of email.attachments) {
        const contentBase64 = Buffer.isBuffer(attachment.content)
          ? attachment.content.toString('base64')
          : Buffer.from(attachment.content).toString('base64');

        message += [
          '',
          `--${boundary}`,
          `Content-Type: ${attachment.contentType}`,
          `Content-Disposition: attachment; filename="${attachment.filename}"`,
          'Content-Transfer-Encoding: base64',
          '',
          contentBase64,
        ].join('\r\n');
      }
    }

    message += `\r\n--${boundary}--`;

    return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Send an email
   */
  async sendEmail(email: EmailMessage): Promise<SentEmail> {
    const gmail = await this.init();

    const raw = this.createMimeMessage(email);

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw,
      },
    });

    return {
      id: response.data.id!,
      threadId: response.data.threadId!,
      labelIds: response.data.labelIds ?? undefined,
    };
  }

  /**
   * Send an email (scheduled)
   * Note: Gmail API doesn't support native scheduling, this would need to be implemented
   * with a queue system or external scheduler
   */
  async scheduleEmail(email: EmailMessage, sendAt: Date): Promise<{ scheduleId: string; sendAt: Date }> {
    // This is a placeholder - actual implementation would require a queue system
    // For now, we'll just send immediately if the time is in the past
    const now = new Date();
    if (sendAt <= now) {
      const sent = await this.sendEmail(email);
      return {
        scheduleId: sent.id,
        sendAt: now,
      };
    }

    // In production, you'd store this in a database and use a cron job or queue
    throw new Error('Email scheduling requires a queue system. Use an external scheduler like node-cron or a message queue.');
  }

  /**
   * List messages
   */
  async listMessages(options?: {
    maxResults?: number;
    query?: string;
    labelIds?: string[];
  }): Promise<GmailMessage[]> {
    const gmail = await this.init();

    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: options?.maxResults || 20,
      q: options?.query,
      labelIds: options?.labelIds,
    });

    const messages: GmailMessage[] = [];

    if (response.data.messages) {
      for (const msg of response.data.messages) {
        if (msg.id) {
          const fullMessage = await this.getMessage(msg.id);
          messages.push(fullMessage);
        }
      }
    }

    return messages;
  }

  /**
   * Get a specific message
   */
  async getMessage(messageId: string): Promise<GmailMessage> {
    const gmail = await this.init();

    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const headers = response.data.payload?.headers || [];
    const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    return {
      id: response.data.id!,
      threadId: response.data.threadId!,
      from: getHeader('from'),
      to: getHeader('to'),
      subject: getHeader('subject'),
      snippet: response.data.snippet || '',
      date: getHeader('date'),
      labelIds: response.data.labelIds ?? undefined,
    };
  }

  /**
   * Create a draft
   */
  async createDraft(email: EmailMessage): Promise<{ id: string; message: SentEmail }> {
    const gmail = await this.init();

    const raw = this.createMimeMessage(email);

    const response = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw,
        },
      },
    });

    return {
      id: response.data.id!,
      message: {
        id: response.data.message?.id!,
        threadId: response.data.message?.threadId!,
        labelIds: response.data.message?.labelIds ?? undefined,
      },
    };
  }

  /**
   * Get user's email address
   */
  async getUserEmail(): Promise<string> {
    const gmail = await this.init();

    const response = await gmail.users.getProfile({
      userId: 'me',
    });

    return response.data.emailAddress!;
  }
}
