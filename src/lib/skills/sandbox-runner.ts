/**
 * Isolated execution of user-authored JavaScript skills.
 *
 * Every run gets its own ephemeral Vercel Sandbox microVM, which is destroyed
 * when the run finishes. Nothing is shared between runs or between tenants.
 *
 * This exists to satisfy the conditions written into executeJavaScriptSkill()
 * when JavaScript skills were disabled: the code must run in a real
 * out-of-process isolate with no ambient environment. The relevant properties:
 *
 *  - Separate microVM, so `process.env` of the web app (API keys, DATABASE_URL,
 *    NEXTAUTH_SECRET) is structurally absent rather than merely hidden. This is
 *    the property the in-process AsyncFunction approach could never have.
 *  - `networkPolicy: 'deny-all'`, so skill code cannot reach the internet, our
 *    own API, or the database — no exfiltration path even for data it is given.
 *  - The result is read back from a file, not parsed out of stdout, so code
 *    that prints to stdout cannot forge or corrupt its own result.
 *  - Wall-clock limits at both the sandbox and command level, and a cap on
 *    result size.
 *
 * Fails closed: with no sandbox credentials configured, execution is refused
 * rather than falling back to running the code in this process.
 */

import { Sandbox } from '@vercel/sandbox';

/** Where the harness and its inputs live inside the VM. */
const WORK_DIR = '/vercel/sandbox';
const RESULT_PATH = `${WORK_DIR}/result.json`;

/** Wall-clock ceiling for the user's code itself. */
const DEFAULT_CODE_TIMEOUT_MS = 30_000;

/**
 * Ceiling for the whole VM. Deliberately longer than the code timeout so that
 * the command-level timeout fires first and we can report "your code timed
 * out" instead of the VM vanishing underneath us.
 */
const SANDBOX_TIMEOUT_MS = 120_000;

/** Largest JSON result we will carry back out of the VM. */
const MAX_RESULT_BYTES = 256 * 1024;

/** Largest skill body we will even attempt to run. */
const MAX_CODE_BYTES = 512 * 1024;

/** Console lines captured per run; beyond this, output is dropped. */
const MAX_LOG_LINES = 200;

export interface SandboxRunOptions {
  /** The user-authored skill body. */
  code: string;
  /** Values exposed to the code as `input`. */
  input: Record<string, unknown>;
  /** Override the default code timeout. */
  timeoutMs?: number;
  /** Tags attached to the VM for attribution in the Vercel dashboard. */
  tags?: Record<string, string>;
}

export interface SandboxRunResult {
  output: unknown;
  logs: string[];
  durationMs: number;
}

/**
 * Raised when the skill's own code fails, as opposed to the sandbox
 * infrastructure failing. Callers surface this to the skill author.
 */
export class SkillCodeError extends Error {
  readonly logs: string[];

  constructor(message: string, logs: string[] = []) {
    super(message);
    this.name = 'SkillCodeError';
    this.logs = logs;
  }
}

/**
 * The harness that runs inside the VM.
 *
 * It writes its outcome to result.json rather than stdout: the skill body may
 * print anything it likes, and we must not let that be mistaken for the result.
 *
 * Kept as a plain string (not a file on disk) so it ships with the serverless
 * bundle without needing includeFiles configuration.
 */
