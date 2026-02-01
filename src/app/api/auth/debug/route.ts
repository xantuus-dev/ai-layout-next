import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    // Test database connection
    const userCount = await prisma.user.count();

    // Get current user if logged in
    let currentUser = null;
    if (session?.user?.email) {
      currentUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: {
          id: true,
          email: true,
          name: true,
          plan: true,
          monthlyCredits: true,
          creditsUsed: true,
          createdAt: true,
        }
      });
    }

    return NextResponse.json({
      success: true,
      session: session ? {
        user: session.user,
        expires: session.expires
      } : null,
      database: {
        connected: true,
        totalUsers: userCount
      },
      currentUser,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
        hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
        nextAuthUrl: process.env.NEXTAUTH_URL,
      }
    });
  } catch (error) {
    console.error('[DEBUG] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
