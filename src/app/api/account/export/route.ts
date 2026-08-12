/**
 * GET /api/account/export
 *
 * GDPR right-to-access (Art. 15): returns a machine-readable JSON export of the
 * authenticated user's own data — profile, conversations + messages, usage,
 * and AI-activity metadata. Credential secrets (OAuth tokens, API-key hashes,
 * integration credentials) are deliberately excluded; the export contains the
 * user's content, not the platform's secrets.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      plan: true,
      nickname: true,
      occupation: true,
      bio: true,
      customInstructions: true,
      dataRetentionDays: true,
      createdAt: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const [conversations, usage, activity, apiKeys, integrations] = await Promise.all([
    prisma.conversation.findMany({
      where: { userId: user.id },
      include: {
        messages: {
          select: { role: true, content: true, model: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.usageRecord.findMany({
      where: { userId: user.id },
      select: { type: true, model: true, tokens: true, credits: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.aiInteractionLog.findMany({
      where: { userId: user.id },
      select: {
        surface: true, provider: true, model: true,
        inputTokens: true, outputTokens: true, creditsUsed: true,
        redactionCount: true, zdr: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    // Metadata only — never the key or its hash.
    prisma.apiKey.findMany({
      where: { userId: user.id },
      select: { name: true, keyPrefix: true, lastUsed: true, createdAt: true },
    }),
    // Metadata only — never accessToken/refreshToken/apiKey.
    prisma.integration.findMany({
      where: { userId: user.id },
      select: { provider: true, isActive: true, createdAt: true },
    }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    profile: user,
    conversations,
    usage,
    aiActivity: activity,
    apiKeys,
    integrations,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="xantuus-export-${user.id}.json"`,
    },
  });
}
