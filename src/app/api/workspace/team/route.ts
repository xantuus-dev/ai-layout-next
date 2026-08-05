import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveTeamContext } from '@/lib/workspace-utils';
import { sendTeamInviteEmail } from '@/lib/email';

const VALID_ROLES = ['admin', 'member', 'viewer'];
const INVITE_EXPIRY_DAYS = 7;

// GET /api/workspace/team - Get the current user's team status:
// members/pending invites if they own or admin a team, or the team(s)
// they belong to / have been invited to otherwise.
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        billingOwner: { select: { id: true, name: true, email: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Invites addressed to this email that haven't been resolved yet,
    // regardless of whether the user is already on a team or owns one.
    const incomingInvites = await prisma.workspaceInvite.findMany({
      where: { email: user.email!, status: 'pending', expiresAt: { gt: new Date() } },
      include: { workspace: { select: { userId: true } } },
    });
    const inviterIds = incomingInvites.map((i) => i.invitedBy);
    const inviters = inviterIds.length
      ? await prisma.user.findMany({ where: { id: { in: inviterIds } }, select: { id: true, name: true, email: true } })
      : [];
    const inviterById = new Map(inviters.map((u) => [u.id, u]));

    const incoming = incomingInvites.map((invite) => ({
      token: invite.token,
      role: invite.role,
      inviter: inviterById.get(invite.invitedBy) || null,
      expiresAt: invite.expiresAt,
    }));

    if (user.billingOwner) {
      return NextResponse.json({
        success: true,
        role: 'member',
        owner: user.billingOwner,
        incomingInvites: incoming,
      });
    }

    const context = await resolveTeamContext(user.id);

    const [members, pendingInvites] = await Promise.all([
      prisma.workspaceMember.findMany({
        where: { workspaceId: context.workspace.id },
        orderBy: { invitedAt: 'asc' },
      }),
      prisma.workspaceInvite.findMany({
        where: { workspaceId: context.workspace.id, status: 'pending' },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const memberUsers = await prisma.user.findMany({
      where: { id: { in: members.map((m) => m.userId) } },
      select: { id: true, name: true, email: true },
    });
    const memberUserById = new Map(memberUsers.map((u) => [u.id, u]));

    return NextResponse.json({
      success: true,
      role: context.role,
      workspaceId: context.workspace.id,
      plan: user.plan,
      monthlyCredits: user.monthlyCredits,
      creditsUsed: user.creditsUsed,
      canManageMembers: context.canManageMembers,
      incomingInvites: incoming,
      members: members.map((m) => ({
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        name: memberUserById.get(m.userId)?.name || null,
        email: memberUserById.get(m.userId)?.email || null,
      })),
      pendingInvites: pendingInvites.map((invite) => ({
        token: invite.token,
        email: invite.email,
        role: invite.role,
        createdAt: invite.createdAt,
        expiresAt: invite.expiresAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching team:', error);
    return NextResponse.json({ error: 'Failed to fetch team' }, { status: 500 });
  }
}

// POST /api/workspace/team - Invite someone (by email) to share this team's
// credit pool. Works whether or not they have an account yet; sends an
// email with an accept link when Resend is configured, otherwise the
// accept link is returned directly so the owner can share it manually.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const inviter = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!inviter) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const context = await resolveTeamContext(inviter.id);
    if (!context.canManageMembers) {
      return NextResponse.json(
        { error: 'You do not have permission to invite members to this team.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const email = (body.email || '').trim().toLowerCase();
    const role = VALID_ROLES.includes(body.role) ? body.role : 'member';

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (email === session.user.email.toLowerCase()) {
      return NextResponse.json({ error: 'You cannot invite yourself' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      if (existingUser.billingOwnerId && existingUser.billingOwnerId !== context.ownerId) {
        return NextResponse.json({ error: 'This person is already on another team.' }, { status: 409 });
      }
      const alreadyMember = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: context.workspace.id, userId: existingUser.id } },
      });
      if (alreadyMember) {
        return NextResponse.json({ error: 'This person is already on your team.' }, { status: 409 });
      }
    }

    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const invite = await prisma.workspaceInvite.upsert({
      where: { workspaceId_email: { workspaceId: context.workspace.id, email } },
      create: {
        workspaceId: context.workspace.id,
        email,
        role,
        invitedBy: inviter.id,
        status: 'pending',
        expiresAt,
      },
      update: {
        role,
        invitedBy: inviter.id,
        status: 'pending',
        expiresAt,
      },
    });

    const acceptUrl = `${process.env.NEXTAUTH_URL}/settings/team?invite=${invite.token}`;
    const { sent } = await sendTeamInviteEmail({
      to: email,
      inviterName: inviter.name || inviter.email || 'A teammate',
      acceptUrl,
    });

    return NextResponse.json({
      success: true,
      emailSent: sent,
      invite: {
        token: invite.token,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
      },
      // Included so the owner can share it manually when email isn't configured
      acceptUrl: sent ? undefined : acceptUrl,
    });
  } catch (error) {
    console.error('Error inviting team member:', error);
    return NextResponse.json({ error: 'Failed to invite team member' }, { status: 500 });
  }
}
