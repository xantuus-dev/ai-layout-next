import { describe, it, expect, vi, beforeEach } from 'vitest';

const userFindUnique = vi.fn();
const userUpdate = vi.fn();
const workspaceFindFirst = vi.fn();
const memberFindUnique = vi.fn();
const usageCreate = vi.fn();
const executeRaw = vi.fn();

/**
 * One tx surface shared by both $transaction forms. The callback form is what
 * spendCredits uses; the array form is what refundCredits uses.
 */
const txClient = {
  $executeRaw: (...args: unknown[]) => executeRaw(...args),
  usageRecord: { create: (...args: unknown[]) => usageCreate(...args) },
  user: { update: (...args: unknown[]) => userUpdate(...args) },
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => userFindUnique(...args),
      update: (...args: unknown[]) => userUpdate(...args),
    },
    workspace: { findFirst: (...args: unknown[]) => workspaceFindFirst(...args) },
    workspaceMember: { findUnique: (...args: unknown[]) => memberFindUnique(...args) },
    usageRecord: { create: (...args: unknown[]) => usageCreate(...args) },
    $executeRaw: (...args: unknown[]) => executeRaw(...args),
    $transaction: (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: typeof txClient) => Promise<unknown>)(txClient)
        : Promise.resolve(arg),
  },
}));

import {
  assertCanSpend,
  spendCredits,
  refundCredits,
  InsufficientCreditsError,
  CONFIRMATION_THRESHOLD,
} from '@/lib/billing/gate';

