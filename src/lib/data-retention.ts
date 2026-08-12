/**
 * Data retention enforcement (GDPR data minimization).
 *
 * Users can opt into a retention window (User.dataRetentionDays). When set, this
 * job deletes their conversations — and, via cascade, the messages and
 * attachments under them — older than that window. Users with no window keep
 * data indefinitely (current behavior), so this is strictly opt-in.
 *
 * Runs from a scheduled cron (see /api/cron/data-retention). Designed to be
 * safe to run repeatedly and to keep going if one user errors.
 */

import { prisma } from '@/lib/prisma';

export interface RetentionResult {
  usersProcessed: number;
  conversationsDeleted: number;
  errors: number;
}

export async function purgeExpiredData(): Promise<RetentionResult> {
  const result: RetentionResult = {
    usersProcessed: 0,
    conversationsDeleted: 0,
    errors: 0,
  };

  const users = await prisma.user.findMany({
    where: { dataRetentionDays: { not: null } },
    select: { id: true, dataRetentionDays: true },
  });

  for (const user of users) {
    const days = user.dataRetentionDays;
    if (!days || days <= 0) continue;

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    try {
      // Conversations own messages + attachments via onDelete: Cascade, so
      // deleting the conversation rows removes the content beneath them.
      const deleted = await prisma.conversation.deleteMany({
        where: { userId: user.id, lastMessageAt: { lt: cutoff } },
      });
      result.conversationsDeleted += deleted.count;
      result.usersProcessed += 1;
    } catch (error) {
      console.error(`[retention] failed for user ${user.id}:`, error);
      result.errors += 1;
    }
  }

  return result;
}
