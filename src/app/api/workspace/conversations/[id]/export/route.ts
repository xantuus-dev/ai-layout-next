import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyConversationAccess } from '@/lib/workspace-utils';

// GET /api/workspace/conversations/[id]/export - Export conversation
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const conversationId = params.id;

    // Verify access
    const hasAccess = await verifyConversationAccess(conversationId, user.id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Conversation not found or access denied' },
        { status: 404 }
      );
    }

    // Get format parameter (default: markdown)
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'markdown';

    // Fetch conversation with all messages
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            attachments: true,
          },
        },
        workspace: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    let content: string = '';
    let contentType: string;
    let filename: string;

    // Generate export based on format
    let contentBuffer: Buffer | undefined;

    switch (format) {
      case 'pdf':
        const { generatePDF } = await import('@/lib/pdf-generator');
        contentBuffer = await generatePDF(conversation);
        contentType = 'application/pdf';
        filename = `conversation-${conversation.id}.pdf`;
        break;

      case 'docx':
        const { generateDOCX } = await import('@/lib/docx-generator');
        contentBuffer = await generateDOCX(conversation);
        contentType =
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        filename = `conversation-${conversation.id}.docx`;
        break;

      case 'json':
        content = JSON.stringify(conversation, null, 2);
        contentType = 'application/json';
        filename = `conversation-${conversation.id}.json`;
        break;

      case 'txt':
        content = generatePlainTextExport(conversation);
        contentType = 'text/plain';
        filename = `conversation-${conversation.id}.txt`;
        break;

      case 'markdown':
      default:
        content = generateMarkdownExport(conversation);
        contentType = 'text/markdown';
        filename = `conversation-${conversation.id}.md`;
        break;
    }

    // Return file for download
    const responseContent = contentBuffer ? contentBuffer : Buffer.from(content || '', 'utf-8');
    const contentLength = responseContent.length;

    return new NextResponse(responseContent as any, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': contentLength.toString(),
      },
    });
  } catch (error) {
    console.error('Error exporting conversation:', error);
    return NextResponse.json(
      { error: 'Failed to export conversation' },
      { status: 500 }
    );
  }
}

// Helper function to generate Markdown export
function generateMarkdownExport(conversation: any): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${conversation.title}`);
  lines.push('');

  if (conversation.summary) {
    lines.push(`> ${conversation.summary}`);
    lines.push('');
  }

  // Metadata
  lines.push('## Conversation Details');
  lines.push('');
  lines.push(`- **Created:** ${new Date(conversation.createdAt).toLocaleString()}`);
  lines.push(`- **Last Updated:** ${new Date(conversation.updatedAt).toLocaleString()}`);
  if (conversation.workspace) {
    lines.push(`- **Workspace:** ${conversation.workspace.name}`);
  }
  if (conversation.model) {
    lines.push(`- **Model:** ${conversation.model}`);
  }
  if (conversation.tags && conversation.tags.length > 0) {
    lines.push(`- **Tags:** ${conversation.tags.join(', ')}`);
  }
  lines.push(`- **Messages:** ${conversation.messageCount}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Messages
  lines.push('## Messages');
  lines.push('');

  for (const message of conversation.messages) {
    const role = message.role.charAt(0).toUpperCase() + message.role.slice(1);
    const timestamp = new Date(message.createdAt).toLocaleString();

    lines.push(`### ${role} - ${timestamp}`);
    lines.push('');

    // Attachments
    if (message.attachments && message.attachments.length > 0) {
      lines.push('**Attachments:**');
      for (const attachment of message.attachments) {
        lines.push(`- ${attachment.fileName} (${formatFileSize(attachment.fileSize)})`);
      }
      lines.push('');
    }

    // Content
    lines.push(message.content);
    lines.push('');

    // Metadata
    if (message.model || message.tokens || message.credits) {
      lines.push('<details>');
      lines.push('<summary>Message Metadata</summary>');
      lines.push('');
      if (message.model) lines.push(`- Model: ${message.model}`);
      if (message.tokens) lines.push(`- Tokens: ${message.tokens}`);
      if (message.credits) lines.push(`- Credits: ${message.credits}`);
      if (message.thinkingEnabled) lines.push(`- Thinking: Enabled`);
      lines.push('</details>');
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  // Footer
  lines.push('');
  lines.push(`*Exported from Xantuus AI on ${new Date().toLocaleString()}*`);

  return lines.join('\n');
}

// Helper function to generate plain text export
function generatePlainTextExport(conversation: any): string {
  const lines: string[] = [];

  // Header
  lines.push(conversation.title);
  lines.push('='.repeat(conversation.title.length));
  lines.push('');

  if (conversation.summary) {
    lines.push(conversation.summary);
    lines.push('');
  }

  // Metadata
  lines.push('Conversation Details:');
  lines.push(`Created: ${new Date(conversation.createdAt).toLocaleString()}`);
  lines.push(`Last Updated: ${new Date(conversation.updatedAt).toLocaleString()}`);
  if (conversation.workspace) {
    lines.push(`Workspace: ${conversation.workspace.name}`);
  }
  if (conversation.model) {
    lines.push(`Model: ${conversation.model}`);
  }
  if (conversation.tags && conversation.tags.length > 0) {
    lines.push(`Tags: ${conversation.tags.join(', ')}`);
  }
  lines.push(`Messages: ${conversation.messageCount}`);
  lines.push('');
  lines.push('-'.repeat(80));
  lines.push('');

  // Messages
  for (const message of conversation.messages) {
    const role = message.role.toUpperCase();
    const timestamp = new Date(message.createdAt).toLocaleString();

    lines.push(`[${role}] ${timestamp}`);

    if (message.attachments && message.attachments.length > 0) {
      lines.push('Attachments:');
      for (const attachment of message.attachments) {
        lines.push(`  - ${attachment.fileName} (${formatFileSize(attachment.fileSize)})`);
      }
    }

    lines.push('');
    lines.push(message.content);
    lines.push('');
    lines.push('-'.repeat(80));
    lines.push('');
  }

  // Footer
  lines.push('');
  lines.push(`Exported from Xantuus AI on ${new Date().toLocaleString()}`);

  return lines.join('\n');
}

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
