import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { subDays, format } from 'date-fns';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get usage data for the last 30 days
    const thirtyDaysAgo = subDays(new Date(), 30);

    const usageRecords = await prisma.usageRecord.groupBy({
      by: ['createdAt'],
      where: {
        userId: user.id,
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

    // Create a map of dates to usage data
    const usageMap = new Map();

    usageRecords.forEach((record) => {
      const dateKey = format(new Date(record.createdAt), 'yyyy-MM-dd');
      if (!usageMap.has(dateKey)) {
        usageMap.set(dateKey, {
          date: dateKey,
          credits: 0,
          requests: 0,
        });
      }

      const current = usageMap.get(dateKey);
      current.credits += record._sum.credits || 0;
      current.requests += record._count.id;
    });

    // Fill in missing dates with 0 values
    const usage = [];
    for (let i = 29; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
      usage.push(
        usageMap.get(date) || {
          date,
          credits: 0,
          requests: 0,
        }
      );
    }

    return NextResponse.json({ usage });
  } catch (error) {
    console.error('Error fetching usage data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 }
    );
  }
}
