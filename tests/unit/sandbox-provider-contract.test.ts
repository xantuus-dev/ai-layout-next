import { describe, it, expect, beforeEach } from 'vitest';
import type { SandboxProvider, SandboxSpec } from '@/lib/sandbox/types';
import { InMemorySandboxProvider } from '../helpers/in-memory-sandbox-provider';

/**
 * Contract test suite for SandboxProvider — runnable against any
 * implementation, so swapping vendors (or verifying a new one) is a matter of
 * pointing runProviderContractTests() at the adapter, not writing new tests.
 *
 * The Vercel adapter itself isn't exercised here: it talks to a real
 * provisioning API and costs real money per run, which is wrong for a suite
 * that runs on every CI push. It's exercised via the in-memory fake, which
 * implements the same interface faithfully enough to catch orchestrator bugs
 * (double-create under concurrency, spec-hash handling, exec after resume)
 * without touching the network — see tests/helpers/in-memory-sandbox-provider.ts.
 */
function runProviderContractTests(name: string, makeProvider: () => SandboxProvider) {
  describe(`SandboxProvider contract: ${name}`, () => {
    let provider: SandboxProvider;
    const spec: SandboxSpec = { specHash: 'v1:none', vcpus: 1, networkAllowlist: [] };

    beforeEach(() => {
      provider = makeProvider();
    });

    it('create() returns a handle usable immediately for exec', async () => {
      const handle = await provider.create('ws-1', spec);
      expect(handle.id).toBe('ws-1');
      await expect(provider.exec(handle, { cmd: 'echo', args: ['hi'], timeoutMs: 1000 })).resolves.toMatchObject({
        exitCode: 0,
      });
    });

    it('status() reflects running after create, suspended after suspend, destroyed after destroy', async () => {
      const handle = await provider.create('ws-2', spec);
      expect(await provider.status(handle)).toBe('running');

      await provider.suspend(handle);
      expect(await provider.status(handle)).toBe('suspended');

      await provider.destroy(handle);
      expect(await provider.status(handle)).toBe('destroyed');
    });

    it('suspend() then resume() with the returned archive round-trips without error', async () => {
      const handle = await provider.create('ws-3', spec);
      const { archiveBytes } = await provider.suspend(handle);

      const resumed = await provider.resume(handle, { ...spec, restoreArchive: archiveBytes });
      expect(await provider.status(resumed)).toBe('running');
      await expect(provider.exec(resumed, { cmd: 'echo', timeoutMs: 1000 })).resolves.toMatchObject({ exitCode: 0 });
    });

    it('exec() on a destroyed sandbox throws rather than silently succeeding', async () => {
      const handle = await provider.create('ws-4', spec);
      await provider.destroy(handle);
      await expect(provider.exec(handle, { cmd: 'echo', timeoutMs: 1000 })).rejects.toThrow();
    });
  });
}

runProviderContractTests('in-memory fake', () => new InMemorySandboxProvider());
