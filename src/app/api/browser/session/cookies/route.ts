/**
 * Browser Extension Cookie Sync Endpoint
 *
 * Receives cookies from browser extension and stores them for use in automated sessions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Authenticate via API key (browser extension uses API key, not session)
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = authHeader.replace('Bearer ', '');

    // Verify API key
    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: { key: apiKey },
      include: { user: true },
    });

    if (!apiKeyRecord) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const user = apiKeyRecord.user;

    // Update last used time
    await prisma.apiKey.update({
      where: { key: apiKey },
      data: { lastUsed: new Date() },
    });

    // Parse request body
    const { cookies, timestamp } = await request.json();

    if (!cookies || typeof cookies !== 'object') {
      return NextResponse.json({ error: 'Invalid cookies data' }, { status: 400 });
    }

    // Store cookies in user's browser session storage
    // Find existing synced session or create a new one
    let sessionRecord = await prisma.browserSession.findFirst({
      where: {
        userId: user.id,
        status: 'synced',
      },
    });

    if (sessionRecord) {
      // Update existing synced session
      sessionRecord = await prisma.browserSession.update({
        where: { id: sessionRecord.id },
        data: {
          cookies: cookies as any,
          lastSyncAt: new Date(timestamp),
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new synced session
      sessionRecord = await prisma.browserSession.create({
        data: {
          userId: user.id,
          url: '', // Will be set when actually used
          status: 'synced',
          cookies: cookies as any,
          lastSyncAt: new Date(timestamp),
        },
      });
    }

    // Count domains
    const domainCount = Object.keys(cookies).length;
    const cookieCount = Object.values(cookies).reduce((acc: number, domainCookies: any) => {
      return acc + (Array.isArray(domainCookies) ? domainCookies.length : 0);
    }, 0);

    console.log(`✅ Synced ${cookieCount} cookies across ${domainCount} domains for user ${user.email}`);

    return NextResponse.json({
      success: true,
      sessionId: sessionRecord.id,
      domains: domainCount,
      cookies: cookieCount,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Cookie sync error:', error);

    return NextResponse.json(
      {
        error: 'Cookie sync failed',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to retrieve stored cookies for a specific domain
 */
export async function GET(request: NextRequest) {
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

    // Get domain from query params
    const url = new URL(request.url);
    const domain = url.searchParams.get('domain');

    // Get stored browser session
    const browserSession = await prisma.browserSession.findFirst({
      where: { userId: user.id },
      orderBy: { lastSyncAt: 'desc' },
    });

    if (!browserSession || !browserSession.cookies) {
      return NextResponse.json({
        success: true,
        cookies: [],
        message: 'No cookies stored',
      });
    }

    const cookiesData = browserSession.cookies as any;

    // If domain specified, return only that domain's cookies
    if (domain) {
      const domainCookies = cookiesData[domain] || [];
      return NextResponse.json({
        success: true,
        domain,
        cookies: domainCookies,
        lastSync: browserSession.lastSyncAt,
      });
    }

    // Otherwise return all cookies
    return NextResponse.json({
      success: true,
      cookies: cookiesData,
      domains: Object.keys(cookiesData),
      lastSync: browserSession.lastSyncAt,
    });

  } catch (error: any) {
    console.error('Cookie retrieval error:', error);

    return NextResponse.json(
      {
        error: 'Failed to retrieve cookies',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
