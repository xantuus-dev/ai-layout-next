import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Helper function to generate a unique referral code
async function generateReferralCode(): Promise<string> {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  let isUnique = false;

  while (!isUnique) {
    code = '';
    for (let i = 0; i < 8; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    const existing = await prisma.user.findUnique({
      where: { referralCode: code },
    });

    if (!existing) {
      isUnique = true;
    }
  }

  return code;
}

// GET /api/workspace/referrals - Get user's referral information
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        referredUsers: {
          include: {
            referred: {
              select: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate referral code if user doesn't have one
    let referralCode = user.referralCode;
    if (!referralCode) {
      referralCode = await generateReferralCode();
      await prisma.user.update({
        where: { id: user.id },
        data: { referralCode },
      });
    }

    const totalReferrals = user.referredUsers.length;
    const completedReferrals = user.referredUsers.filter(
      (ref) => ref.status === 'completed'
    ).length;
    const creditsEarned = completedReferrals * 500;

    return NextResponse.json({
      referralCode,
      totalReferrals,
      completedReferrals,
      creditsEarned,
      referrals: user.referredUsers,
      referralLink: `${process.env.NEXTAUTH_URL}/signup?ref=${referralCode}`,
    });
  } catch (error) {
    console.error('Error fetching referral data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch referral data' },
      { status: 500 }
    );
  }
}

// POST /api/workspace/referrals/apply - Apply a referral code (called during signup)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user already has a referral
    if (user.referredBy) {
      return NextResponse.json(
        { error: 'Referral code already applied' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { referralCode } = body;

    if (!referralCode) {
      return NextResponse.json(
        { error: 'Referral code is required' },
        { status: 400 }
      );
    }

    // Find the referrer
    const referrer = await prisma.user.findUnique({
      where: { referralCode },
    });

    if (!referrer) {
      return NextResponse.json(
        { error: 'Invalid referral code' },
        { status: 400 }
      );
    }

    if (referrer.id === user.id) {
      return NextResponse.json(
        { error: 'Cannot use your own referral code' },
        { status: 400 }
      );
    }

    // Create referral record and award credits.
    //
    // Banked as a decrement of creditsUsed (which is allowed to go negative)
    // rather than an increment of monthlyCredits, matching how one-time
    // credit-pack purchases are granted in stripe-webhook-handlers.ts.
    // monthlyCredits is the recurring allowance, so incrementing it turns a
    // one-time award into a permanent plan upgrade — and on the free tier,
    // whose allowance now refreshes DAILY, +500 would have meant +500 every
    // day forever per referral. checkAndResetCredits preserves negative
    // balances across resets, so the award survives until it is spent.
    await prisma.$transaction([
      // Update referred user
      prisma.user.update({
        where: { id: user.id },
        data: {
          referredBy: referralCode,
          creditsUsed: { decrement: 500 },
        },
      }),
      // Update referrer
      prisma.user.update({
        where: { id: referrer.id },
        data: {
          creditsUsed: { decrement: 500 },
        },
      }),
      // Create referral record
      prisma.referral.create({
        data: {
          referrerId: referrer.id,
          referredId: user.id,
          creditsAwarded: 500,
          status: 'completed',
          completedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: '500 credits awarded to you and your referrer!',
    });
  } catch (error) {
    console.error('Error applying referral code:', error);
    return NextResponse.json(
      { error: 'Failed to apply referral code' },
      { status: 500 }
    );
  }
}
