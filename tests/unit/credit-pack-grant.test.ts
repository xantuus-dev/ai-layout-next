import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * grantPurchasedCredits must resolve the amount from the price the customer
 * paid, never from anything a caller supplies.
 *
 * The bug this replaces: the handler took a credit count that the webhook read
 * out of checkout session metadata, which the checkout route copied from a
 * request body. Buying the $8 / 1,000-credit pack while asking for a million
 * credits granted a million credits.
 */

const { userUpdate, usageCreate } = vi.hoisted(() => {
  // pricing-config reads these at module load, and vi.hoisted runs before the
  // imports below, so the pack catalog is populated by the time it is read.
  process.env.NEXT_PUBLIC_STRIPE_CREDITPACK_1000_PRICE_ID = 'price_pack_1000';
  process.env.NEXT_PUBLIC_STRIPE_CREDITPACK_5000_PRICE_ID = 'price_pack_5000';
  process.env.NEXT_PUBLIC_STRIPE_CREDITPACK_20000_PRICE_ID = 'price_pack_20000';

  return { userUpdate: vi.fn(), usageCreate: vi.fn() };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { update: userUpdate },
    usageRecord: { create: usageCreate },
    $transaction: (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]),
  },
}));

import { grantPurchasedCredits } from '@/lib/stripe-webhook-handlers';
import { CREDIT_PACK_PRICES } from '@/lib/pricing-config';

/** What the decrement of creditsUsed was called with, or null if never called. */
function grantedCredits(): number | null {
  if (userUpdate.mock.calls.length === 0) return null;
  return userUpdate.mock.calls[0][0].data.creditsUsed.decrement;
}

beforeEach(() => {
  vi.clearAllMocks();
  userUpdate.mockResolvedValue({});
  usageCreate.mockResolvedValue({});
});

describe('grantPurchasedCredits', () => {
  it('grants exactly what the catalog says the purchased price is worth', async () => {
    for (const pack of CREDIT_PACK_PRICES) {
      vi.clearAllMocks();

      await grantPurchasedCredits('user_1', pack.priceId!);

      expect(grantedCredits(), `${pack.displayName} (${pack.priceId})`).toBe(pack.credits);
    }
  });

  it('records the price on the usage row so a grant can be traced to a payment', async () => {
    await grantPurchasedCredits('user_1', 'price_pack_5000');

    expect(usageCreate).toHaveBeenCalledTimes(1);
    const row = usageCreate.mock.calls[0][0].data;
    expect(row.type).toBe('credit_purchase');
    expect(row.credits).toBe(-5000); // negative = added
    expect(row.metadata).toMatchObject({ priceId: 'price_pack_5000' });
  });

  it('grants nothing for a price that is not a configured pack', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    await grantPurchasedCredits('user_1', 'price_not_in_catalog');

    expect(grantedCredits()).toBeNull();
    expect(usageCreate).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalled();
    errorLog.mockRestore();
  });

  it('grants nothing when no price is supplied at all', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    await grantPurchasedCredits('user_1', undefined);

    expect(grantedCredits()).toBeNull();
    errorLog.mockRestore();
  });

  it('grants nothing without a user', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    await grantPurchasedCredits(undefined, 'price_pack_20000');

    expect(grantedCredits()).toBeNull();
    errorLog.mockRestore();
  });

  it('cannot be handed an arbitrary credit amount', async () => {
    // The regression guard, expressed at the type level: the second parameter
    // is a price id. Passing a number where the old signature took one now
    // resolves to "not a configured pack" and grants nothing, rather than
    // being honoured as a credit count.
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    await grantPurchasedCredits('user_1', '1000000' as unknown as string);

    expect(grantedCredits()).toBeNull();
    errorLog.mockRestore();
  });
});
