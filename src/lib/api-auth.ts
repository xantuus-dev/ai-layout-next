import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export interface ApiAuthResult {
  success: boolean;
  userId?: string;
  error?: string;
}

/**
 * Authenticate a request using API key from Authorization header
 * @param request - Next.js request object
 * @returns Authentication result with user ID if successful
 */
export async function authenticateApiKey(
  request: NextRequest
): Promise<ApiAuthResult> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    return {
      success: false,
      error: 'Missing Authorization header',
    };
  }

  // Support both "Bearer <key>" and raw key formats
  const key = authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : authHeader;

  if (!key || !key.startsWith('xan_')) {
    return {
      success: false,
      error: 'Invalid API key format',
    };
  }

  try {
    // Find API key in database
    const apiKey = await prisma.apiKey.findUnique({
      where: { key },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            plan: true,
            monthlyCredits: true,
            creditsUsed: true,
          },
        },
      },
    });

    if (!apiKey) {
      return {
        success: false,
        error: 'Invalid API key',
      };
    }

    // Update last used timestamp
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsed: new Date() },
    });

    return {
      success: true,
      userId: apiKey.userId,
    };
  } catch (error) {
    console.error('API key authentication error:', error);
    return {
      success: false,
      error: 'Authentication failed',
    };
  }
}

/**
 * Check if a request is authenticated via session or API key
 * @param request - Next.js request object
 * @param session - NextAuth session object (if available)
 * @returns User ID if authenticated, null otherwise
 */
export async function getAuthenticatedUserId(
  request: NextRequest,
  session: any
): Promise<string | null> {
  // First check session authentication
  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    return user?.id || null;
  }

  // Fall back to API key authentication
  const apiAuthResult = await authenticateApiKey(request);
  return apiAuthResult.success ? apiAuthResult.userId! : null;
}
