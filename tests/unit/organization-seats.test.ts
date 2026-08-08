import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUnique = vi.fn();
vi.mock('@/lib/prisma', () => ({
  prisma: { organization: { findUnique: (...args: unknown[]) => findUnique(...args) } },
}));

import { summarizeSeats, canAdmitMember, getOrganization } from '@/lib/organization';

describe('summarizeSeats', () => {
  it('reports remaining seats for a team with room', () => {
    expect(summarizeSeats(20, 12)).toEqual({
      seats: 20,
      seatsInUse: 12,
      seatsRemaining: 8,
      isFull: false,
    });
  });

  it('is full when every seat is taken', () => {
    const summary = summarizeSeats(5, 5);
    expect(summary.isFull).toBe(true);
    expect(summary.seatsRemaining).toBe(0);
  });

  it('never reports negative remaining seats when a team is over-subscribed', () => {
    // Can happen legitimately: an owner downgrades from 10 seats to 3 while
    // 8 people are still on the team.
    const summary = summarizeSeats(3, 8);
    expect(summary.seatsRemaining).toBe(0);
    expect(summary.isFull).toBe(true);
  });

  it('floors fractional input rather than propagating it into seat maths', () => {
    expect(summarizeSeats(5.9, 2.7)).toMatchObject({ seats: 5, seatsInUse: 2 });
  });

  it('clamps negative input to zero', () => {
    expect(summarizeSeats(-3, -1)).toMatchObject({ seats: 0, seatsInUse: 0 });
  });
});

describe('canAdmitMember', () => {
  it('admits when a seat is free', () => {
    expect(canAdmitMember(20, 12)).toBe(true);
  });

  it('refuses when seats are exhausted — this is what stops a team of 1 adding 50 people', () => {
    expect(canAdmitMember(1, 1)).toBe(false);
    expect(canAdmitMember(20, 20)).toBe(false);
  });

  it('refuses an over-subscribed team', () => {
    expect(canAdmitMember(3, 8)).toBe(false);
  });

  it('admits when the team predates the Organization model, so seat limits do not retroactively lock existing customers out', () => {
    expect(canAdmitMember(null, 50)).toBe(true);
  });

  it('treats a zero-seat organization as full rather than unlimited', () => {
    expect(canAdmitMember(0, 0)).toBe(false);
  });
});

describe('getOrganization: tolerating a deploy that lands before its migration', () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it('returns the organization normally', async () => {
    findUnique.mockResolvedValue({ id: 'org1', ownerId: 'u1', seats: 20 });
    await expect(getOrganization('u1')).resolves.toMatchObject({ seats: 20 });
  });

  it('returns null when the table does not exist yet, so invites keep working pre-migration', async () => {
    findUnique.mockRejectedValue(Object.assign(new Error('table not found'), { code: 'P2021' }));
    await expect(getOrganization('u1')).resolves.toBeNull();
  });

  it('rethrows a connection failure rather than silently granting unlimited seats', async () => {
    findUnique.mockRejectedValue(
      Object.assign(new Error("Can't reach database server"), { code: 'P1001' })
    );
    await expect(getOrganization('u1')).rejects.toThrow("Can't reach database server");
  });

  it('rethrows a non-Prisma error', async () => {
    findUnique.mockRejectedValue(new Error('boom'));
    await expect(getOrganization('u1')).rejects.toThrow('boom');
  });
});
