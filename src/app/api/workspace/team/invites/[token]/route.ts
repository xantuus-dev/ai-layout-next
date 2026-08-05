import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveTeamContext } from '@/lib/workspace-utils';

// DELETE /api/workspace/team/invites/[token] - Revoke a pending invite.
// Only the team owner or an admin member can revoke.
export async function DELETE(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const context = await resolveTeamContext(user.id);
    if (!context.canManageMembers) {
      return NextResponse.json({ error: 'You do not have permission to manage invites.' }, { status: 403 });
    }

    const invite = await prisma.workspaceInvite.findUnique({ where: { token: params.token } });
    if (!invite || invite.workspaceId !== context.workspace.id) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    await prisma.workspaceInvite.update({
      where: { token: params.token },
      data: { status: 'revoked' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking invite:', error);
    return NextResponse.json({ error: 'Failed to revoke invite' }, { status: 500 });
  }
}
