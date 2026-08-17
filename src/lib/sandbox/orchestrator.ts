/**
 * Sandbox orchestrator — the single entry point every agent run must pass
 * through before touching compute. Mirrors the shape of lib/billing/gate.ts:
 * one function that returns a decision object, plus a narrow spend/lease API
 * that does the actual state mutation atomically.
 *
 * acquireSandbox() order of operations (matches the spec):
 *  1. assertCanSpend first — never provision before confirming the workspace
 *     can afford the estimate.
 *  2. Acquire the workspace's advisory lock for a fast, DB-only claim.
 *  3. Outside the lock, do the (potentially slow) provider call.
 *  4. Register the lease with hard ceilings.
 *  5. Caller heartbeats periodically and releases in a finally — see
 *     SandboxLease's heartbeat()/release() below.
 */

import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { assertCanSpend } from '@/lib/billing/gate';
import { withWorkspaceSandboxLock } from './lock';
import { vercelSandboxProvider } from './providers/vercel-sandbox-provider';
import {
  isStatePersistenceConfigured,
  persistWorkspaceState,
  restoreWorkspaceState,
  deleteWorkspaceState,
} from './state-archive';
import type { SandboxHandle, SandboxProvider, SandboxSpec } from './types';

/**
 * The real provider, used by every production call site. Tests inject a
 * fake via each function's `provider` option instead of mocking this module —
 * see tests/integration/sandbox-orchestrator.test.ts.
 */
const DEFAULT_PROVIDER: SandboxProvider = vercelSandboxProvider;

/** Missed heartbeats past this age are eligible for the sweeper to force-release. */
export const HEARTBEAT_TIMEOUT_MS = 60_000;

export interface RunEstimate {
  /** Estimated credits this run will cost, for assertCanSpend. */
  estimatedCredits: number;
  tokenCeiling: number;
  wallClockCeilingMs: number;
}

export type AcquireDenyReason = 'budget_denied' | 'requires_confirmation';

export interface AcquireDenied {
  allowed: false;
  reason: AcquireDenyReason;
  /** Present only for 'budget_denied' / 'requires_confirmation' — surfaced to the caller for the confirmation UI. */
  spend: Awaited<ReturnType<typeof assertCanSpend>>;
}

export interface AcquiredLease {
  allowed: true;
  lease: SandboxLease;
}

export type AcquireResult = AcquiredLease | AcquireDenied;

function defaultSpec(workspaceId: string, networkAllowlist: string[], restoreArchive: Buffer | null): SandboxSpec {
  return {
    specHash: `v1:${networkAllowlist.slice().sort().join(',')}`,
    vcpus: 1,
    networkAllowlist,
    restoreArchive,
  };
}

/**
 * A run's claim on its workspace's sandbox. Callers must call heartbeat()
 * periodically during long-running work and release() exactly once, in a
 * finally block, on completion, error, or timeout.
 */
export class SandboxLease {
  constructor(
    public readonly leaseId: string,
    public readonly workspaceId: string,
    public readonly handle: SandboxHandle,
    public readonly tokenCeiling: number,
    public readonly wallClockCeilingMs: number,
    private readonly acquiredAtMs: number,
    private readonly provider: SandboxProvider = DEFAULT_PROVIDER
  ) {}

  /** True once either ceiling has been exceeded — callers should halt and release with the matching reason. */
  ceilingHit(tokensConsumed: number): 'token_ceiling' | 'wallclock_ceiling' | null {
    if (tokensConsumed >= this.tokenCeiling) return 'token_ceiling';
    if (Date.now() - this.acquiredAtMs >= this.wallClockCeilingMs) return 'wallclock_ceiling';
    return null;
  }

  async heartbeat(tokensConsumed: number): Promise<void> {
    const now = new Date();
    await prisma.$transaction([
      prisma.sandboxLease.update({
        where: { id: this.leaseId },
        data: { heartbeatAt: now, tokensConsumed },
      }),
      // Idle-detection anchor for the sweeper: a live heartbeat is activity,
      // so it must not look idle no matter how long the run has been going.
      prisma.workspaceSandbox.update({
        where: { workspaceId: this.workspaceId },
        data: { lastActiveAt: now },
      }),
    ]);
  }

