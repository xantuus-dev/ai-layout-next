import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasSeatAvailable } from '@/lib/organization';

// POST /api/workspace/team/invites/[token]/accept - Accept a pending team
// invite. The signed-in user's email must match the invite's email.
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invite = await prisma.workspaceInvite.findUnique({
      where: { token: params.token },
      include: { workspace: { select: { id: true, userId: true } } },
    });

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }
    if (invite.status !== 'pending') {
      return NextResponse.json({ error: 'This invite is no longer valid' }, { status: 400 });
    }
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: 'This invite has expired' }, { status: 400 });
    }
    if (invite.email.toLowerCase() !== session.user.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'This invite was sent to a different email address' },
        { status: 403 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (invite.workspace.userId === user.id) {
      return NextResponse.json({ error: 'You cannot join your own team' }, { status: 400 });
    }

    if (user.billingOwnerId && user.billingOwnerId !== invite.workspace.userId) {
      return NextResponse.json(
        { error: 'You are already on another team. Leave it before accepting a new invite.' },
        { status: 409 }
      );
    }

    // Enforce the purchased seat count. Re-accepting an invite you have already
    // accepted must not be blocked, since that consumes no additional seat.
    // Teams predating the Organization model have no seat cap and are admitted
    // (see canAdmitMember) rather than being locked out retroactively.
    const alreadyOnTeam = user.billingOwnerId === invite.workspace.userId;
    if (!alreadyOnTeam && !(await hasSeatAvailable(invite.workspace.userId))) {
      return NextResponse.json(
        {
          error:
            'This team has no seats left. Ask the team owner to add a seat before accepting.',
        },
        { status: 409 }
      );
    }

    await prisma.$transaction([
      prisma.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId: invite.workspace.id, userId: user.id } },
        create: {
          workspaceId: invite.workspace.id,
          userId: user.id,
          role: invite.role,
          invitedBy: invite.invitedBy,
          joinedAt: new Date(),
        },
        update: {
          role: invite.role,
          joinedAt: new Date(),
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { billingOwnerId: invite.workspace.userId },
      }),
      prisma.workspaceInvite.update({
        where: { token: params.token },
        data: { status: 'accepted' },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error accepting invite:', error);
    return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 });
  }
}
