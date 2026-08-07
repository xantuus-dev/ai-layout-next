import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

// The route pulls in Prisma/Slack/Sentry at import time; none of them are
// reachable in these tests because every case is rejected (or answered by the
// url_verification handshake) before the handler touches the database.
vi.mock('@/lib/prisma', () => ({ prisma: { integration: { findFirst: vi.fn() } } }));
vi.mock('@/lib/slack-oauth', () => ({ postSlackMessage: vi.fn() }));
vi.mock('@/lib/sentry', () => ({ captureAPIError: vi.fn() }));

import { POST } from '@/app/api/integrations/slack/events/route';
import { NextRequest } from 'next/server';

const SIGNING_SECRET = 'test-signing-secret';

function sign(body: string, timestamp: number, secret = SIGNING_SECRET): string {
  return (
    'v0=' +
    crypto.createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex')
  );
}

function makeRequest(body: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/integrations/slack/events', {
    method: 'POST',
    body,
    headers,
  });
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

describe('Slack events: signature verification (rejects forged inbound events)', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_SIGNING_SECRET', SIGNING_SECRET);
    vi.stubEnv('NODE_ENV', 'production');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects a request with no signature headers', async () => {
    const response = await POST(makeRequest('{}'));
    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe('Invalid signature');
  });

  it('rejects a forged signature — this is what stops anyone who knows the URL from POSTing events as any workspace', async () => {
    const body = JSON.stringify({ type: 'event_callback', team_id: 'T123' });
    const response = await POST(
      makeRequest(body, {
        'x-slack-signature': 'v0=' + '0'.repeat(64),
        'x-slack-request-timestamp': String(nowSeconds()),
      })
    );
    expect(response.status).toBe(401);
  });

  it('rejects a signature computed with the wrong secret', async () => {
    const body = JSON.stringify({ type: 'event_callback', team_id: 'T123' });
    const timestamp = nowSeconds();
    const response = await POST(
      makeRequest(body, {
        'x-slack-signature': sign(body, timestamp, 'attacker-secret'),
        'x-slack-request-timestamp': String(timestamp),
      })
    );
    expect(response.status).toBe(401);
  });

  it('rejects a correctly signed request whose timestamp is stale, so a captured payload cannot be replayed', async () => {
    const body = JSON.stringify({ type: 'event_callback', team_id: 'T123' });
    const staleTimestamp = nowSeconds() - 60 * 10;
    const response = await POST(
      makeRequest(body, {
        'x-slack-signature': sign(body, staleTimestamp),
        'x-slack-request-timestamp': String(staleTimestamp),
      })
    );
    expect(response.status).toBe(401);
  });

  it('rejects a valid signature replayed against a modified body', async () => {
    const originalBody = JSON.stringify({ type: 'event_callback', team_id: 'T123' });
    const timestamp = nowSeconds();
    const signature = sign(originalBody, timestamp);

    const tamperedBody = JSON.stringify({ type: 'event_callback', team_id: 'T-EVIL' });
    const response = await POST(
      makeRequest(tamperedBody, {
        'x-slack-signature': signature,
        'x-slack-request-timestamp': String(timestamp),
      })
    );
    expect(response.status).toBe(401);
  });

  it('fails closed in production when SLACK_SIGNING_SECRET is not configured', async () => {
    vi.stubEnv('SLACK_SIGNING_SECRET', '');
    const body = JSON.stringify({ type: 'event_callback', team_id: 'T123' });
    const timestamp = nowSeconds();
    const response = await POST(
      makeRequest(body, {
        'x-slack-signature': sign(body, timestamp),
        'x-slack-request-timestamp': String(timestamp),
      })
    );
    expect(response.status).toBe(401);
  });

  it('accepts a correctly signed url_verification handshake and echoes the challenge', async () => {
    const body = JSON.stringify({ type: 'url_verification', challenge: 'abc123' });
    const timestamp = nowSeconds();
    const response = await POST(
      makeRequest(body, {
        'x-slack-signature': sign(body, timestamp),
        'x-slack-request-timestamp': String(timestamp),
      })
    );
    expect(response.status).toBe(200);
    expect((await response.json()).challenge).toBe('abc123');
  });
});
