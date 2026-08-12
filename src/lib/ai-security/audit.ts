/**
 * Tamper-evident audit log of model interactions (Feature 3).
 *
 * Every secured model call records one AiInteractionLog row: who, which
 * surface/model/provider, token + credit usage, how much PII was redacted, and
 * the provider's ZDR posture. Content is stored only as SHA-256 hashes by
 * default — never raw prompt/response text — so the log is safe to expose in a
 * user-facing "AI activity" view and to a SOC 2 / EU AI Act auditor.
 *
 * Each row is chained to the user's previous row via `prevHash`, and its own
 * `entryHash` covers the chain link plus the record fields. Deleting or
 * altering any row breaks the chain from that point on, which is what makes the
 * trail tamper-evident.
 *
 * Writing to the log must never break a chat: every failure here is swallowed
 * and logged, never thrown.
 */

import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';

export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export interface AuditEntryInput {
  userId: string;
  surface: string;
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  creditsUsed?: number;
  redactionCount?: number;
  redactionTypes?: Record<string, number>;
  zdr?: boolean;
  /** Raw text — hashed here, never persisted in the clear. */
  promptText?: string;
  responseText?: string;
}

/**
 * Append one entry to the user's audit chain. Best-effort: returns null and
 * logs on any error rather than throwing.
 *
 * Note: the prevHash lookup + insert is not serialized, so two truly concurrent
 * requests for the same user can branch the chain. That is acceptable for an
 * MVP tamper-evidence signal; a stricter guarantee would take a per-user lock.
 */
export async function logAiInteraction(
  entry: AuditEntryInput
): Promise<{ id: string; entryHash: string } | null> {
  try {
    const previous = await prisma.aiInteractionLog.findFirst({
      where: { userId: entry.userId },
      orderBy: { createdAt: 'desc' },
      select: { entryHash: true },
    });
    const prevHash = previous?.entryHash ?? null;

    const promptHash = entry.promptText ? sha256(entry.promptText) : null;
    const responseHash = entry.responseText ? sha256(entry.responseText) : null;

    const canonical = JSON.stringify({
      userId: entry.userId,
      surface: entry.surface,
      provider: entry.provider ?? null,
      model: entry.model ?? null,
      inputTokens: entry.inputTokens ?? 0,
      outputTokens: entry.outputTokens ?? 0,
      creditsUsed: entry.creditsUsed ?? 0,
      redactionCount: entry.redactionCount ?? 0,
      promptHash,
      responseHash,
      zdr: entry.zdr ?? false,
      prevHash,
    });
    const entryHash = sha256(`${prevHash ?? ''}:${canonical}`);

    const row = await prisma.aiInteractionLog.create({
      data: {
        userId: entry.userId,
        surface: entry.surface,
        provider: entry.provider ?? null,
        model: entry.model ?? null,
        inputTokens: entry.inputTokens ?? 0,
        outputTokens: entry.outputTokens ?? 0,
        creditsUsed: entry.creditsUsed ?? 0,
        redactionCount: entry.redactionCount ?? 0,
        redactionTypes: entry.redactionTypes ?? undefined,
        zdr: entry.zdr ?? false,
        promptHash,
        responseHash,
        entryHash,
        prevHash,
      },
      select: { id: true, entryHash: true },
    });

    return row;
  } catch (error) {
    console.error('[audit] failed to record AI interaction:', error);
    return null;
  }
}

/**
 * Walk a user's chain oldest→newest and confirm each entryHash still matches
 * its recomputed value and links to the prior row. Returns the first broken
 * entry id, or null if the chain is intact. For an admin/audit surface.
 */
export async function verifyAuditChain(
  userId: string
): Promise<{ ok: boolean; brokenAt?: string }> {
  const rows = await prisma.aiInteractionLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });

  let prevHash: string | null = null;
  for (const row of rows) {
    const canonical = JSON.stringify({
      userId: row.userId,
      surface: row.surface,
      provider: row.provider,
      model: row.model,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      creditsUsed: row.creditsUsed,
      redactionCount: row.redactionCount,
      promptHash: row.promptHash,
      responseHash: row.responseHash,
      zdr: row.zdr,
      prevHash,
    });
    const expected = sha256(`${prevHash ?? ''}:${canonical}`);
    if (row.prevHash !== prevHash || row.entryHash !== expected) {
      return { ok: false, brokenAt: row.id };
    }
    prevHash = row.entryHash;
  }

  return { ok: true };
}
