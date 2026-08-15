import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashApiKey, apiKeyPreview, API_KEY_PREFIX } from '@/lib/crypto/api-keys';

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

  return authenticateApiKeyToken(key);
}

/**
 * Authenticate a raw API key string.
 *
 * Split out from `authenticateApiKey` so callers that hold a token but not a
 * `NextRequest` — the MCP transport, which is handed a web-standard `Request`
 * with the bearer already parsed — reuse the same lookup, including the lazy
 * plaintext-to-hash upgrade below, instead of duplicating it.
 *
 * @param key - The raw API key, with no "Bearer " prefix
 */
export async function authenticateApiKeyToken(
  key: string
): Promise<ApiAuthResult> {
  if (!key || !key.startsWith(API_KEY_PREFIX)) {
    return {
      success: false,
      error: 'Invalid API key format',
    };
  }

  try {
    // Primary lookup is by hash — the plaintext key is never stored.
    let apiKey = await prisma.apiKey.findUnique({
      where: { keyHash: hashApiKey(key) },
      select: { id: true, userId: true },
    });

    // Legacy fallback: rows created before hashing still hold the plaintext in
    // `key`. Match those once, then lazily upgrade the row to hashed storage and
    // clear the plaintext, so the migration completes on first use.
    if (!apiKey) {
      const legacy = await prisma.apiKey.findUnique({
        where: { key },
        select: { id: true, userId: true },
      });
      if (legacy) {
        await prisma.apiKey.update({
          where: { id: legacy.id },
          data: { keyHash: hashApiKey(key), keyPrefix: apiKeyPreview(key), key: null },
        });
        apiKey = legacy;
      }
    }

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
