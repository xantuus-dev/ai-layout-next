/**
 * GET / PUT /api/account/retention
 *
 * Read or set the authenticated user's data-retention window
 * (User.dataRetentionDays). null = keep indefinitely. A positive integer opts
 * into automatic deletion of conversations older than that many days, enforced
 * by /api/cron/data-retention.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function requireUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dataRetentionDays: true },
  });
  return NextResponse.json({ dataRetentionDays: user?.dataRetentionDays ?? null });
}

export async function PUT(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const raw = body?.dataRetentionDays;

  // null (or 0) clears the window. Otherwise require a sane positive integer,
  // capped so a typo can't set a multi-century window.
  let value: number | null;
  if (raw === null || raw === 0) {
    value = null;
  } else if (Number.isInteger(raw) && raw >= 1 && raw <= 3650) {
    value = raw;
  } else {
    return NextResponse.json(
      { error: 'dataRetentionDays must be null or an integer between 1 and 3650.' },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { dataRetentionDays: value },
  });

  return NextResponse.json({ dataRetentionDays: value });
}
