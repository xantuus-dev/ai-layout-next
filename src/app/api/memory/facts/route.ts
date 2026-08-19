/**
 * GET    /api/memory/facts            List the authenticated user's stored memory facts.
 * DELETE /api/memory/facts?id=<id>    Delete one fact.
 * DELETE /api/memory/facts?all=true   Delete every fact stored for this user.
 *
 * Lets a user see and control what src/lib/memory/facts.ts has extracted
 * about them — required for this to be a trustworthy (and compliant) feature
 * to sell, not just a technical capability.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const facts = await prisma.memoryFact.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      factType: true,
      content: true,
      importanceScore: true,
      createdAt: true,
      lastAccessed: true,
    },
    orderBy: { importanceScore: 'desc' },
  });

  return NextResponse.json({ facts });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const factId = searchParams.get('id');
  const clearAll = searchParams.get('all') === 'true';

  if (clearAll) {
    const { count } = await prisma.memoryFact.deleteMany({ where: { userId: user.id } });
    return NextResponse.json({ success: true, deleted: count });
  }

  if (!factId) {
    return NextResponse.json({ error: 'id or all=true is required' }, { status: 400 });
  }

  // deleteMany (not delete) so a fact belonging to another user 404s silently
  // via zero rows affected, rather than a findUnique + ownership branch.
  await prisma.memoryFact.deleteMany({ where: { id: factId, userId: user.id } });
  return NextResponse.json({ success: true });
}
