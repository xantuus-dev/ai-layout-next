import { describe, it, expect, vi, beforeEach } from 'vitest';

// The webhook route reads the signature via next/headers' headers(), not
// request.headers — mock it so POST() is callable outside a real Next.js
// request context.
const mockHeaderStore = new Map<string, string>();
vi.mock('next/headers', () => ({
  headers: () => ({
    get: (key: string) => mockHeaderStore.get(key) ?? null,
  }),
}));

import { POST } from '@/app/api/stripe/webhook/route';
import { NextRequest } from 'next/server';

function makeRequest(body: string): NextRequest {
  return new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body,
  });
}

describe('Stripe webhook: signature verification (rejects unauthenticated webhook calls)', () => {
  beforeEach(() => {
    mockHeaderStore.clear();
  });

  it('rejects a request with no stripe-signature header', async () => {
    const response = await POST(makeRequest('{}'));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('No signature');
  });

  it('rejects a request with a forged/invalid signature — this is what stops anyone from POSTing fake "payment succeeded" events to grant themselves credits', async () => {
    mockHeaderStore.set('stripe-signature', 't=1700000000,v1=not_a_real_signature');
    const response = await POST(
      makeRequest(JSON.stringify({ type: 'checkout.session.completed', data: { object: {} } }))
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Invalid signature');
  });
});
