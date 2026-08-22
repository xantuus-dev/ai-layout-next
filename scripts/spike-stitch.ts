/**
 * Phase-0 spike: can we stitch clips inside a network-isolated sandbox?
 *
 * Throwaway measurement script, not production code. It exists to answer one
 * question before any of the real stitching work is written:
 *
 *   Is pushing the clip bytes into the microVM fast enough that the sandbox
 *   never needs network egress?
 *
 * The plan of record (see the stitch scope) is that a `"use step"` function
 * fetches the clips itself — it has full Node access — and hands the bytes to
 * a `networkPolicy: 'deny-all'` sandbox via writeFiles(). That keeps the
 * security posture src/lib/skills/sandbox-runner.ts already established. The
 * only thing that can kill it is transfer cost, so this measures transfer cost.
 *
 * KILL CRITERION: if writeFiles + readFileToBuffer together exceed
 * TRANSFER_BUDGET_MS, abandon the push-bytes approach and switch to a
 * network-permitted sandbox that curls the Blob URLs instead. The two
 * implementations differ by ~30 lines, so switching now is cheap.
 *
 * Deliberately uses the committed showcase clips as fixtures rather than
 * generating anything, so it costs no Veo credits and is repeatable.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/spike-stitch.ts
 *   npx tsx --env-file=.env.local scripts/spike-stitch.ts --keep   # don't stop the VM
 */
import { readFile } from 'fs/promises';
import path from 'path';
import { Sandbox } from '@vercel/sandbox';

/** Snapshot reported to boot with ffmpeg already installed. Overridable because
 *  snapshots can expire — if this ID is gone, that is itself a finding. */
const SNAPSHOT_ID = process.env.FFMPEG_SNAPSHOT_ID ?? 'snap_3GzTGm3JpSaLX2bfRfqthXwFQPSQ';

const WORK = '/vercel/sandbox';

/* The snapshot ships the BtbN static build unpacked into WORK, but never adds
   it to PATH — `ffmpeg` alone fails with executable_not_found. Invoke the
   binaries by absolute path instead of relying on the shell to find them. */
const FFMPEG = `${WORK}/ffmpeg`;
const FFPROBE = `${WORK}/ffprobe`;
const SANDBOX_TIMEOUT_MS = 300_000;
const FFMPEG_TIMEOUT_MS = 120_000;

/** Push + pull budget. Above this, the push-bytes design loses to option B. */
const TRANSFER_BUDGET_MS = 60_000;

/** Fixtures, in concat order. All four are 1280x720 H.264 from Veo, which is
 *  what makes `-c copy` viable — uniform inputs need no re-encode. */
const FIXTURES = ['smoothie', 'cinematic', 'ugc-creator', 'brandstory'];

type Timing = { stage: string; ms: number; note?: string };
const timings: Timing[] = [];

async function timed<T>(stage: string, fn: () => Promise<T>, note?: (r: T) => string): Promise<T> {
  const started = Date.now();
  const result = await fn();
  const ms = Date.now() - started;
  timings.push({ stage, ms, note: note?.(result) });
  console.log(`  ${stage.padEnd(26)} ${String(ms).padStart(7)} ms${note ? `  ${note(result)}` : ''}`);
  return result;
}

