import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCreditStatus } from '@/lib/credits';
import { startOfMonth, endOfMonth, subDays } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user data
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Resolves to the team billing owner's pool if this user is a team member
    const creditStatus = await getCreditStatus(user.id);
    if (!creditStatus) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get usage history for the current month
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());

    const usageHistory = await prisma.usageRecord.findMany({
      where: {
        userId: session.user.id,
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // Limit to last 100 records
      select: {
        createdAt: true,
        credits: true,
        type: true,
        model: true,
        tokens: true,
      },
    });

    // Get daily usage for the last 30 days
    const thirtyDaysAgo = subDays(new Date(), 30);
    const dailyUsage = await prisma.usageRecord.groupBy({
      by: ['createdAt'],
      where: {
        userId: session.user.id,
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      _sum: {
        credits: true,
      },
      _count: {
        id: true,
      },
    });

    // Format daily usage for charting
    const formattedDailyUsage = dailyUsage.map((day: any) => ({
      date: day.createdAt.toISOString(),
      credits: day._sum.credits || 0,
      requests: day._count.id || 0,
    }));

    // Format usage history
    const formattedUsageHistory = usageHistory.map((record: any) => ({
      date: record.createdAt.toISOString(),
      credits: record.credits,
      description: `${record.type} request${record.tokens ? ` (${record.tokens} tokens)` : ''}`,
      model: record.model || undefined,
    }));

    const creditsRemaining = creditStatus.creditsRemaining;
    const dailyRefreshCredits = 500; // Daily refresh amount
    const freeCredits = Math.max(0, creditsRemaining);

    return NextResponse.json({
      // Legacy format
      currentPlan: creditStatus.plan.toUpperCase(),
      creditsUsed: creditStatus.creditsUsed,
      creditsTotal: creditStatus.monthlyCredits,
      resetDate: creditStatus.creditsResetAt.toISOString(),
      usageHistory: formattedUsageHistory,
      dailyUsage: formattedDailyUsage,

      // New format for CreditsCard
      totalCredits: creditsRemaining,
      monthlyCredits: creditStatus.monthlyCredits,
      creditsRemaining: creditsRemaining,
      plan: creditStatus.plan,
      dailyRefreshCredits: dailyRefreshCredits,
      freeCredits: freeCredits,
      nextResetTime: creditStatus.creditsResetAt.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching usage data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
