import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { subMonths } from 'date-fns';
import { prisma } from '@/lib/prisma';
import {
  hasEnoughCredits,
  deductCredits,
  checkAndResetCredits,
  getCreditStatus,
  resolveBillingUserId,
} from '@/lib/credits';
import { getOrCreateDefaultWorkspace } from '@/lib/workspace-utils';

// These tests run against the real dev database (see tests/setup.ts) and
// clean up every row they create. They're the only thing standing between
// a change to the credit system and a real customer being over- or
// under-charged, so they exercise the actual Prisma queries, not mocks.

describe('credits.ts — solo user', () => {
  let userId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `test-credits-solo-${Date.now()}-${Math.random()}@example.com`,
        name: 'Solo Test User',
        monthlyCredits: 100,
        creditsUsed: 0,
        plan: 'free',
      },
    });
    userId = user.id;
  });

  afterEach(async () => {
    await prisma.usageRecord.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  it('hasEnoughCredits: true within budget, false over budget', async () => {
    expect(await hasEnoughCredits(userId, 50)).toBe(true);
    expect(await hasEnoughCredits(userId, 150)).toBe(false);
  });

  it('deductCredits: deducts, records usage, and refuses when insufficient', async () => {
    await deductCredits(userId, 40, { type: 'test', description: 'first deduction' });
    let status = await getCreditStatus(userId);
    expect(status?.creditsUsed).toBe(40);

    await expect(
      deductCredits(userId, 100, { type: 'test' })
    ).rejects.toThrow('Insufficient credits');

    // Failed deduction must not have changed the balance
    status = await getCreditStatus(userId);
    expect(status?.creditsUsed).toBe(40);

    const record = await prisma.usageRecord.findFirst({ where: { userId, type: 'test' } });
    expect(record?.credits).toBe(40);
  });

  it('checkAndResetCredits: resets usage once the reset date has passed', async () => {
    await deductCredits(userId, 30, { type: 'test' });
    await prisma.user.update({ where: { id: userId }, data: { creditsResetAt: subMonths(new Date(), 1) } });

    const result = await checkAndResetCredits(userId);
    expect(result?.reset).toBe(true);

    const status = await getCreditStatus(userId);
    expect(status?.creditsUsed).toBe(0);
  });

  it('checkAndResetCredits: does not reset before the reset date', async () => {
    await deductCredits(userId, 30, { type: 'test' });
    const result = await checkAndResetCredits(userId);
    expect(result?.reset).toBe(false);

    const status = await getCreditStatus(userId);
    expect(status?.creditsUsed).toBe(30);
  });

  it('resolveBillingUserId: resolves to itself for a non-pooled user', async () => {
    expect(await resolveBillingUserId(userId)).toBe(userId);
  });
});

describe('credits.ts — team pooling', () => {
  let ownerId: string;
  let memberId: string;
  let workspaceId: string;

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.random()}`;
    const owner = await prisma.user.create({
      data: {
        email: `test-credits-owner-${stamp}@example.com`,
        name: 'Owner',
        monthlyCredits: 100,
        creditsUsed: 0,
        plan: 'pro',
      },
    });
    const member = await prisma.user.create({
      data: {
        email: `test-credits-member-${stamp}@example.com`,
        name: 'Member',
        // Deliberately different from the owner's pool, to prove pooled
        // functions ignore the member's own fields entirely.
        monthlyCredits: 999999,
        creditsUsed: 0,
        plan: 'free',
      },
    });
    ownerId = owner.id;
    memberId = member.id;

    const workspace = await getOrCreateDefaultWorkspace(ownerId);
    workspaceId = workspace.id;

    await prisma.workspaceMember.create({
      data: { workspaceId, userId: memberId, role: 'member', invitedBy: ownerId, joinedAt: new Date() },
    });
    await prisma.user.update({ where: { id: memberId }, data: { billingOwnerId: ownerId } });
  });

  afterEach(async () => {
    await prisma.workspaceMember.deleteMany({ where: { workspaceId } });
    await prisma.usageRecord.deleteMany({ where: { userId: { in: [ownerId, memberId] } } });
    await prisma.workspace.deleteMany({ where: { userId: { in: [ownerId, memberId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, memberId] } } });
  });

  it('resolveBillingUserId: member resolves to the owner', async () => {
    expect(await resolveBillingUserId(memberId)).toBe(ownerId);
    expect(await resolveBillingUserId(ownerId)).toBe(ownerId);
  });

  it("hasEnoughCredits: member is checked against the OWNER's pool, not their own fields", async () => {
    // Owner's pool (100) says no; member's own (unused) field (999999) would say yes —
    // this proves the pool, not the member's own row, is authoritative.
    expect(await hasEnoughCredits(memberId, 150)).toBe(false);
    expect(await hasEnoughCredits(memberId, 90)).toBe(true);
  });

  it("deductCredits: member's spending debits the OWNER's balance, usage record stays attributed to the member", async () => {
    await deductCredits(memberId, 30, { type: 'test_pooled', description: 'pooled spend' });

    const ownerStatus = await getCreditStatus(ownerId);
    expect(ownerStatus?.creditsUsed).toBe(30);

    const memberOwnRow = await prisma.user.findUnique({ where: { id: memberId } });
    expect(memberOwnRow?.creditsUsed).toBe(0); // member's own field untouched

    const record = await prisma.usageRecord.findFirst({ where: { userId: memberId, type: 'test_pooled' } });
    expect(record).not.toBeNull();
    expect((record?.metadata as any)?.billedTo).toBe(ownerId);
  });

  it('getCreditStatus: member sees the pool, not their own fields', async () => {
    const status = await getCreditStatus(memberId);
    expect(status?.monthlyCredits).toBe(100); // owner's, not member's 999999
  });

  it('viewer role: blocked from spending regardless of pool balance', async () => {
    await prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId: memberId } },
      data: { role: 'viewer' },
    });

    expect(await hasEnoughCredits(memberId, 1)).toBe(false);
    await expect(deductCredits(memberId, 1, { type: 'test' })).rejects.toThrow('Insufficient credits');
  });

  it('removing a member from the team stops pooling', async () => {
    await prisma.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId, userId: memberId } } });
    await prisma.user.update({ where: { id: memberId }, data: { billingOwnerId: null } });

    expect(await resolveBillingUserId(memberId)).toBe(memberId);
    // Back to their own (huge) pool
    expect(await hasEnoughCredits(memberId, 999998)).toBe(true);
  });
});
