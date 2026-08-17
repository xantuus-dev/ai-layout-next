/**
 * POST /api/cron/data-retention
 *
 * Scheduled enforcement of per-user retention windows (GDPR minimization),
 * plus the sandbox orphan sweep (see lib/sandbox/sweeper.ts) piggybacked onto
 * the same daily run. That sweep belongs on its own 5-minute schedule and has
 * its own route (/api/cron/sandbox-sweep) for exactly that — but this
 * project's Vercel plan caps crons at 2 total with a once-daily minimum, and
 * both existing slots were already spoken for. Folding it in here means an
 * orphaned sandbox is caught within 24h instead of 5min; move it back to its
 * own cron entry in vercel.json once the plan allows more/faster crons.
 *
 * Guarded by CRON_SECRET exactly like the other cron endpoints — Vercel Cron
 * sends `Authorization: Bearer $CRON_SECRET` automatically.
 *
 * Add to vercel.json crons, e.g. daily:
 *   { "path": "/api/cron/data-retention", "schedule": "0 4 * * *" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { purgeExpiredData } from '@/lib/data-retention';
import { runSandboxSweep } from '@/lib/sandbox/sweeper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorizedCron(authHeader: string | null): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : '';
  if (!token) return false;

  const a = Buffer.from(token);
  const b = Buffer.from(cronSecret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (!isAuthorizedCron(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await purgeExpiredData();

  // Independent of retention purge above: a sweep failure must not be
  // mistaken for (or mask) a retention failure, and vice versa.
  let sandboxSweep: Awaited<ReturnType<typeof runSandboxSweep>> | { error: string };
  try {
    sandboxSweep = await runSandboxSweep();
    if (sandboxSweep.errors.length > 0) {
      console.error('[data-retention] Sandbox sweep completed with errors:', sandboxSweep.errors);
    }
  } catch (err) {
    console.error('[data-retention] Sandbox sweep threw:', err);
    sandboxSweep = { error: err instanceof Error ? err.message : String(err) };
  }

  return NextResponse.json({ success: true, ...result, sandboxSweep });
}