  async exec(request: Parameters<SandboxProvider['exec']>[1]) {
    return this.provider.exec(this.handle, request);
  }

  async release(reason: 'completed' | 'error' | 'token_ceiling' | 'wallclock_ceiling'): Promise<void> {
    await releaseLease(this.leaseId, reason);
  }
}

export async function acquireSandbox(
  workspaceId: string,
  estimate: RunEstimate,
  opts?: { networkAllowlist?: string[]; taskId?: string; provider?: SandboxProvider }
): Promise<AcquireResult> {
  const PROVIDER = opts?.provider ?? DEFAULT_PROVIDER;
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, userId: true },
  });
  if (!workspace) {
    throw new Error(`No workspace ${workspaceId}`);
  }

  // Step 1: budget check first, before any provisioning. assertCanSpend is
  // keyed by user, not workspace — the workspace owner is the billing owner
  // resolveBillingUserId() would land on for a solo workspace, and for a team
  // workspace the owner IS the billing pool owner by construction.
  const spend = await assertCanSpend(workspace.userId, estimate.estimatedCredits);
  if (!spend.allowed) {
    return { allowed: false, reason: 'budget_denied', spend };
  }
  if (spend.requiresConfirmation) {
    return { allowed: false, reason: 'requires_confirmation', spend };
  }

  const networkAllowlist = opts?.networkAllowlist ?? [];

  // Step 2: fast DB-only claim under the workspace's advisory lock.
  const claim = await withWorkspaceSandboxLock(prisma, workspaceId, async (tx) => {
    const existing = await tx.workspaceSandbox.findUnique({ where: { workspaceId } });

    if (!existing) {
      const created = await tx.workspaceSandbox.create({
        data: {
          workspaceId,
          provider: PROVIDER.name,
          status: 'provisioning',
          specHash: defaultSpec(workspaceId, networkAllowlist, null).specHash,
        },
      });
      return { action: 'create' as const, row: created, previousExternalId: null as string | null };
    }

    const specHash = defaultSpec(workspaceId, networkAllowlist, null).specHash;

    if (existing.status === 'running' && existing.specHash === specHash) {
      return { action: 'reuse' as const, row: existing, previousExternalId: null as string | null };
    }

    if (existing.status === 'suspended' && existing.specHash === specHash) {
      const claimed = await tx.workspaceSandbox.update({
        where: { workspaceId },
        data: { status: 'provisioning' },
      });
      return { action: 'resume' as const, row: claimed, previousExternalId: null as string | null };
    }

    // Someone else's create/resume is in flight for this workspace right
    // now — the row was claimed (status flipped to 'provisioning') but the
    // slow provider call that follows the lock hasn't finished yet. This is
    // exactly the case the lock cannot prevent by itself, since the lock is
    // only held for this fast DB-only section: acquireSandbox falls through
    // to waiting for it to settle rather than starting a second provider
    // call, which is what a duplicate 'create' here would do.
    if (existing.status === 'provisioning') {
      return { action: 'wait' as const, row: existing, previousExternalId: null as string | null };
    }

    // Spec changed, or the sandbox is in a failed/destroyed state: rebuild
    // from scratch rather than reusing something that no longer matches.
    const wasLive = existing.status === 'running' || existing.status === 'suspended';
    const claimed = await tx.workspaceSandbox.update({
      where: { workspaceId },
      data: { status: 'provisioning', specHash },
    });
    return {
      action: wasLive ? ('rebuild' as const) : ('create' as const),
      row: claimed,
      // A live sandbox under the old spec must be torn down before a new one
      // is created for the same workspace — otherwise the old VM keeps
      // running with nothing in the database pointing at it anymore (our own
      // row now tracks the new one), which the orphan sweeper has no way to
      // find. Only set for 'rebuild'; irrelevant otherwise.
      previousExternalId: wasLive ? existing.externalId : null,
    };
  });

  if (claim.action === 'wait') {
    await waitForProvisioningToSettle(workspaceId);
    // Re-enter from the top: the lock will now see whatever the in-flight
    // caller left behind (running, suspended-after-failure, or failed) and
    // make a fresh, correct decision instead of this call guessing at it.
    return acquireSandbox(workspaceId, estimate, { networkAllowlist, taskId: opts?.taskId, provider: PROVIDER });
  }

  // Step 3: the slow provider call, outside the lock and outside any transaction.
  let handle: SandboxHandle;
  try {
    if (claim.action === 'reuse') {
      // handle.id must be workspaceId, not claim.row.id (WorkspaceSandbox's own
      // PK) — every provider keys its live-instance lookups on the value
      // passed to create()/resume(), which is always workspaceId. Handing
      // back the row's PK here silently looked up a sandbox that was never
      // registered under that key.
      handle = { id: workspaceId, externalId: claim.row.externalId, provider: claim.row.provider };
      // Confirm it's actually still alive — a sandbox can have been reaped
      // out-of-band (provider-side timeout, manual dashboard action) without
      // our row knowing yet.
      const status = await PROVIDER.status(handle);
      if (status !== 'running') {
        return acquireAfterRebuild(workspaceId, networkAllowlist, estimate, opts?.taskId, PROVIDER);
      }
      await prisma.workspaceSandbox.update({ where: { workspaceId }, data: { lastActiveAt: new Date() } });
    } else if (claim.action === 'resume') {
      const restoreArchive = claim.row.blobStateKey
        ? await restoreWorkspaceState(workspaceId, claim.row.blobStateKey)
        : null;
      handle = await PROVIDER.resume(
        { id: workspaceId, externalId: claim.row.externalId, provider: claim.row.provider },
        defaultSpec(workspaceId, networkAllowlist, restoreArchive)
      );
      await prisma.workspaceSandbox.update({
        where: { workspaceId },
        data: {
          status: 'running',
          externalId: handle.externalId,
          lastActiveAt: new Date(),
          resumeCount: { increment: 1 },
        },
      });
    } else {
      // 'create' (never existed) or 'rebuild' (spec changed under a
      // previously live sandbox). For 'rebuild', destroy the old VM first —
      // it's still running under the stale spec, and once the row below
      // starts tracking the new externalId, the old one is invisible to
      // everything including the orphan sweeper.
      if (claim.previousExternalId) {
        await PROVIDER.destroy({ id: workspaceId, externalId: claim.previousExternalId, provider: claim.row.provider }).catch(
          (err: unknown) => {
            console.error(`[sandbox] Failed to destroy pre-rebuild sandbox for workspace ${workspaceId}:`, err);
          }
        );
      }

      handle = await PROVIDER.create(workspaceId, defaultSpec(workspaceId, networkAllowlist, null));
      await prisma.workspaceSandbox.update({
        where: { workspaceId },
        data: { status: 'running', externalId: handle.externalId, lastActiveAt: new Date() },
      });
    }
  } catch (err) {
    await prisma.workspaceSandbox.update({ where: { workspaceId }, data: { status: 'failed' } }).catch(() => {});
    throw err;
  }

  // Step 4: register the lease with hard ceilings.
  const lease = await prisma.sandboxLease.create({
    data: {
      sandboxId: claim.row.id,
      taskId: opts?.taskId,
      status: 'active',
      wallClockCeilingMs: estimate.wallClockCeilingMs,
      tokenCeiling: estimate.tokenCeiling,
    },
  });

  return {
    allowed: true,
    lease: new SandboxLease(
      lease.id,
      workspaceId,
      handle,
      estimate.tokenCeiling,
      estimate.wallClockCeilingMs,
      Date.now(),
      PROVIDER
    ),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll until a concurrent caller's in-flight create/resume leaves
 * 'provisioning', or give up. The wait itself does no locking — it's just
 * watching for the other caller's slow provider call (which runs unlocked,
 * per the contract in lock.ts) to finish and update the row.
 */
