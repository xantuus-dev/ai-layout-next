/**
 * SandboxProvider adapter over @vercel/sandbox.
 *
 * @vercel/sandbox does have a native persistence feature (`persistent: true`
 * + named sandboxes + auto-snapshot on stop/resume via `Sandbox.get({ name,
 * resume: true })`). Deliberately not used here: that mechanism stores its
 * snapshot inside Vercel's own infrastructure, opaque to us, and the security
 * requirement this adapter has to satisfy is that sandbox filesystem state is
 * never persisted to shared storage without per-org encryption we control.
 * We can only encrypt bytes we actually see, so this adapter tars the workdir
 * ourselves, hands the plaintext bytes to the caller, and lets
 * state-archive.ts encrypt per-workspace before it ever reaches storage.
 * `persistent` stays false on every sandbox this adapter creates so the two
 * mechanisms never run in parallel.
 *
 * Consequences of not having a live pause:
 *  - Every resume pays a VM boot + untar cost, not a near-instant unpause.
 *  - Anything only in memory (running processes, open connections) at
 *    suspend time is gone on resume — only the filesystem survives.
 *  - If SANDBOX_STATE_MASTER_KEY or BLOB_READ_WRITE_TOKEN is unset, suspend
 *    degrades to destroy: see isStatePersistenceConfigured() in
 *    state-archive.ts. The orchestrator must check that before promising a
 *    caller their workspace state will survive an idle suspend.
 *
 * Sandboxes are looked up by name, not by an opaque id — the SDK has no
 * "get by id" and only exposes `Sandbox.get({ name })`, so `SandboxHandle.
 * externalId` here holds that deterministic name, not an internal identifier.
 */

import { Sandbox } from '@vercel/sandbox';
import type {
  ExecRequest,
  ExecResult,
  SandboxHandle,
  SandboxProvider,
  SandboxSpec,
  SandboxStatus,
} from '../types';

const WORK_DIR = '/vercel/sandbox/workdir';
const ARCHIVE_PATH = '/vercel/sandbox/state.tar.gz';

/** Longer than any single command timeout so the command, not the VM, times out first. */
const SANDBOX_TIMEOUT_MS = 15 * 60_000;

interface SandboxCredentials {
  token: string;
  teamId: string;
  projectId: string;
}

function explicitCredentials(): SandboxCredentials | null {
  const { VERCEL_TOKEN, VERCEL_TEAM_ID, VERCEL_PROJECT_ID } = process.env;
  if (VERCEL_TOKEN && VERCEL_TEAM_ID && VERCEL_PROJECT_ID) {
    return { token: VERCEL_TOKEN, teamId: VERCEL_TEAM_ID, projectId: VERCEL_PROJECT_ID };
  }
  return null;
}

export function isVercelSandboxConfigured(): boolean {
  return Boolean(explicitCredentials() || process.env.VERCEL_OIDC_TOKEN);
}

/**
 * Deterministic, Vercel-Sandbox-legal name for a workspace's sandbox. Names
 * must be stable across create/reconnect calls for the same workspace, and
 * distinct across workspaces — the workspace id already guarantees both, this
 * just adds a prefix so sandboxes are recognizable as ours in the dashboard.
 */
function sandboxName(workspaceId: string): string {
  return `xantuus-ws-${workspaceId}`;
}

/** Live VM instances, keyed by our own handle id. Only populated within one process's lifetime. */
const liveSandboxes = new Map<string, InstanceType<typeof Sandbox>>();

function buildNetworkPolicy(allowlist: string[]) {
  if (allowlist.length === 0) return 'deny-all' as const;
  return { allow: allowlist };
}

async function writeArchive(sandbox: InstanceType<typeof Sandbox>, archive: Buffer): Promise<void> {
  await sandbox.writeFiles([{ path: ARCHIVE_PATH, content: archive }]);
  const extract = await sandbox.runCommand({
    cmd: 'sh',
    args: ['-c', `mkdir -p ${WORK_DIR} && tar xzf ${ARCHIVE_PATH} -C ${WORK_DIR}`],
    timeoutMs: 60_000,
  });
  if (extract.exitCode !== 0) {
    const stderr = await extract.stderr().catch(() => '');
    throw new Error(`Failed to restore sandbox state (exit ${extract.exitCode}): ${stderr.slice(0, 500)}`);
  }
}

async function provision(workspaceId: string, spec: SandboxSpec): Promise<SandboxHandle> {
  const credentials = explicitCredentials();
  const name = sandboxName(workspaceId);

  const sandbox = await Sandbox.create({
    ...(credentials ?? {}),
    name,
    runtime: 'node24',
    timeout: SANDBOX_TIMEOUT_MS,
    resources: { vcpus: spec.vcpus },
    networkPolicy: buildNetworkPolicy(spec.networkAllowlist),
    env: {},
    tags: { workspaceId: workspaceId.slice(0, 40), specHash: spec.specHash.slice(0, 40) },
    // We manage persistence ourselves via state-archive.ts; leaving this true
    // would additionally snapshot into Vercel's own storage on every stop,
    // duplicating cost and creating a second, unencrypted-by-us copy of
    // tenant filesystem state.
    persistent: false,
  });

  await sandbox.runCommand({ cmd: 'mkdir', args: ['-p', WORK_DIR], timeoutMs: 10_000 });

  if (spec.restoreArchive) {
    await writeArchive(sandbox, spec.restoreArchive);
  }

  const handle: SandboxHandle = { id: workspaceId, externalId: sandbox.name, provider: 'vercel' };
  liveSandboxes.set(handle.id, sandbox);
  return handle;
}

