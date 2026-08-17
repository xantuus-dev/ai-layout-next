import type { ExecResult, SandboxHandle, SandboxProvider, SandboxSpec, SandboxStatus } from '@/lib/sandbox/types';

/**
 * In-memory SandboxProvider fake shared by the contract test suite and the
 * orchestrator integration tests. Real enough to catch orchestrator bugs
 * (double-provisioning under concurrency, spec-hash handling, exec after
 * resume) without a network call or a real sandbox bill per test run.
 */
export class InMemorySandboxProvider implements SandboxProvider {
  readonly name = 'in-memory';
  private sandboxes = new Map<string, { status: SandboxStatus; files: Map<string, Buffer> }>();

  /** Call log, exposed for tests to assert on exactly how many times each op happened. */
  createCalls: string[] = [];
  destroyCalls: string[] = [];

  async create(workspaceId: string, spec: SandboxSpec): Promise<SandboxHandle> {
    this.createCalls.push(workspaceId);
    const files = new Map<string, Buffer>();
    if (spec.restoreArchive) files.set('__archive__', spec.restoreArchive);
    this.sandboxes.set(workspaceId, { status: 'running', files });
    return { id: workspaceId, externalId: `mem-${workspaceId}`, provider: this.name };
  }

  async resume(handle: SandboxHandle, spec: SandboxSpec): Promise<SandboxHandle> {
    return this.create(handle.id, spec);
  }

  async suspend(handle: SandboxHandle): Promise<{ archiveBytes: Buffer | null }> {
    const sandbox = this.sandboxes.get(handle.id);
    if (!sandbox) return { archiveBytes: null };
    sandbox.status = 'suspended';
    return { archiveBytes: sandbox.files.get('__archive__') ?? Buffer.from('state') };
  }

  async destroy(handle: SandboxHandle): Promise<void> {
    this.destroyCalls.push(handle.externalId ?? handle.id);
    this.sandboxes.set(handle.id, { status: 'destroyed', files: new Map() });
  }

  async exec(handle: SandboxHandle): Promise<ExecResult> {
    const sandbox = this.sandboxes.get(handle.id);
    if (!sandbox || sandbox.status !== 'running') {
      throw new Error(`Cannot exec on ${handle.id}: not running`);
    }
    return { exitCode: 0, stdout: 'ok', stderr: '', durationMs: 1 };
  }

  async status(handle: SandboxHandle): Promise<SandboxStatus> {
    return this.sandboxes.get(handle.id)?.status ?? 'destroyed';
  }
}