const RUNNER_SOURCE = String.raw`
const fs = require('node:fs');

const WORK_DIR = __dirname;
const MAX_LOG_LINES = ${MAX_LOG_LINES};

const logs = [];
function capture(...args) {
  if (logs.length >= MAX_LOG_LINES) return;
  try {
    logs.push(
      args
        .map((a) => (typeof a === 'string' ? a : require('node:util').inspect(a, { depth: 2 })))
        .join(' ')
        .slice(0, 2000)
    );
  } catch {
    logs.push('[unserialisable log argument]');
  }
}

const sandboxConsole = { log: capture, info: capture, warn: capture, error: capture, debug: capture };
console.log = capture;
console.info = capture;
console.warn = capture;
console.error = capture;
console.debug = capture;

function write(payload) {
  fs.writeFileSync(WORK_DIR + '/result.json', JSON.stringify(payload));
}

(async () => {
  try {
    const code = fs.readFileSync(WORK_DIR + '/user-code.js', 'utf8');
    const input = JSON.parse(fs.readFileSync(WORK_DIR + '/input.json', 'utf8'));

    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const fn = new AsyncFunction('input', 'console', code);
    const output = await fn(input, sandboxConsole);

    let serialised;
    try {
      serialised = JSON.stringify({ ok: true, output: output === undefined ? null : output, logs });
    } catch (err) {
      write({ ok: false, message: 'Skill returned a value that cannot be serialised to JSON', logs });
      return;
    }

    if (Buffer.byteLength(serialised, 'utf8') > ${MAX_RESULT_BYTES}) {
      write({ ok: false, message: 'Skill result exceeds the ${Math.floor(MAX_RESULT_BYTES / 1024)}KB limit', logs });
      return;
    }

    fs.writeFileSync(WORK_DIR + '/result.json', serialised);
  } catch (err) {
    write({
      ok: false,
      message: err && err.message ? String(err.message) : String(err),
      stack: err && err.stack ? String(err.stack).slice(0, 4000) : undefined,
      logs,
    });
  }
})();
`;

interface SandboxCredentials {
  token: string;
  teamId: string;
  projectId: string;
}

/**
 * Explicit credentials, when present.
 *
 * On Vercel the SDK authenticates through VERCEL_OIDC_TOKEN automatically and
 * this returns nothing, which is the normal production path. The explicit
 * triple is for local development.
 */
function explicitCredentials(): SandboxCredentials | null {
  const { VERCEL_TOKEN, VERCEL_TEAM_ID, VERCEL_PROJECT_ID } = process.env;

  if (VERCEL_TOKEN && VERCEL_TEAM_ID && VERCEL_PROJECT_ID) {
    return {
      token: VERCEL_TOKEN,
      teamId: VERCEL_TEAM_ID,
      projectId: VERCEL_PROJECT_ID,
    };
  }

  return null;
}

/**
 * Whether isolated execution is available.
 *
 * Both a kill switch and a credentials check. The credentials half is the one
 * that matters: without it there is no isolate, and the only alternatives are
 * refusing to run or running in-process — and running in-process is the
 * vulnerability this module exists to close.
 */
export function isSandboxConfigured(): boolean {
  if (process.env.SKILLS_JS_EXECUTION_ENABLED === 'false') return false;

  return Boolean(explicitCredentials() || process.env.VERCEL_OIDC_TOKEN);
}

/** Why execution is unavailable, for an actionable error message. */
export function sandboxUnavailableReason(): string | null {
  if (process.env.SKILLS_JS_EXECUTION_ENABLED === 'false') {
    return 'JavaScript skill execution is disabled (SKILLS_JS_EXECUTION_ENABLED=false).';
  }

  if (!explicitCredentials() && !process.env.VERCEL_OIDC_TOKEN) {
    return 'JavaScript skills require an execution sandbox, which is not configured on this deployment.';
  }

  return null;
}

/**
 * Pull the runnable body out of a skill's stored definition.
 *
 * skillDefinition is a Json column and has been written in more than one shape
 * over the life of the marketplace, so accept the known ones and reject the
 * rest rather than coercing something unrunnable into the VM.
 */
export function extractSkillCode(skillDefinition: unknown): string {
  const raw =
    typeof skillDefinition === 'string'
      ? skillDefinition
      : typeof skillDefinition === 'object' && skillDefinition !== null
        ? (skillDefinition as Record<string, unknown>).code
        : undefined;

  if (typeof raw !== 'string' || !raw.trim()) {
    throw new SkillCodeError(
      'This skill has no JavaScript body to execute (expected skillDefinition.code).'
    );
  }

  if (Buffer.byteLength(raw, 'utf8') > MAX_CODE_BYTES) {
    throw new SkillCodeError(
      `Skill body exceeds the ${Math.floor(MAX_CODE_BYTES / 1024)}KB limit.`
    );
  }

  return raw;
}