/** resolveBillingUserId reads billingOwnerId first; balance reads come after. */
function mockUser(opts: {
  creditsUsed: number;
  monthlyCredits: number;
  billingOwnerId?: string | null;
}) {
  userFindUnique.mockImplementation(async (args: any) => {
    if (args?.select?.billingOwnerId) return { billingOwnerId: opts.billingOwnerId ?? null };
    return { creditsUsed: opts.creditsUsed, monthlyCredits: opts.monthlyCredits };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  workspaceFindFirst.mockResolvedValue(null);
  memberFindUnique.mockResolvedValue(null);
  usageCreate.mockResolvedValue({});
  userUpdate.mockResolvedValue({});
});

describe('assertCanSpend: the boundary lib/credits.ts still gets wrong', () => {
  it('allows a spend that fits', async () => {
    mockUser({ creditsUsed: 100, monthlyCredits: 4000 });
    const decision = await assertCanSpend('u1', 50);
    expect(decision.allowed).toBe(true);
    expect(decision.remaining).toBe(3900);
  });

  it('refuses a zero-cost action on an exactly exhausted balance', async () => {
    // The defect canAfford was written for: `used + 0 <= monthly` is true at
    // exactly the limit, so a spent account kept being served. hasEnoughCredits
    // still evaluates that expression; this gate must not.
    mockUser({ creditsUsed: 4000, monthlyCredits: 4000 });
    const decision = await assertCanSpend('u1', 0);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('insufficient_credits');
  });

  it('refuses a spend that would cross the limit', async () => {
    mockUser({ creditsUsed: 3999, monthlyCredits: 4000 });
    expect((await assertCanSpend('u1', 6)).allowed).toBe(false);
  });

  it('allows a spend that fits exactly', async () => {
    mockUser({ creditsUsed: 3994, monthlyCredits: 4000 });
    expect((await assertCanSpend('u1', 6)).allowed).toBe(true);
  });

  it('refuses an already overdrawn account and reports negative remaining', async () => {
    mockUser({ creditsUsed: 4500, monthlyCredits: 4000 });
    const decision = await assertCanSpend('u1', 1);
    expect(decision.allowed).toBe(false);
    expect(decision.remaining).toBe(-500);
  });

  it('allows banked credits, which are stored as negative usage', async () => {
    mockUser({ creditsUsed: -500, monthlyCredits: 4000 });
    expect((await assertCanSpend('u1', 6)).allowed).toBe(true);
  });

  it('reports user_not_found rather than throwing', async () => {
    userFindUnique.mockResolvedValue(null);
    const decision = await assertCanSpend('ghost', 10);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('user_not_found');
  });
});

describe('assertCanSpend: pre-flight confirmation', () => {
  it('asks for confirmation when the spend exceeds the threshold of what is left', async () => {
    mockUser({ creditsUsed: 3900, monthlyCredits: 4000 }); // 100 left
    const decision = await assertCanSpend('u1', 30); // 30% of remaining
    expect(decision.allowed).toBe(true);
    expect(decision.requiresConfirmation).toBe(true);
  });

  it('does not ask when the spend is a small slice of a healthy balance', async () => {
    mockUser({ creditsUsed: 0, monthlyCredits: 4000 });
    const decision = await assertCanSpend('u1', 50);
    expect(decision.requiresConfirmation).toBe(false);
  });

  it('does not ask at exactly the threshold, only above it', async () => {
    mockUser({ creditsUsed: 3900, monthlyCredits: 4000 }); // 100 left
    const decision = await assertCanSpend('u1', 100 * CONFIRMATION_THRESHOLD);
    expect(decision.requiresConfirmation).toBe(false);
  });
});

describe('assertCanSpend: team pools', () => {
  it('charges the billing owner pool, not the acting member', async () => {
    userFindUnique.mockImplementation(async (args: any) => {
      if (args?.select?.billingOwnerId) return { billingOwnerId: 'owner-1' };
      return { creditsUsed: 10, monthlyCredits: 4000 };
    });
    const decision = await assertCanSpend('member-1', 5);
    expect(decision.billingUserId).toBe('owner-1');
    expect(decision.allowed).toBe(true);
  });

  it('refuses viewers, who may read shared content but not spend', async () => {
    userFindUnique.mockImplementation(async (args: any) => {
      if (args?.select?.billingOwnerId) return { billingOwnerId: 'owner-1' };
      return { creditsUsed: 0, monthlyCredits: 4000 };
    });
    workspaceFindFirst.mockResolvedValue({ id: 'ws-1' });
    memberFindUnique.mockResolvedValue({ role: 'viewer' });

    const decision = await assertCanSpend('viewer-1', 5);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('viewer_cannot_spend');
  });
});

describe('spendCredits: the check-then-act race is closed', () => {
  it('throws when the guarded UPDATE matches no row', async () => {
    // This is the race: another transaction consumed the headroom between the
    // caller's check and this write. Because the guard lives in the WHERE
    // clause, the loser matches zero rows instead of overdrawing the pool.
    mockUser({ creditsUsed: 3999, monthlyCredits: 4000, billingOwnerId: null });
    executeRaw.mockResolvedValue(0);

    await expect(spendCredits('u1', 10, { type: 'chat' })).rejects.toBeInstanceOf(
      InsufficientCreditsError
    );
  });

  it('does not write a usage row when the guard rejects the spend', async () => {
    mockUser({ creditsUsed: 4000, monthlyCredits: 4000, billingOwnerId: null });
    executeRaw.mockResolvedValue(0);

    await expect(spendCredits('u1', 5, { type: 'chat' })).rejects.toThrow();
    expect(usageCreate).not.toHaveBeenCalled();
  });

  it('records usage when the guarded UPDATE succeeds', async () => {
    mockUser({ creditsUsed: 0, monthlyCredits: 4000, billingOwnerId: null });
    executeRaw.mockResolvedValue(1);

    const result = await spendCredits('u1', 25, { type: 'chat', model: 'sonnet', tokens: 900 });

    expect(result.creditsSpent).toBe(25);
    expect(usageCreate).toHaveBeenCalledOnce();
    expect(usageCreate.mock.calls[0][0].data).toMatchObject({
      userId: 'u1',
      type: 'chat',
      model: 'sonnet',
      tokens: 900,
      credits: 25,
    });
  });

  it('attributes usage to the actor while billing the owner', async () => {
    userFindUnique.mockImplementation(async (args: any) => {
      if (args?.select?.billingOwnerId) return { billingOwnerId: 'owner-1' };
      return { creditsUsed: 0, monthlyCredits: 4000 };
    });
    executeRaw.mockResolvedValue(1);

    const result = await spendCredits('member-1', 10, { type: 'chat' });

    expect(result.billingUserId).toBe('owner-1');
    expect(usageCreate.mock.calls[0][0].data.userId).toBe('member-1');
    expect(usageCreate.mock.calls[0][0].data.metadata.billedTo).toBe('owner-1');
  });

  it('refuses viewers before touching the balance at all', async () => {
    userFindUnique.mockImplementation(async (args: any) => {
      if (args?.select?.billingOwnerId) return { billingOwnerId: 'owner-1' };
      return { creditsUsed: 0, monthlyCredits: 4000 };
    });
    workspaceFindFirst.mockResolvedValue({ id: 'ws-1' });
    memberFindUnique.mockResolvedValue({ role: 'viewer' });

    await expect(spendCredits('viewer-1', 5, { type: 'chat' })).rejects.toBeInstanceOf(
      InsufficientCreditsError
    );
    expect(executeRaw).not.toHaveBeenCalled();
  });
});

describe('spendCredits: parity with deductCredits', () => {
  // deductCredits rolls the monthly window before charging and fires the
  // 80%/100% alert emails after. Callers were switched from one to the other,
  // so dropping either would silently regress billing behaviour.
  it('rolls the monthly window before charging', async () => {
    mockUser({ creditsUsed: 0, monthlyCredits: 4000, billingOwnerId: null });
    executeRaw.mockResolvedValue(1);

    await spendCredits('u1', 10, { type: 'chat' });

    expect(checkAndResetCredits).toHaveBeenCalledWith('u1');
  });

  it('fires usage alerts against the billing owner after a successful spend', async () => {
    userFindUnique.mockImplementation(async (args: any) => {
      if (args?.select?.billingOwnerId) return { billingOwnerId: 'owner-1' };
      return { creditsUsed: 0, monthlyCredits: 4000 };
    });
    executeRaw.mockResolvedValue(1);

    await spendCredits('member-1', 10, { type: 'chat' });

    expect(checkUsageAlerts).toHaveBeenCalledWith('owner-1');
  });

  it('does not fire alerts when the spend was refused', async () => {
    mockUser({ creditsUsed: 4000, monthlyCredits: 4000, billingOwnerId: null });
    executeRaw.mockResolvedValue(0);

    await expect(spendCredits('u1', 10, { type: 'chat' })).rejects.toThrow();
    expect(checkUsageAlerts).not.toHaveBeenCalled();
  });
});

describe('refundCredits: append-only correction', () => {
  it('appends a negative offsetting row rather than mutating the original', async () => {
    mockUser({ creditsUsed: 100, monthlyCredits: 4000, billingOwnerId: null });

    const result = await refundCredits('u1', 40, 'run_failed', { runId: 'task-9' });

    expect(result.creditsRefunded).toBe(40);
    expect(usageCreate.mock.calls[0][0].data).toMatchObject({
      userId: 'u1',
      type: 'refund',
      credits: -40,
    });
    expect(usageCreate.mock.calls[0][0].data.metadata).toMatchObject({
      reason: 'run_failed',
      runId: 'task-9',
    });
  });

  it('decrements the billing owner balance', async () => {
    mockUser({ creditsUsed: 100, monthlyCredits: 4000, billingOwnerId: null });
    await refundCredits('u1', 40, 'run_timeout');
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { creditsUsed: { decrement: 40 } },
    });
  });

  it('rejects a non-positive refund, which would be a silent charge', async () => {
    mockUser({ creditsUsed: 100, monthlyCredits: 4000, billingOwnerId: null });
    await expect(refundCredits('u1', 0, 'run_failed')).rejects.toThrow(/must be positive/);
    await expect(refundCredits('u1', -10, 'run_failed')).rejects.toThrow(/must be positive/);
  });
});
