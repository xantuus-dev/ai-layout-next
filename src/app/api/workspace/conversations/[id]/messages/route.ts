import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyConversationAccess } from '@/lib/workspace-utils';

// GET /api/workspace/conversations/[id]/messages - List messages in conversation
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

    // Parse pagination parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Fetch messages
    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: limit,
        skip: offset,
        include: {
          attachments: true,
        },
      }),
      prisma.message.count({ where: { conversationId } }),
    ]);

    return NextResponse.json({
      success: true,
      messages,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// POST /api/workspace/conversations/[id]/messages - Create new message
export async function POST(
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

    const body = await request.json();
    const { role, content, model, tokens, credits, thinkingEnabled, attachments } = body;

    // Validate required fields
    if (!role || !content) {
      return NextResponse.json(
        { error: 'Role and content are required' },
        { status: 400 }
      );
    }

    if (!['user', 'assistant', 'system'].includes(role)) {
      return NextResponse.json(
        { error: 'Role must be user, assistant, or system' },
        { status: 400 }
      );
    }

    // Create message with attachments in a transaction
    const message = await prisma.$transaction(async (tx) => {
      // Create message
      const newMessage = await tx.message.create({
        data: {
          conversationId,
          role,
          content,
          model,
          tokens,
          credits,
          thinkingEnabled: thinkingEnabled || false,
        },
      });

      // Create attachments if provided
      if (attachments && attachments.length > 0) {
        await tx.messageAttachment.createMany({
          data: attachments.map((att: any) => ({
            messageId: newMessage.id,
            fileName: att.fileName,
            fileType: att.fileType,
            fileSize: att.fileSize,
            fileUrl: att.fileUrl || null,
            fileData: att.fileData || null,
            width: att.width || null,
            height: att.height || null,
            thumbnail: att.thumbnail || null,
          })),
        });
      }

      // Update conversation metadata
      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          messageCount: { increment: 1 },
          lastMessageAt: new Date(),
        },
      });

      // Fetch message with attachments
      return tx.message.findUnique({
        where: { id: newMessage.id },
        include: { attachments: true },
      });
    });

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json(
      { error: 'Failed to create message' },
      { status: 500 }
    );
  }
}
