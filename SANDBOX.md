# Sandbox Orchestrator

One compute sandbox per **workspace** (not per user, not per session — see
[Why Workspace, not Organization](#why-workspace-not-organization)). Every
agent run that needs tool use, code execution, or browser automation must go
through `acquireSandbox()` before touching compute.

## Quick start

```ts
import { acquireSandbox } from '@/lib/sandbox/orchestrator';

const result = await acquireSandbox(workspaceId, {
  estimatedCredits: 10,
  tokenCeiling: 50_000,
  wallClockCeilingMs: 5 * 60_000,
});

if (!result.allowed) {
  // result.reason: 'budget_denied' | 'requires_confirmation'
  // result.spend: the SpendDecision from lib/billing/gate.ts — surface it
  // in the pre-flight confirmation UI (estimate, remaining, what happens
  // if exceeded) rather than a bare refusal.
  return respondWithBudgetDecision(result);
}

const { lease } = result;
try {
  const output = await lease.exec({ cmd: 'node', args: ['script.js'], timeoutMs: 30_000 });
  await lease.heartbeat(tokensConsumedSoFar); // call periodically during long runs
} finally {
  await lease.release('completed'); // or 'error' / whatever halted the run
}
```

`lease.ceilingHit(tokensConsumed)` returns `'token_ceiling' | 'wallclock_ceiling' | null`
— check it inside the agent loop, not just at the end, so a runaway loop is
halted mid-flight (`"reached my budget ceiling — continue?"`) rather than
after the fact.

## State machine

```
none ──create──▶ provisioning ──▶ running
                                    │
                        idle timer ─┴──▶ suspending ──▶ suspended
                                              ▲             │
                                              └── resume ───┘
suspended ──(retention expiry)──▶ destroyed
any state ──(provider error)────▶ failed ──▶ (rebuild on next acquire)
```

Persisted in `WorkspaceSandbox` (one row per workspace, `workspaceId` unique
— that uniqueness constraint doubles as the identity the advisory lock in
`lib/sandbox/lock.ts` serializes on). A run's claim on it is a separate
`SandboxLease` row: multiple leases can point at one sandbox over its
lifetime, and the currently-active one is what the orphan sweeper checks
before suspending.

### Why the claim is two steps, not one

`acquireSandbox()` splits into a fast DB-only claim (locked) and a slow
provider call (unlocked):

1. Under the workspace's Postgres advisory lock (`lib/sandbox/lock.ts`),
   read-or-claim the `WorkspaceSandbox` row and decide `create` / `resume` /
   `reuse` / `wait`.
2. Outside the lock, actually call the provider (`create`/`resume`/`status`),
   which can take real wall-clock time against an external API.

Holding a Postgres transaction (and its pooled connection) open for the
duration of a slow HTTP call to a sandbox provider is how you exhaust a
pgBouncer connection pool under load — so the lock's contract (documented in
`lock.ts`) is explicitly "DB-only, fast." A concurrent caller that finds the
row already `provisioning` doesn't start a second provider call; it polls
(`waitForProvisioningToSettle`) until the in-flight caller's result lands,
then re-enters `acquireSandbox()` to make a fresh decision. This is covered
by the concurrency test in `tests/integration/sandbox-orchestrator.test.ts` —
which is worth reading as a cautionary tale: the first version of this lock
correctly serialized *provisioning* new sandboxes, but didn't handle a
concurrent caller seeing an in-flight `provisioning` row as anything other
than "start over," and produced 5 sandboxes for 5 concurrent callers before
the `wait` path was added.

## Swapping or adding a provider

Every provider implements `SandboxProvider` (`src/lib/sandbox/types.ts`):
`create`, `resume`, `suspend`, `destroy`, `exec`, `status`. Nothing outside
`src/lib/sandbox/providers/*` imports a vendor SDK directly.

To verify a new adapter, point the contract suite at it:

```ts
// tests/unit/sandbox-provider-contract.test.ts
runProviderContractTests('my-new-provider', () => new MyNewProvider());
```

The orchestrator and sweeper both accept an optional `provider` argument
(defaulting to the real Vercel Sandbox adapter) specifically so they can be
exercised against `tests/helpers/in-memory-sandbox-provider.ts` in tests
without a real provisioning call — and the same seam is what a second
production provider would plug into.

### Why Vercel Sandbox, and its one real limitation

`@vercel/sandbox` was already an integrated dependency (used in
`src/lib/skills/sandbox-runner.ts` for ephemeral JS skill execution) before
this build. It has **no live suspend/resume** — unlike E2B or Daytona, there
is no pause; "suspend" here means tar the workdir, destroy the VM, and hand
the archive to the caller. Concretely:

- Every resume pays a VM boot + untar cost, not a near-instant unpause.
- Anything only in memory at suspend time (running processes, open
  connections) is gone on resume — only the filesystem survives.
- `@vercel/sandbox` does have a native `persistent: true` + named-sandbox
  auto-snapshot feature that could approximate resume without any of this.
  It's deliberately unused: that mechanism stores its snapshot inside
  Vercel's own infrastructure, opaque to this app, and the security
  requirement below can only be satisfied for bytes we actually see. Every
  sandbox this adapter creates sets `persistent: false` so the two
  mechanisms never run in parallel.

## Filesystem persistence & encryption

`src/lib/sandbox/state-archive.ts` tars the workdir (in the provider
adapter), encrypts it with a key derived per-workspace via HKDF from
`SANDBOX_STATE_MASTER_KEY`, and uploads it to **private** Vercel Blob access
(never the public/unguessable-URL pattern used for generated media in
`lib/storage.ts`). This is what satisfies "sandbox filesystem is not backed
up to shared storage without per-org encryption scoping": even a bug that
fetched the wrong workspace's archive would fail AES-GCM authentication
rather than silently return another tenant's files.

**Required env vars for persistence to actually work:**

| Variable | Effect if missing |
|---|---|
| `SANDBOX_STATE_MASTER_KEY` | `openssl rand -base64 32`. Without it, `isStatePersistenceConfigured()` is false and suspend silently degrades to destroy — logged as a warning, not an error. A suspended workspace's files do not survive. |
| `BLOB_READ_WRITE_TOKEN` | Same degradation. |
| `VERCEL_TOKEN` / `VERCEL_TEAM_ID` / `VERCEL_PROJECT_ID` | Only needed for local dev; on Vercel the SDK authenticates via OIDC automatically. |

Rotating `SANDBOX_STATE_MASTER_KEY` invalidates every existing archive at
once — the next resume for any workspace just gets a fresh empty sandbox
instead of a restored one. This is deliberate: it means a key rotation can
never partially decrypt the wrong workspace's data, only fail closed.

## Cost attribution

`SandboxUsageEvent` is an append-only ledger (never mutate a row; correct
with an offsetting row, same convention as `lib/billing/gate.ts`), keyed by
`idempotencyKey` so retried lifecycle events can't double-count. Three
phases are tracked separately because they're billed differently:

- `provisioning` — cold-start seconds
- `active` — execution seconds
- `idle` — time between last activity and suspend; pure waste, worth
  alerting on if `SUM(billableSeconds) WHERE phase = 'idle'` trends up

Per-workspace monthly rollup:

```sql
SELECT "workspaceId", "phase", SUM("billableSeconds") AS seconds, SUM("internalCost") AS cost
FROM "SandboxUsageEvent"
WHERE "createdAt" >= date_trunc('month', now())
GROUP BY "workspaceId", "phase";
```

## Orphan sweeper

`src/lib/sandbox/sweeper.ts`. Has its own route, `POST
/api/cron/sandbox-sweep` (`CRON_SECRET`-guarded like the other cron routes),
but it is **not currently registered in `vercel.json`** — this project's
Vercel plan is Hobby, which caps crons at 2 total with a once-daily minimum,
and both slots were already taken (`check-scheduled-tasks`,
`data-retention`). Confirmed the hard way: an initial deploy with a 3rd,
5-minute cron entry failed outright with `Hobby accounts are limited to
daily cron jobs`. The sweep instead runs piggybacked on
`/api/cron/data-retention`'s daily 4am UTC schedule — see that route.
**Consequence**: an orphaned sandbox is caught within ~24h, not ~5min. Move
the sweep back to its own dedicated `sandbox-sweep` cron entry (already
written, just uncomment it) once the plan changes. Two independent sweeps:

- **Stale leases**: a lease whose heartbeat is older than
  `HEARTBEAT_TIMEOUT_MS` (60s) is force-released with reason
  `heartbeat_missed`. Does not by itself suspend the sandbox — a stuck lease
  usually means a stuck run, not an idle workspace.
- **Idle sandboxes**: a `running` sandbox with no active lease and no
  activity for the idle threshold (default 15 min) is suspended. Explicitly
  skips any sandbox that still has an active lease, so it never races ahead
  of the stale-lease sweep and suspends a sandbox out from under a lease
  that just hasn't been force-released yet.

This is not optional: an orphaned running sandbox is the single most likely
source of a surprise bill.

## Security

- Egress is deny-by-default (`networkPolicy: 'deny-all'` unless an explicit
  allowlist is passed) — see `NetworkPolicy` in `@vercel/sandbox`.
- Resource limits (`vcpus`) are set on every `create()`/`resume()` call.
- One sandbox per workspace, enforced by `WorkspaceSandbox.workspaceId`
  being `@unique` — there is no code path that looks up a sandbox by
  anything other than workspace id, so cross-tenant sharing isn't
  structurally possible.
- No provider credentials or other tenant's secrets are injected into a
  sandbox — `env: {}` on every `create()`.
- Filesystem state that leaves the VM boundary is always encrypted,
  per-workspace-keyed, before it reaches storage (see above).

## Why Workspace, not Organization

There's a separate `Organization` Prisma model, but it's billing-identity
only (owner, seats, invoice fields) and isn't referenced by any
access-control path. `Workspace` — with `WorkspaceMember` roles and
`verifyWorkspaceAccess()` already gating every request — is the real
multi-tenant boundary in this codebase today, so it's what the sandbox
lifecycle is keyed on.

## What this does NOT do (yet)

See the implementation PR description / commit history for the full list;
the two structural gaps worth knowing about before relying on this in
production:

1. **No persistent worker is deployed.** `acquireSandbox()`,
   `suspendWorkspaceSandbox()`, and the sweeper are all plain functions
   callable from any runtime — a Vercel route handler today, the existing
   (already-written) `src/lib/queue/agent-worker.ts` once it has a host
   tomorrow. Nothing here assumes a request-scoped caller, but nothing here
   provisions that host either — Vercel serverless functions can't run
   BullMQ's long-lived worker process, and that's a hosting decision, not a
   code one.
2. **No route wires `acquireSandbox()` in yet.** This PR delivers the
   orchestrator as a complete, independently tested library
   (schema → provider adapter → lock → lease → sweeper), not a rewrite of
   every agent-run entry point. Wiring it into `/api/agent/execute` and
   friends is the natural next PR, once this one's reviewed — touching those
   routes blind, in the same change as the orchestrator itself, is exactly
   the kind of unrelated-refactor scope creep this build was scoped to avoid.
