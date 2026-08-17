/**
 * Orphan sweeper — the mandatory backstop against the single most likely
 * source of a surprise bill: a sandbox left running with nothing using it.
 *
 * Two independent sweeps:
 *  - Stale leases: a lease whose heartbeat has gone quiet past
 *    HEARTBEAT_TIMEOUT_MS is force-released. This does not by itself suspend
 *    the sandbox — a stuck lease usually means a stuck run, not an idle
 *    workspace, and another request may legitimately be about to reuse it.
 *  - Idle sandboxes: a sandbox with no active lease and no activity for the
 *    idle threshold is suspended (state persisted if configured, destroyed
 *    otherwise falls back to a clean stop — see suspendWorkspaceSandbox).
 *
 * Run on a schedule (Vercel Cron today; the same function works unchanged
 * once a persistent worker exists — it's just a different caller).
 */

import { prisma } from '@/lib/prisma';
import { HEARTBEAT_TIMEOUT_MS, releaseLease, suspendWorkspaceSandbox } from './orchestrator';
import type { SandboxProvider } from './types';

export const DEFAULT_IDLE_THRESHOLD_MS = 15 * 60_000;

export interface SweepResult {
  staleLeaseReleased: number;
  idleSandboxesSuspended: number;
  errors: { workspaceId?: string; leaseId?: string; message: string }[];
}

export async function sweepStaleLeases(): Promise<{ released: number; errors: SweepResult['errors'] }> {
  const cutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS);

  const stale = await prisma.sandboxLease.findMany({
    where: { status: 'active', heartbeatAt: { lt: cutoff } },
    select: { id: true },
  });

  const errors: SweepResult['errors'] = [];
  let released = 0;

  for (const { id } of stale) {
    try {
      await releaseLease(id, 'heartbeat_missed');
      released += 1;
    } catch (err) {
      errors.push({ leaseId: id, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return { released, errors };
}

export async function sweepIdleSandboxes(
  idleThresholdMs: number = DEFAULT_IDLE_THRESHOLD_MS,
  provider?: SandboxProvider
): Promise<{ suspended: number; errors: SweepResult['errors'] }> {
  const cutoff = new Date(Date.now() - idleThresholdMs);

  const candidates = await prisma.workspaceSandbox.findMany({
    where: { status: 'running', lastActiveAt: { lt: cutoff } },
    select: { workspaceId: true, leases: { where: { status: 'active' }, select: { id: true }, take: 1 } },
  });

  const errors: SweepResult['errors'] = [];
  let suspended = 0;

  for (const candidate of candidates) {
    // An active lease means something is (or recently was) using it — leave
    // it running. The stale-lease sweep above is what reclaims a run that's
    // actually dead; this sweep must not race ahead of it and suspend a
    // sandbox out from under a lease that just hasn't been force-released yet.
    if (candidate.leases.length > 0) continue;

    try {
      await suspendWorkspaceSandbox(candidate.workspaceId, provider);
      suspended += 1;
    } catch (err) {
      errors.push({ workspaceId: candidate.workspaceId, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return { suspended, errors };
}

export async function runSandboxSweep(idleThresholdMs?: number, provider?: SandboxProvider): Promise<SweepResult> {
  const [leases, sandboxes] = await Promise.all([
    sweepStaleLeases(),
    sweepIdleSandboxes(idleThresholdMs, provider),
  ]);

  return {
    staleLeaseReleased: leases.released,
    idleSandboxesSuspended: sandboxes.suspended,
    errors: [...leases.errors, ...sandboxes.errors],
  };
}
