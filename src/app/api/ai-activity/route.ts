/**
 * GET /api/ai-activity
 *
 * Returns the authenticated user's recent AI interaction log — the metadata
 * trail behind every model call (surface, model, provider, token/credit usage,
 * how much PII was redacted, ZDR posture). Content is never returned, only
 * hashes are stored, so this is safe to render in a user-facing activity view.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const limitParam = Number(request.nextUrl.searchParams.get('limit'));
  const take = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 50;

  const logs = await prisma.aiInteractionLog.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      surface: true,
      provider: true,
      model: true,
      inputTokens: true,
      outputTokens: true,
      creditsUsed: true,
      redactionCount: true,
      redactionTypes: true,
      zdr: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ activity: logs });
}
