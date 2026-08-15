/**
 * Integration credential storage helpers.
 *
 * Third-party integration credentials (OAuth access/refresh tokens, bot tokens,
 * API keys) live on the Integration model as `@db.Text`. These helpers keep
 * them encrypted at rest and centralize the org-ownership resolution, so a
 * read-only DB compromise does not yield live Slack/Telegram/etc. access.
 *
 * Encryption is graceful: with no FIELD_ENCRYPTION_KEY configured, values pass
 * through as plaintext (unchanged behavior). Decryption is always
 * pass-through-safe for plaintext, so existing rows keep working and upgrade to
 * ciphertext on their next write once a key is set.
 */

import { prisma } from '@/lib/prisma';
import { encryptNullableIfConfigured, decryptNullable } from '@/lib/crypto/envelope';

/** The Integration columns that hold secrets and must be encrypted at rest. */
const SECRET_FIELDS = ['accessToken', 'refreshToken', 'apiKey'] as const;

/**
 * Encrypt the secret fields of an Integration create/update payload in place of
 * plaintext. Non-secret fields are left untouched. Safe to call on partial
 * payloads (only present secret fields are transformed).
 */
export function encryptIntegrationSecrets<T extends Record<string, unknown>>(data: T): T {
  const out: Record<string, unknown> = { ...data };
  for (const field of SECRET_FIELDS) {
    if (field in out && out[field] != null) {
      out[field] = encryptNullableIfConfigured(out[field] as string);
    }
  }
  return out as T;
}

/**
 * Decrypt the secret fields of an Integration row read from the database.
 * Returns null unchanged. Plaintext (pre-encryption) values pass through.
 */
export function decryptIntegration<T extends Record<string, unknown> | null | undefined>(
  row: T
): T {
  if (!row) return row;
  const out: Record<string, unknown> = { ...row };
  for (const field of SECRET_FIELDS) {
    if (field in out && out[field] != null) {
      out[field] = decryptNullable(out[field] as string);
    }
  }
  return out as T;
}

/**
 * Resolve the owner an integration should be attributed to. Team members bill
 * to — and share — their team owner's resources, so an integration a member
 * connects is owned by the team owner; a standalone user owns their own.
 * Foundation for org-level "connect once for the whole team" integrations.
 */
export async function resolveIntegrationOwnerId(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { billingOwnerId: true },
  });
  return user?.billingOwnerId ?? userId;
}

/**
 * Whether a user may manage (connect/disconnect) their org's shared
 * integrations. The team owner — anyone who does not bill to someone else —
 * manages the org's integrations, as does a global admin. Plain team members
 * can use shared integrations but not remove them, so one member cannot sever
 * the whole team's Slack/Telegram.
 */
export async function canManageOrgIntegrations(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { billingOwnerId: true, role: true },
  });
  if (!user) return false;
  return user.billingOwnerId == null || user.role === 'admin';
}
