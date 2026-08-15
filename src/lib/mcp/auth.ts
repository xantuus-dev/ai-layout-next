/**
 * Bearer-token verification for the Xantuus MCP server.
 *
 * MCP clients authenticate with the same `xan_` API keys issued at
 * /settings/api-keys, so an existing key works as an MCP credential with no
 * second credential type to manage or revoke.
 */

import type { AuthInfo } from '@modelcontextprotocol/server';
import { authenticateApiKeyToken } from '@/lib/api-auth';

/**
 * Scopes granted to a valid API key. The key model is currently all-or-nothing
 * — a key can do whatever its owner can — so every key gets both scopes. They
 * exist so `withMcpAuth({ requiredScopes })` and per-tool checks have something
 * to gate on once keys become scoped.
 */
export const MCP_SCOPES = ['xantuus:read', 'xantuus:write'] as const;

/** Reads the authenticated user id that {@link verifyXantuusToken} attached. */
export function userIdFromAuthInfo(authInfo?: AuthInfo): string | undefined {
  const userId = authInfo?.extra?.userId;
  return typeof userId === 'string' ? userId : undefined;
}

/**
 * Verify a bearer token for `withMcpAuth`.
 *
 * Returning `undefined` makes the adapter answer 401 with the RFC 9728
 * `WWW-Authenticate` challenge, so an invalid or missing key never reaches a
 * tool handler.
 */
export async function verifyXantuusToken(
  _req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;

  const result = await authenticateApiKeyToken(bearerToken);
  if (!result.success || !result.userId) return undefined;

  return {
    token: bearerToken,
    // API keys are not OAuth clients; the owning user is the only identity.
    clientId: result.userId,
    scopes: [...MCP_SCOPES],
    extra: { userId: result.userId },
  };
}
