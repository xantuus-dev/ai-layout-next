/**
 * POST /api/cron/data-retention
 *
 * Scheduled enforcement of per-user retention windows (GDPR minimization).
 * Guarded by CRON_SECRET exactly like the other cron endpoints — Vercel Cron
 * sends `Authorization: Bearer $CRON_SECRET` automatically.
 *
 * Add to vercel.json crons, e.g. daily:
 *   { "path": "/api/cron/data-retention", "schedule": "0 4 * * *" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { purgeExpiredData } from '@/lib/data-retention';

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
  return NextResponse.json({ success: true, ...result });
}