/**
 * Recover a live SDK handle for a sandbox this process didn't itself create —
 * e.g. a heartbeat check running in a different invocation. `resume: false`
 * because we never want the SDK's own snapshot-resume behavior firing; with
 * `persistent: false` there is nothing for it to restore anyway, but being
 * explicit avoids depending on that default.
 */
async function reconnect(handle: SandboxHandle): Promise<InstanceType<typeof Sandbox> | null> {
  const cached = liveSandboxes.get(handle.id);
  if (cached) return cached;
  if (!handle.externalId) return null;

  try {
    const credentials = explicitCredentials();
    const sandbox = await Sandbox.get({
      ...(credentials ?? {}),
      name: handle.externalId,
      resume: false,
    });
    liveSandboxes.set(handle.id, sandbox);
    return sandbox;
  } catch {
    return null;
  }
}

export const vercelSandboxProvider: SandboxProvider = {
  name: 'vercel',

  async create(workspaceId, spec) {
    if (!isVercelSandboxConfigured()) {
      throw new Error(
        'Vercel Sandbox is not configured (no VERCEL_TOKEN/VERCEL_TEAM_ID/VERCEL_PROJECT_ID and no VERCEL_OIDC_TOKEN). ' +
          'Refusing to provision — there is no unsandboxed fallback for compute isolation.'
      );
    }
    return provision(workspaceId, spec);
  },

  async resume(handle, spec) {
    // No native resume in play here (persistent: false) — this is a fresh
    // create() carrying whatever archive the caller loaded via
    // state-archive.ts into spec.restoreArchive.
    return provision(handle.id, spec);
  },

  async suspend(handle) {
    const sandbox = await reconnect(handle);
    if (!sandbox) {
      // Nothing live to tar — treat as "nothing to persist" rather than
      // error, since the caller's next step (destroy) is correct either way.
      return { archiveBytes: null };
    }

    const tarResult = await sandbox.runCommand({
      cmd: 'sh',
      args: ['-c', `mkdir -p ${WORK_DIR} && tar czf ${ARCHIVE_PATH} -C ${WORK_DIR} .`],
      timeoutMs: 60_000,
    });
    if (tarResult.exitCode !== 0) {
      // A workdir that failed to tar (disk pressure, VM already unhealthy) is
      // recoverable by falling back to "nothing to persist" — losing this
      // suspend's state is better than failing the whole suspend/destroy path
      // and leaking a running VM.
      await sandbox.stop().catch(() => {});
      liveSandboxes.delete(handle.id);
      return { archiveBytes: null };
    }

    const archiveBytes = await sandbox.readFileToBuffer({ path: ARCHIVE_PATH });
    await sandbox.stop().catch(() => {});
    liveSandboxes.delete(handle.id);

    return { archiveBytes: archiveBytes ?? null };
  },

  async destroy(handle) {
    const sandbox = await reconnect(handle);
    if (sandbox) {
      await sandbox.stop().catch(() => {});
    }
    liveSandboxes.delete(handle.id);
  },

  async exec(handle, request: ExecRequest): Promise<ExecResult> {
    const sandbox = await reconnect(handle);
    if (!sandbox) {
      throw new Error(`No live sandbox for handle ${handle.id} (name ${handle.externalId ?? 'none'})`);
    }

    const startedAt = Date.now();
    const command = await sandbox.runCommand({
      cmd: request.cmd,
      args: request.args ?? [],
      cwd: request.cwd ?? WORK_DIR,
      env: request.env ?? {},
      timeoutMs: request.timeoutMs,
    });

    const [stdout, stderr] = await Promise.all([
      command.stdout().catch(() => ''),
      command.stderr().catch(() => ''),
    ]);

    return {
      exitCode: command.exitCode,
      stdout,
      stderr,
      durationMs: Date.now() - startedAt,
    };
  },

  async status(handle): Promise<SandboxStatus> {
    const sandbox = await reconnect(handle);
    if (!sandbox) return 'destroyed';

    // Real enum (api-client/validators.ts): pending | running | stopping |
    // stopped | failed | aborted | snapshotting. persistent:false means we
    // should never see 'snapshotting' in practice, but it maps safely if we do.
    switch (sandbox.status) {
      case 'running':
        return 'running';
      case 'stopping':
      case 'snapshotting':
        return 'suspending';
      case 'stopped':
        return 'suspended';
      case 'pending':
        return 'provisioning';
      case 'failed':
      case 'aborted':
      default:
        return 'failed';
    }
  },
};
