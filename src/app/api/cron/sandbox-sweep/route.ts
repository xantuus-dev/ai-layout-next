/**
 * POST /api/cron/sandbox-sweep
 *
 * Orphan sweeper for the sandbox orchestrator. Mandatory, not optional — an
 * orphaned running sandbox is the single most likely source of a surprise
 * bill. Guarded by CRON_SECRET exactly like the other cron endpoints.
 *
 * NOT currently registered in vercel.json: this project is on a Vercel plan
 * that caps crons at 2 total with a once-daily minimum, and both slots were
 * already in use. The sweep runs piggybacked on /api/cron/data-retention's
 * daily schedule instead (see that route) — orphans are caught within ~24h
 * rather than ~5min. This route stays available for manual invocation and
 * for restoring the dedicated fast schedule once the plan allows it:
 *   { "path": "/api/cron/sandbox-sweep", "schedule": "*\/5 * * * *" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
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

  const result = await runSandboxSweep();

  if (result.errors.length > 0) {
    console.error('[sandbox-sweep] Completed with errors:', result.errors);
  }

  return NextResponse.json({ success: true, ...result });
}
