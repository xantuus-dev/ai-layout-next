/**
 * Xantuus AI MCP server.
 *
 * Exposes account, template and task tools over Streamable HTTP so MCP clients
 * (Claude Code, Claude Desktop, Cursor, ...) can drive Xantuus directly.
 * Clients authenticate with a `xan_` API key from /settings/api-keys.
 */

import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { registerXantuusTools } from '@/lib/mcp/tools';
import { verifyXantuusToken, MCP_SCOPES } from '@/lib/mcp/auth';

// Prisma and the crypto helpers need Node, not the edge runtime.
export const runtime = 'nodejs';
// Every response depends on the caller's bearer token, so nothing here is cacheable.
export const dynamic = 'force-dynamic';

const handler = createMcpHandler(registerXantuusTools, {
  serverInfo: { name: 'xantuus-ai', version: '1.0.0' },
  instructions:
    'Tools for the Xantuus AI account that owns the presented API key: credit and usage reporting, the prompt template library, and workspace projects and tasks.',
  verboseLogs: process.env.NODE_ENV === 'development',
});

const authenticatedHandler = withMcpAuth(handler, verifyXantuusToken, {
  required: true,
  requiredScopes: [MCP_SCOPES[0]],
});

export {
  authenticatedHandler as GET,
  authenticatedHandler as POST,
  authenticatedHandler as DELETE,
};
