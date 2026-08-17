/**
 * Per-workspace advisory lock for sandbox lifecycle transitions.
 *
 * Postgres advisory locks take a bigint key; workspace ids are cuids
 * (strings), so we hash down to a 64-bit signed integer. Collisions between
 * two different workspaces are possible in principle but merely serialize
 * two unrelated create/resume calls against each other for the duration of
 * one transaction — never incorrect, only occasionally slower.
 *
 * pg_advisory_xact_lock (not the session variant) is deliberate: the lock is
 * released automatically when the transaction ends, even on crash or an
 * uncaught throw, so a stuck request can never leave the workspace locked
 * forever.
 */

import { createHash } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';

function lockKey(workspaceId: string): bigint {
  const digest = createHash('sha256').update(workspaceId).digest();
  // Top 8 bytes, masked into the signed 64-bit range Postgres bigint accepts.
  // BigInt.asIntN reinterprets the low 63 bits as signed rather than using a
  // literal mask, since BigInt literal syntax needs ES2020+ and this project
  // targets ES2017.
  return BigInt.asIntN(63, digest.readBigInt64BE(0));
}

/**
 * Run `fn` with an exclusive advisory lock held on `workspaceId` for the
 * duration of one transaction. A concurrent call for the same workspace
 * blocks until this transaction commits or rolls back — it does not fail,
 * so callers see "wait then proceed", not "wait then error".
 *
 * `fn` must be DB-only and fast (row reads/writes, no provider API calls).
 * The lock holds both a Postgres advisory lock and a pooled connection for
 * its entire duration; a slow sandbox-provider HTTP call inside it would tie
 * up a connection from the pgBouncer pool for the length of that call, which
 * under concurrent load is how you exhaust the pool. Use this only to claim
 * or read the WorkspaceSandbox row — do the actual provider.create/resume
 * call after this returns, using the row it claimed.
 */
export async function withWorkspaceSandboxLock<T>(
  prisma: PrismaClient,
  workspaceId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  const key = lockKey(workspaceId);

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key})`;
      return fn(tx);
    },
    // Sandbox provisioning/resume can take real wall-clock time against the
    // provider API; the default transaction timeout is tuned for row writes.
    { timeout: 30_000, maxWait: 35_000 }
  );
}
