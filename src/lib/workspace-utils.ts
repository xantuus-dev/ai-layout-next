import { prisma } from '@/lib/prisma';

/**
 * Get or create a default workspace for a user
 * This ensures every user has at least one workspace
 */
export async function getOrCreateDefaultWorkspace(userId: string) {
  // Try to find existing default workspace
  let workspace = await prisma.workspace.findFirst({
    where: {
      userId,
      isDefault: true,
    },
  });

  // If no default workspace exists, create one
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        userId,
        name: 'Personal',
        isDefault: true,
        icon: '🏠',
        color: '#3b82f6',
        order: 0,
      },
    });
  }

  return workspace;
}

/**
 * Get all workspaces for a user with conversation counts
 */
export async function getUserWorkspaces(userId: string) {
  const workspaces = await prisma.workspace.findMany({
    where: {
      userId,
    },
    include: {
      _count: {
        select: {
          conversations: true,
          projects: true,
        },
      },
    },
    orderBy: [{ isDefault: 'desc' }, { order: 'asc' }, { createdAt: 'asc' }],
  });

  return workspaces;
}

/**
 * Verify that a user has access to a workspace
 */
export async function verifyWorkspaceAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      userId,
    },
  });

  return workspace !== null;
}

/**
 * Verify that a user has access to a conversation
 */
export async function verifyConversationAccess(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      userId,
    },
  });

  return conversation !== null;
}

/**
 * Generate a conversation title from the first user message
 * Truncates to 50 characters max
 */
export function generateConversationTitle(firstMessage: string): string {
  // Remove extra whitespace and newlines
  const cleaned = firstMessage.trim().replace(/\s+/g, ' ');

  // Truncate to 50 characters
  if (cleaned.length <= 50) {
    return cleaned;
  }

  // Find last space before 50 chars to avoid cutting words
  const truncated = cleaned.substring(0, 50);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > 30) {
    return truncated.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
}