async function waitForProvisioningToSettle(workspaceId: string, timeoutMs = 45_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const row = await prisma.workspaceSandbox.findUnique({ where: { workspaceId }, select: { status: true } });
    if (!row || row.status !== 'provisioning') return;
    await sleep(250);
  }

  throw new Error(
    `Timed out waiting for workspace ${workspaceId}'s sandbox to finish provisioning (another request has held ` +
      `it in 'provisioning' for over ${timeoutMs}ms — likely a stuck or crashed provider call).`
  );
}

/** Spec mismatch or a reused sandbox found dead on status check: tear down the row and retry as a fresh create. */
async function acquireAfterRebuild(
  workspaceId: string,
  networkAllowlist: string[],
  estimate: RunEstimate,
  taskId: string | undefined,
  provider: SandboxProvider
): Promise<AcquireResult> {
  await prisma.workspaceSandbox.update({
    where: { workspaceId },
    data: { status: 'destroyed', destroyedAt: new Date() },
  });
  return acquireSandbox(workspaceId, estimate, { networkAllowlist, taskId, provider });
}

export async function releaseLease(
  leaseId: string,
  reason: 'completed' | 'error' | 'token_ceiling' | 'wallclock_ceiling' | 'heartbeat_missed'
): Promise<void> {
  await prisma.sandboxLease.updateMany({
    where: { id: leaseId, status: 'active' },
    data: { status: 'released', releasedAt: new Date(), releaseReason: reason },
  });
}