function mb(bytes: number): string {
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

/**
 * Mirrors sandbox-runner.ts: explicit credentials win, OIDC is the fallback.
 * Checked up front because an expired OIDC token fails deep inside the SDK
 * with a message that does not mention tokens at all.
 */
function credentials(): Record<string, string> | null {
  const { VERCEL_TOKEN, VERCEL_TEAM_ID, VERCEL_PROJECT_ID } = process.env;
  if (VERCEL_TOKEN && VERCEL_TEAM_ID && VERCEL_PROJECT_ID) {
    return { token: VERCEL_TOKEN, teamId: VERCEL_TEAM_ID, projectId: VERCEL_PROJECT_ID };
  }
  return null;
}

function assertAuthUsable(): void {
  if (credentials()) return;

  const oidc = process.env.VERCEL_OIDC_TOKEN;
  if (!oidc) {
    throw new Error(
      'No sandbox credentials. Set VERCEL_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID in .env.local, ' +
        'or refresh VERCEL_OIDC_TOKEN with `vercel env pull`.'
    );
  }

  // OIDC tokens are short-lived. Decode (not verify) the exp claim so an
  // expired token reports as an expired token.
  try {
    const payload = JSON.parse(Buffer.from(oidc.split('.')[1], 'base64url').toString('utf8'));
    const exp = typeof payload.exp === 'number' ? payload.exp : null;
    if (exp && exp * 1000 < Date.now()) {
      const ago = Math.floor((Date.now() - exp * 1000) / 86_400_000);
      throw new Error(
        `VERCEL_OIDC_TOKEN expired ${ago} day(s) ago. Run \`vercel env pull\` to refresh it, or set ` +
          'VERCEL_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID in .env.local (team/project ids are in .vercel/project.json).'
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('VERCEL_OIDC_TOKEN expired')) throw error;
    // Undecodable token: let the SDK be the judge rather than guessing.
  }
}

async function main() {
  const keep = process.argv.includes('--keep');

  console.log('Phase-0 stitch spike\n');
  assertAuthUsable();

  // ---- Load fixtures -------------------------------------------------------
  const clips: { name: string; buffer: Buffer }[] = [];
  for (const id of FIXTURES) {
    const file = path.join(process.cwd(), 'public', 'showcase', `${id}.mp4`);
    clips.push({ name: id, buffer: await readFile(file) });
  }
  const totalIn = clips.reduce((sum, c) => sum + c.buffer.byteLength, 0);

  console.log('Fixtures:');
  for (const c of clips) console.log(`  ${c.name.padEnd(14)} ${mb(c.buffer.byteLength).padStart(9)}`);
  console.log(`  ${'TOTAL'.padEnd(14)} ${mb(totalIn).padStart(9)}\n`);

  console.log(`Snapshot: ${SNAPSHOT_ID}\n`);
  console.log('Timings:');

  let sandbox: Awaited<ReturnType<typeof Sandbox.create>> | null = null;

  try {
    // ---- Boot --------------------------------------------------------------
    // No `runtime` here on purpose: the SDK types runtime/image as `never`
    // when `source` is a snapshot, because the snapshot fixes the base image.
    sandbox = await timed('01 boot from snapshot', () =>
      Sandbox.create({
        ...(credentials() ?? {}),
        source: { type: 'snapshot', snapshotId: SNAPSHOT_ID },
        timeout: SANDBOX_TIMEOUT_MS,
        resources: { vcpus: 2 },
        // The whole point of the spike: prove stitching works with no egress.
        networkPolicy: 'deny-all',
        env: {},
      } as Parameters<typeof Sandbox.create>[0])
    );

    // ---- Confirm ffmpeg actually shipped in the snapshot -------------------
    const version = await timed(
      '02 ffmpeg -version',
      async () => {
        const cmd = await sandbox!.runCommand({
          cmd: FFMPEG,
          args: ['-version'],
          timeoutMs: 30_000,
        });
        return { exitCode: cmd.exitCode, stdout: await cmd.stdout().catch(() => '') };
      },
      (r) => (r.exitCode === 0 ? r.stdout.split('\n')[0].slice(0, 48) : `EXIT ${r.exitCode}`)
    );

    if (version.exitCode !== 0) {
      throw new Error(
        `ffmpeg not runnable at ${FFMPEG} in snapshot ${SNAPSHOT_ID}. The snapshot may have been ` +
          'rebuilt or expired. This invalidates the no-install assumption — see the scope doc.'
      );
    }

    // ---- Push bytes in -----------------------------------------------------
    const concatList = clips.map((c) => `file '${c.name}.mp4'`).join('\n') + '\n';

    const pushMs = await timed('03 writeFiles (push)', async () => {
      await sandbox!.writeFiles([
        ...clips.map((c) => ({ path: `${WORK}/${c.name}.mp4`, content: c.buffer })),
        { path: `${WORK}/list.txt`, content: Buffer.from(concatList, 'utf8') },
      ]);
      return null;
    });
    void pushMs;

    // ---- Concat ------------------------------------------------------------
    // Stream copy, no re-encode. If this fails on uniform Veo output, the
    // inputs are less uniform than assumed and a normalise pass is needed.
    const concat = await timed(
      '04 ffmpeg concat (-c copy)',
      async () => {
        const cmd = await sandbox!.runCommand({
          cmd: FFMPEG,
          args: ['-y', '-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', 'stitched.mp4'],
          cwd: WORK,
          timeoutMs: FFMPEG_TIMEOUT_MS,
        });
        return { exitCode: cmd.exitCode, stderr: await cmd.stderr().catch(() => '') };
      },
      (r) => (r.exitCode === 0 ? 'ok' : `EXIT ${r.exitCode}`)
    );

    if (concat.exitCode !== 0) {
      throw new Error(`concat failed:\n${concat.stderr.slice(-1200)}`);
    }

    // ---- Verify the result is a real, correctly-long video -----------------
    const probe = await timed(
      '05 ffprobe duration',
      async () => {
        const cmd = await sandbox!.runCommand({
          cmd: FFPROBE,
          args: [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            'stitched.mp4',
          ],
          cwd: WORK,
          timeoutMs: 30_000,
        });
        return { exitCode: cmd.exitCode, out: (await cmd.stdout().catch(() => '')).trim() };
      },
      (r) => (r.exitCode === 0 ? `${r.out}s` : `EXIT ${r.exitCode}`)
    );

    // ---- Pull bytes out ----------------------------------------------------
    const out = await timed(
      '06 readFileToBuffer (pull)',
      () => sandbox!.readFileToBuffer({ path: `${WORK}/stitched.mp4` }),
      (b) => (b ? mb(b.byteLength) : 'NULL')
    );

    if (!out) throw new Error('readFileToBuffer returned nothing — the output file was not produced.');

    // ---- Verdict -----------------------------------------------------------
    const push = timings.find((t) => t.stage.startsWith('03'))!.ms;
    const pull = timings.find((t) => t.stage.startsWith('06'))!.ms;
    const transfer = push + pull;
    const expectedDuration = FIXTURES.length * 8; // every fixture is an 8s clip

    console.log('\n' + '─'.repeat(64));
    console.log('RESULT');
    console.log('─'.repeat(64));
    console.log(`  bytes in           ${mb(totalIn)} across ${clips.length} clips`);
    console.log(`  bytes out          ${mb(out.byteLength)}`);
    console.log(`  duration           ${probe.out || 'unknown'}s (expected ~${expectedDuration}s)`);
    console.log(`  transfer (push+pull) ${transfer} ms   budget ${TRANSFER_BUDGET_MS} ms`);
    console.log(`  total wall         ${timings.reduce((s, t) => s + t.ms, 0)} ms`);
    console.log('');

    const durationOk =
      probe.out !== '' && Math.abs(parseFloat(probe.out) - expectedDuration) < expectedDuration * 0.1;

    if (!durationOk) {
      console.log('  ⚠️  Output duration is not ~the sum of the inputs. Concat may have dropped');
      console.log('      streams — inspect stitched.mp4 before trusting these timings.');
    }

    if (transfer <= TRANSFER_BUDGET_MS) {
      console.log('  ✅ PROCEED with the push-bytes design (option A).');
      console.log('     Sandbox stayed deny-all for the whole run — no egress needed.');
    } else {
      console.log('  ❌ TRANSFER TOO SLOW. Switch to option B: a network-permitted');
      console.log('     sandbox that fetches the Blob URLs itself.');
    }

    console.log('\n  Credit surcharge input: bill from the total wall figure above,');
    console.log('  which replaces the placeholder VIDEO_PIPELINE_STITCHING_SURCHARGE_CREDITS.');
  } finally {
    if (sandbox && !keep) {
      await sandbox.stop().catch((e: unknown) => {
        console.error('  (sandbox stop failed:', e instanceof Error ? e.message : e, ')');
      });
    } else if (sandbox) {
      console.log('\n  --keep: sandbox left running. Stop it from the Vercel dashboard.');
    }
  }
}

main().catch((error) => {
  console.error('\nSPIKE FAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
