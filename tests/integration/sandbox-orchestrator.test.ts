import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { acquireSandbox, recordSandboxUsage, HEARTBEAT_TIMEOUT_MS } from '@/lib/sandbox/orchestrator';
import { sweepStaleLeases, sweepIdleSandboxes } from '@/lib/sandbox/sweeper';
import { InMemorySandboxProvider } from '../helpers/in-memory-sandbox-provider';

// Runs against the real dev database (see tests/setup.ts) and cleans up every
// row it creates, matching the convention in tests/integration/credits.test.ts.
// The sandbox provider is always the in-memory fake here — never the real
// Vercel Sandbox adapter, which would mean a real provisioning call (and a
// real bill) per test run.

describe('sandbox orchestrator', () => {
  let userId: string;
  let workspaceId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `test-sandbox-${Date.now()}-${Math.random()}@example.com`,
        name: 'Sandbox Test User',
        monthlyCredits: 1000,
        creditsUsed: 0,
        plan: 'free',
      },
    });
    userId = user.id;

    const workspace = await prisma.workspace.create({
      data: { userId, name: 'Sandbox Test Workspace', isDefault: true },
    });
    workspaceId = workspace.id;
  });

  afterEach(async () => {
    await prisma.sandboxUsageEvent.deleteMany({ where: { workspaceId } });
    await prisma.sandboxLease.deleteMany({ where: { sandbox: { workspaceId } } });
    await prisma.workspaceSandbox.deleteMany({ where: { workspaceId } });
    await prisma.workspace.delete({ where: { id: workspaceId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  const estimate = { estimatedCredits: 10, tokenCeiling: 10_000, wallClockCeilingMs: 60_000 };

  it('budget test: never provisions when assertCanSpend denies', async () => {
    await prisma.user.update({ where: { id: userId }, data: { monthlyCredits: 5, creditsUsed: 5 } });

    const provider = new InMemorySandboxProvider();
    const result = await acquireSandbox(workspaceId, estimate, { provider });

    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toBe('budget_denied');
    expect(provider.createCalls).toHaveLength(0);

    const row = await prisma.workspaceSandbox.findUnique({ where: { workspaceId } });
    expect(row).toBeNull();
  });

  it('concurrency test: N simultaneous acquireSandbox calls produce exactly one sandbox', async () => {
    const provider = new InMemorySandboxProvider();

    const results = await Promise.all(
      Array.from({ length: 5 }, () => acquireSandbox(workspaceId, estimate, { provider }))
    );

    expect(results.every((r) => r.allowed)).toBe(true);
    expect(provider.createCalls).toHaveLength(1);

    const sandboxes = await prisma.workspaceSandbox.findMany({ where: { workspaceId } });
    expect(sandboxes).toHaveLength(1);
    expect(sandboxes[0].status).toBe('running');

    const leases = await prisma.sandboxLease.findMany({ where: { sandboxId: sandboxes[0].id } });
    expect(leases).toHaveLength(5); // one lease per acquire, sharing the one sandbox
  });

  it('lease expiry: a lease past HEARTBEAT_TIMEOUT_MS is force-released by the sweeper', async () => {
    const provider = new InMemorySandboxProvider();
    const result = await acquireSandbox(workspaceId, estimate, { provider });
    if (!result.allowed) throw new Error('expected acquire to succeed');

    // Back-date the heartbeat past the timeout, simulating a stuck run.
    await prisma.sandboxLease.update({
      where: { id: result.lease.leaseId },
      data: { heartbeatAt: new Date(Date.now() - HEARTBEAT_TIMEOUT_MS - 1000) },
    });

    const { released } = await sweepStaleLeases();
    expect(released).toBeGreaterThanOrEqual(1);

    const lease = await prisma.sandboxLease.findUnique({ where: { id: result.lease.leaseId } });
    expect(lease?.status).toBe('released');
    expect(lease?.releaseReason).toBe('heartbeat_missed');
  });

  it('orphan test: a running sandbox with no active lease is suspended by the idle sweep', async () => {
    const provider = new InMemorySandboxProvider();
    const result = await acquireSandbox(workspaceId, estimate, { provider });
    if (!result.allowed) throw new Error('expected acquire to succeed');
    await result.lease.release('completed');

    // Simulate having gone idle.
    await prisma.workspaceSandbox.update({
      where: { workspaceId },
      data: { lastActiveAt: new Date(Date.now() - 60_000) },
    });

    const { suspended } = await sweepIdleSandboxes(30_000, provider);
    expect(suspended).toBe(1);

    const row = await prisma.workspaceSandbox.findUnique({ where: { workspaceId } });
    expect(row?.status).toBe('suspended');
  });

  it('idle sweep does not suspend a sandbox with an active lease still held', async () => {
    const provider = new InMemorySandboxProvider();
    const result = await acquireSandbox(workspaceId, estimate, { provider });
    if (!result.allowed) throw new Error('expected acquire to succeed');
    // Deliberately not released — simulates a run still in progress.

    await prisma.workspaceSandbox.update({
      where: { workspaceId },
      data: { lastActiveAt: new Date(Date.now() - 60_000) },
    });

    const { suspended } = await sweepIdleSandboxes(30_000, provider);
    expect(suspended).toBe(0);

    const row = await prisma.workspaceSandbox.findUnique({ where: { workspaceId } });
    expect(row?.status).toBe('running');
  });

  it('rebuild: a spec change on a running sandbox destroys the old VM before creating the new one', async () => {
    const provider = new InMemorySandboxProvider();
    const first = await acquireSandbox(workspaceId, estimate, { provider, networkAllowlist: [] });
    if (!first.allowed) throw new Error('expected first acquire to succeed');
    const firstExternalId = first.lease.handle.externalId;
    await first.lease.release('completed');

    // Different networkAllowlist -> different specHash -> rebuild, even
    // though the sandbox from the first acquire is still 'running'.
    const second = await acquireSandbox(workspaceId, estimate, { provider, networkAllowlist: ['example.com'] });
    if (!second.allowed) throw new Error('expected second acquire to succeed');

    expect(provider.createCalls).toHaveLength(2);
    expect(firstExternalId).toBeTruthy();
    expect(provider.destroyCalls).toContain(firstExternalId);

    const row = await prisma.workspaceSandbox.findUnique({ where: { workspaceId } });
    expect(row?.status).toBe('running');
    expect(row?.specHash).toBe('v1:example.com');
  });

  it('idempotency test: replayed usage events for the same lease/phase do not double-write', async () => {
    const provider = new InMemorySandboxProvider();
    const result = await acquireSandbox(workspaceId, estimate, { provider });
    if (!result.allowed) throw new Error('expected acquire to succeed');

    const usage = {
      workspaceId,
      leaseId: result.lease.leaseId,
      phase: 'active' as const,
      billableSeconds: 42,
    };

    await recordSandboxUsage(usage);
    await recordSandboxUsage(usage); // replay — must not create a second row
    await recordSandboxUsage(usage);

    const events = await prisma.sandboxUsageEvent.findMany({ where: { leaseId: result.lease.leaseId } });
    expect(events).toHaveLength(1);
    expect(events[0].billableSeconds).toBe(42);
  });
});
