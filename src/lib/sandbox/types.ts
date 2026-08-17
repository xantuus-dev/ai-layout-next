/**
 * Provider-agnostic sandbox lifecycle contract.
 *
 * Nothing outside src/lib/sandbox/providers/* may import a vendor SDK
 * directly — every call into a sandbox goes through this interface so
 * swapping providers (or adding a second one) never touches the
 * orchestrator, the lease model, or any route handler.
 */

export type SandboxStatus =
  | 'provisioning'
  | 'running'
  | 'suspending'
  | 'suspended'
  | 'destroyed'
  | 'failed';

export interface SandboxSpec {
  /** Deterministic hash of this spec; a mismatch against the stored sandbox forces a rebuild. */
  specHash: string;
  vcpus: number;
  memoryMb?: number;
  /** Deny-by-default is the only acceptable default; callers must opt into egress explicitly. */
  networkAllowlist: string[];
  /**
   * Plaintext tar.gz of the workdir to restore into the fresh VM, when
   * present. Encryption at rest is handled entirely outside this interface
   * (see state-archive.ts) — providers only ever see plaintext bytes, in
   * memory, for the duration of one create/resume or suspend call.
   */
  restoreArchive?: Buffer | null;
}

export interface SandboxHandle {
  /**
   * The workspace id — every provider keys its live-instance lookups on
   * whatever id was passed to create()/resume(), which is always the
   * workspace id, not WorkspaceSandbox's own database row id. Stable across
   * suspend/resume.
   */
  id: string;
  /** The provider's own identifier for the live VM. Null while suspended/destroyed. */
  externalId: string | null;
  provider: string;
}

export interface ExecRequest {
  cmd: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs: number;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

/**
 * A provider must implement every method below. create/resume return a fresh
 * handle; suspend/destroy accept the current one. Implementations own their
 * own vendor SDK and must fail closed (throw) rather than silently no-op when
 * credentials or configuration are missing — see sandbox-runner.ts's
 * isSandboxConfigured() precedent for why: falling back to unsandboxed
 * execution is the vulnerability this interface exists to prevent.
 */
export interface SandboxProvider {
  readonly name: string;

  create(workspaceId: string, spec: SandboxSpec): Promise<SandboxHandle>;

  /**
   * Bring a suspended sandbox back to 'running'. Providers with no native
   * resume (e.g. Vercel Sandbox) implement this as create() + restore spec's
   * restoreArchive; providers with native resume use it directly.
   */
  resume(handle: SandboxHandle, spec: SandboxSpec): Promise<SandboxHandle>;

  /**
   * Bring a running sandbox to 'suspended'. Returns the plaintext tar.gz of
   * the workdir for the caller to encrypt and persist (see state-archive.ts),
   * or null if the provider has nothing worth persisting (e.g. an empty or
   * already-destroyed workdir).
   */
  suspend(handle: SandboxHandle): Promise<{ archiveBytes: Buffer | null }>;

  destroy(handle: SandboxHandle): Promise<void>;

  exec(handle: SandboxHandle, request: ExecRequest): Promise<ExecResult>;

  status(handle: SandboxHandle): Promise<SandboxStatus>;
}