/**
 * Suspend a workspace's sandbox after idle timeout. Not called from
 * acquireSandbox — invoked by the sweeper (or, once the worker is hosted, the
 * idle timer) once it confirms no active lease remains.
 */
export async function suspendWorkspaceSandbox(workspaceId: string, provider: SandboxProvider = DEFAULT_PROVIDER): Promise<void> {
  const sandbox = await prisma.workspaceSandbox.findUnique({ where: { workspaceId } });
  if (!sandbox || sandbox.status !== 'running') return;

  const handle: SandboxHandle = { id: workspaceId, externalId: sandbox.externalId, provider: sandbox.provider };
  const { archiveBytes } = await provider.suspend(handle);

  let blobStateKey: string | null = sandbox.blobStateKey;
  if (archiveBytes && isStatePersistenceConfigured()) {
    blobStateKey = await persistWorkspaceState(workspaceId, archiveBytes);
  } else if (archiveBytes && !isStatePersistenceConfigured()) {
    console.warn(
      `[sandbox] Suspending workspace ${workspaceId} without persistence configured — ` +
        'filesystem state will not survive this suspend.'
    );
    blobStateKey = null;
  }

  await prisma.workspaceSandbox.update({
    where: { workspaceId },
    data: { status: 'suspended', suspendedAt: new Date(), blobStateKey },
  });
}

export async function destroyWorkspaceSandbox(workspaceId: string, provider: SandboxProvider = DEFAULT_PROVIDER): Promise<void> {
  const sandbox = await prisma.workspaceSandbox.findUnique({ where: { workspaceId } });
  if (!sandbox || sandbox.status === 'destroyed') return;

  const handle: SandboxHandle = { id: workspaceId, externalId: sandbox.externalId, provider: sandbox.provider };
  await provider.destroy(handle);

  if (sandbox.blobStateKey) {
    await deleteWorkspaceState(sandbox.blobStateKey);
  }

  await prisma.workspaceSandbox.update({
    where: { workspaceId },
    data: { status: 'destroyed', destroyedAt: new Date(), externalId: null, blobStateKey: null },
  });
}

/** Idempotency key for a sandbox usage event — one row per lease per phase. */
export function usageIdempotencyKey(leaseId: string, phase: 'provisioning' | 'active' | 'idle'): string {
  return `sandbox-usage:${leaseId}:${phase}`;
}

export async function recordSandboxUsage(params: {
  workspaceId: string;
  taskId?: string;
  leaseId: string;
  phase: 'provisioning' | 'active' | 'idle';
  billableSeconds: number;
  instanceSize?: string;
  internalCost?: number;
  provider?: SandboxProvider;
}): Promise<void> {
  const idempotencyKey = usageIdempotencyKey(params.leaseId, params.phase);
  const providerName = (params.provider ?? DEFAULT_PROVIDER).name;

  await prisma.sandboxUsageEvent
    .create({
      data: {
        workspaceId: params.workspaceId,
        taskId: params.taskId,
        leaseId: params.leaseId,
        phase: params.phase,
        provider: providerName,
        instanceSize: params.instanceSize,
        billableSeconds: params.billableSeconds,
        internalCost: params.internalCost,
        idempotencyKey,
      },
    })
    .catch((err: unknown) => {
      // Unique violation on idempotencyKey means this exact usage event was
      // already recorded — a retry, not a new charge. Anything else is a
      // real failure and must propagate.
      const code = (err as { code?: string } | null)?.code;
      if (code !== 'P2002') throw err;
    });
}

export { randomUUID as generateRunId };
