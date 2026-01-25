import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/workspace/conversations - List conversations with filters
export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const archived = searchParams.get('archived') === 'true';
    const folder = searchParams.get('folder');
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sortBy') || 'lastMessageAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build where clause
    const where: any = {
      userId: user.id,
      isArchived: archived,
    };

    if (workspaceId) {
      where.workspaceId = workspaceId;
    }

    if (folder) {
      where.folder = folder;
    }

    if (tags && tags.length > 0) {
      where.tags = {
        hasEvery: tags,
      };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Build orderBy
    const orderBy: any = {};
    if (sortBy === 'lastMessageAt') {
      orderBy.lastMessageAt = sortOrder;
    } else if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder;
    } else if (sortBy === 'title') {
      orderBy.title = sortOrder;
    }

    // Fetch conversations
    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        orderBy: [
          { isPinned: 'desc' }, // Pinned conversations first
          orderBy,
        ],
        take: limit,
        skip: offset,
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
              icon: true,
              color: true,
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      conversations,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

// POST /api/workspace/conversations - Create new conversation
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { workspaceId, title, model } = body;

    // Validate workspace if provided
    if (workspaceId) {
      const workspace = await prisma.workspace.findFirst({
        where: {
          id: workspaceId,
          userId: user.id,
        },
      });

      if (!workspace) {
        return NextResponse.json(
          { error: 'Workspace not found or access denied' },
          { status: 404 }
        );
      }
    }

    // Create conversation
    const conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        workspaceId: workspaceId || null,
        title: title || 'Untitled Conversation',
        model: model || null,
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
