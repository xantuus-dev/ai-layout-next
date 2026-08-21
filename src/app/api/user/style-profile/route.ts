/**
 * GET    /api/user/style-profile  — read the learned voice profile
 * PATCH  /api/user/style-profile  — enable or disable voice matching
 * DELETE /api/user/style-profile  — erase the learned profile
 *
 * A feature that learns how someone writes has to be inspectable and
 * switchable by the person it learned from, so all three verbs exist from the
 * start rather than being added after someone asks where their data went.
 * DELETE is a real delete, not a disable — PATCH is what preserves the profile
 * while turning it off.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseStyleTraits, STYLE_MIN_PLAN_TIER } from '@/lib/style/profile';
import { planMeetsMinTier } from '@/lib/plans';

export const runtime = 'nodejs';

async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  return prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, plan: true },
  });
}

export async function GET() {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await prisma.userStyleProfile.findUnique({
      where: { userId: user.id },
      select: {
        enabled: true,
        traits: true,
        sampleCount: true,
        lastBuiltAt: true,
      },
    });

    return NextResponse.json({
      available: planMeetsMinTier(user.plan, STYLE_MIN_PLAN_TIER),
      minimumPlan: STYLE_MIN_PLAN_TIER,
      profile: profile
        ? {
            enabled: profile.enabled,
            traits: parseStyleTraits(JSON.stringify(profile.traits)),
            sampleCount: profile.sampleCount,
            lastBuiltAt: profile.lastBuiltAt,
          }
        : null,
    });
  } catch (error) {
    console.error('Style profile read error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
    }

    // Upsert rather than update: a user can switch voice matching off before a
    // profile has ever been built, and that preference has to stick — otherwise
    // the next rebuild would happen against their stated wishes.
    const profile = await prisma.userStyleProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, enabled, traits: {} },
      update: { enabled },
      select: { enabled: true },
    });

    return NextResponse.json({ success: true, enabled: profile.enabled });
  } catch (error) {
    console.error('Style profile update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.userStyleProfile.deleteMany({ where: { userId: user.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Style profile delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
