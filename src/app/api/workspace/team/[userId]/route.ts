import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveTeamContext } from '@/lib/workspace-utils';

// DELETE /api/workspace/team/[userId] - Remove a member from the caller's team.
// Only the team owner or an admin member can remove members.
export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const caller = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!caller) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const context = await resolveTeamContext(caller.id);
    if (!context.canManageMembers) {
      return NextResponse.json({ error: 'You do not have permission to remove team members.' }, { status: 403 });
    }

    const workspace = context.workspace;
    const memberUserId = params.userId;

    if (memberUserId === context.ownerId) {
      return NextResponse.json({ error: 'The team owner cannot be removed.' }, { status: 400 });
    }

    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: memberUserId } },
    });

    if (!member) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.workspaceMember.delete({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId: memberUserId } },
      }),
      // Only clear billingOwnerId if it still points at this team's owner —
      // avoids clobbering state if the member was somehow already reassigned.
      prisma.user.updateMany({
        where: { id: memberUserId, billingOwnerId: context.ownerId },
        data: { billingOwnerId: null },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing team member:', error);
    return NextResponse.json({ error: 'Failed to remove team member' }, { status: 500 });
  }
}