/**
 * Interpret what the harness wrote to result.json.
 *
 * Separated from the sandbox plumbing so the parsing rules are unit-testable
 * without provisioning a VM.
 */
export function parseRunnerResult(raw: string): { output: unknown; logs: string[] } {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Sandbox returned a malformed result.');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Sandbox returned a malformed result.');
  }

  const payload = parsed as Record<string, unknown>;
  const logs = Array.isArray(payload.logs) ? payload.logs.map(String) : [];

  if (payload.ok === true) {
    return { output: payload.output ?? null, logs };
  }

  throw new SkillCodeError(
    typeof payload.message === 'string' ? payload.message : 'Skill execution failed.',
    logs
  );
}

/**
 * Run a skill body in a fresh, network-isolated microVM.
 *
 * Throws SkillCodeError when the skill's own code is at fault (threw, timed
 * out, returned something unserialisable) and a plain Error when the sandbox
 * infrastructure itself failed.
 */
export async function runUserCode(
  options: SandboxRunOptions
): Promise<SandboxRunResult> {
  const unavailable = sandboxUnavailableReason();
  if (unavailable) throw new Error(unavailable);

  const codeTimeoutMs = options.timeoutMs ?? DEFAULT_CODE_TIMEOUT_MS;
  const credentials = explicitCredentials();
  const startedAt = Date.now();

  const sandbox = await Sandbox.create({
    ...(credentials ?? {}),
    runtime: 'node24',
    timeout: SANDBOX_TIMEOUT_MS,
    resources: { vcpus: 1 },
    // No egress. Skill code gets its `input` and nothing else — it cannot reach
    // our API, the database, or any third party, so there is no route by which
    // the data it is handed can leave.
    networkPolicy: 'deny-all',
    // Deliberately empty: nothing from this process's environment crosses into
    // the VM.
    env: {},
    ...(options.tags ? { tags: options.tags } : {}),
  });

  try {
    await sandbox.writeFiles([
      {
        path: `${WORK_DIR}/runner.js`,
        content: Buffer.from(RUNNER_SOURCE, 'utf8'),
      },
      {
        path: `${WORK_DIR}/user-code.js`,
        content: Buffer.from(options.code, 'utf8'),
      },
      {
        path: `${WORK_DIR}/input.json`,
        content: Buffer.from(JSON.stringify(options.input ?? {}), 'utf8'),
      },
    ]);

    const command = await sandbox.runCommand({
      cmd: 'node',
      args: ['runner.js'],
      cwd: WORK_DIR,
      env: {},
      timeoutMs: codeTimeoutMs,
    });

    const resultBuffer = await sandbox.readFileToBuffer({ path: RESULT_PATH });

    if (!resultBuffer) {
      // No result file: the process was killed before it could write one. A
      // SIGKILL from the command timeout is by far the likeliest cause.
      const stderr = await command.stderr().catch(() => '');

      throw new SkillCodeError(
        command.exitCode === 0
          ? 'Skill finished without producing a result.'
          : `Skill did not complete within ${Math.floor(codeTimeoutMs / 1000)}s or exited abnormally (exit code ${command.exitCode}).${
              stderr ? ` ${stderr.slice(0, 500)}` : ''
            }`
      );
    }

    if (resultBuffer.byteLength > MAX_RESULT_BYTES) {
      throw new SkillCodeError(
        `Skill result exceeds the ${Math.floor(MAX_RESULT_BYTES / 1024)}KB limit.`
      );
    }

    const { output, logs } = parseRunnerResult(resultBuffer.toString('utf8'));

    return { output, logs, durationMs: Date.now() - startedAt };
  } finally {
    // Best effort: a leaked VM costs money and outlives the request, but it
    // also expires on its own via the sandbox timeout, so a failure here must
    // not mask the real error.
    await sandbox.stop().catch((err: unknown) => {
      console.error('[sandbox-runner] Failed to stop sandbox:', err);
    });
  }
}
