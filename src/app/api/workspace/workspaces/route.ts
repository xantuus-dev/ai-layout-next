import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserWorkspaces } from '@/lib/workspace-utils';

// GET /api/workspace/workspaces - List all user workspaces
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

    // Get all workspaces with conversation and project counts
    const workspaces = await getUserWorkspaces(user.id);

    return NextResponse.json({
      success: true,
      workspaces,
    });
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workspaces' },
      { status: 500 }
    );
  }
}

// POST /api/workspace/workspaces - Create new workspace
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
    const { name, description, icon, color } = body;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Workspace name is required' },
        { status: 400 }
      );
    }

    // Get current workspace count for ordering
    const workspaceCount = await prisma.workspace.count({
      where: { userId: user.id },
    });

    // Create workspace
    const workspace = await prisma.workspace.create({
      data: {
        userId: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        icon: icon || '📁',
        color: color || '#6366f1',
        order: workspaceCount, // Add to end
        isDefault: workspaceCount === 0, // First workspace is default
      },
      include: {
        _count: {
          select: {
            conversations: true,
            projects: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      workspace,
    });
  } catch (error) {
    console.error('Error creating workspace:', error);
    return NextResponse.json(
      { error: 'Failed to create workspace' },
      { status: 500 }
    );
  }
}
