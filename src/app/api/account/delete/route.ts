/**
 * POST /api/account/delete
 *
 * GDPR right-to-erasure (Art. 17): permanently deletes the authenticated user
 * and all data that cascades from the User row (conversations, messages, usage,
 * API keys, integrations, AI-activity log, …). Best-effort revokes the Google
 * OAuth grant first so the token cannot outlive the account.
 *
 * Requires an explicit `{ confirm: "DELETE" }` body so it cannot be triggered
 * by an accidental or forged navigation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revokeToken } from '@/lib/google-oauth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (body?.confirm !== 'DELETE') {
    return NextResponse.json(
      { error: 'Confirmation required: send { "confirm": "DELETE" }.' },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, googleAccessToken: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Revoke the Google grant so the access token dies with the account. Never
  // let a revocation failure block the erasure itself.
  if (user.googleAccessToken) {
    try {
      await revokeToken(user.googleAccessToken);
    } catch (error) {
      console.error('[account/delete] Google token revocation failed:', error);
    }
  }

  // Relations declared onDelete: Cascade are removed with the user row.
  await prisma.user.delete({ where: { id: user.id } });

  return NextResponse.json({ success: true });
}
