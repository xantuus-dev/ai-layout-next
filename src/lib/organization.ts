/**
 * Organization: invoice identity and seat accounting for a team.
 *
 * Team membership and credit pooling already run through `User.billingOwnerId`
 * and `resolveBillingUserId()` in `./credits`. This module does not replace
 * that — it adds the two things owner-pooled billing was missing:
 *
 *   1. an invoice addressed to a company rather than to a person, and
 *   2. a seat count, so buying 20 licences means something.
 *
 * The seat cap is the Stripe subscription item quantity, mirrored onto
 * `Organization.seats` by the subscription webhook.
 */

import { prisma } from '@/lib/prisma';

export interface SeatSummary {
  /** Seats paid for. */
  seats: number;
  /** People currently occupying a seat, including the owner. */
  seatsInUse: number;
  /** Never negative — an over-subscribed team reports 0, not a negative. */
  seatsRemaining: number;
  isFull: boolean;
}

/**
 * Compute seat availability.
 *
 * Pure so seat arithmetic is testable without a database.
 * Exported for testing.
 */
export function summarizeSeats(seats: number, seatsInUse: number): SeatSummary {
  const safeSeats = Math.max(0, Math.floor(seats));
  const safeInUse = Math.max(0, Math.floor(seatsInUse));

  return {
    seats: safeSeats,
    seatsInUse: safeInUse,
    seatsRemaining: Math.max(0, safeSeats - safeInUse),
    isFull: safeInUse >= safeSeats,
  };
}

/**
 * Can one more person be admitted?
 *
 * `null` seats means the team predates the Organization model. Those teams are
 * admitted rather than blocked: introducing seat limits must not lock existing
 * customers out of their own teams. They are enforced once an Organization row
 * exists, which the checkout flow creates.
 * Exported for testing.
 */
export function canAdmitMember(seats: number | null, seatsInUse: number): boolean {
  if (seats === null) return true;
  return !summarizeSeats(seats, seatsInUse).isFull;
}

/**
 * Prisma's "table does not exist in the current database" error.
 * https://www.prisma.io/docs/orm/reference/error-reference#p2021
 */
const TABLE_NOT_FOUND = 'P2021';

function isMissingTableError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === TABLE_NOT_FOUND
  );
}

/**
 * Fetch the organization owned by `ownerId`, if one exists.
 *
 * Returns null when the Organization table has not been migrated yet, so this
 * code can be deployed before its migration runs without taking team invites
 * down: a null organization means "no seat cap" (see `canAdmitMember`), which
 * is exactly the pre-seats behaviour.
 *
 * Only P2021 is swallowed. A connection failure or any other database error
 * still throws — silently treating those as "no organization" would hide real
 * outages behind an unlimited seat allowance.
 */
export async function getOrganization(ownerId: string) {
  try {
    return await prisma.organization.findUnique({ where: { ownerId } });
  } catch (error) {
    if (isMissingTableError(error)) {
      console.warn(
        '[Organization] Table not found — run the pending migration. Seat limits are not being enforced.'
      );
      return null;
    }
    throw error;
  }
}

/**
 * Resolve the billing owner for any user, then their organization.
 * Members reach the org through their owner.
 */
export async function getOrganizationForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { billingOwnerId: true },
  });

  return getOrganization(user?.billingOwnerId || userId);
}

/** Count everyone occupying a seat: the owner plus their pooled members. */
export async function countSeatsInUse(ownerId: string): Promise<number> {
  const members = await prisma.user.count({ where: { billingOwnerId: ownerId } });
  return members + 1; // the owner holds a seat too
}

/** Seat position for a team, or null when the owner has no organization yet. */
export async function getSeatStatus(ownerId: string): Promise<SeatSummary | null> {
  const organization = await getOrganization(ownerId);
  if (!organization) return null;

  return summarizeSeats(organization.seats, await countSeatsInUse(ownerId));
}

/**
 * Whether `ownerId` has room for one more member.
 * Fail-open for teams with no organization row — see `canAdmitMember`.
 */
export async function hasSeatAvailable(ownerId: string): Promise<boolean> {
  const organization = await getOrganization(ownerId);
  return canAdmitMember(
    organization ? organization.seats : null,
    await countSeatsInUse(ownerId)
  );
}

/**
 * Create the organization for a billing owner if absent, otherwise return it.
 * Called when a seat-based subscription is purchased.
 */
export async function ensureOrganization(params: {
  ownerId: string;
  name?: string;
  billingEmail?: string | null;
}) {
  const { ownerId, name, billingEmail } = params;

  const existing = await getOrganization(ownerId);
  if (existing) return existing;

  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { name: true, email: true },
  });

  return prisma.organization.create({
    data: {
      ownerId,
      name: name || owner?.name || owner?.email || 'My organization',
      billingEmail: billingEmail ?? owner?.email ?? null,
      seats: 1,
    },
  });
}

/**
 * Mirror the Stripe subscription quantity onto the organization.
 *
 * Stripe is the source of truth for seats: it is what the customer is billed
 * for, so it must win over anything stored locally. Creates the organization
 * when a team's first seat-based subscription arrives.
 */
export async function syncSeatsFromSubscription(params: {
  ownerId: string;
  quantity: number;
}): Promise<void> {
  const { ownerId, quantity } = params;
  const seats = Math.max(1, Math.floor(quantity));

  await ensureOrganization({ ownerId });

  await prisma.organization.update({
    where: { ownerId },
    data: { seats },
  });
}

/** Update the invoice identity shown on receipts. */
export async function updateBillingProfile(params: {
  ownerId: string;
  name?: string;
  billingEmail?: string | null;
  taxId?: string | null;
}) {
  const { ownerId, ...fields } = params;

  return prisma.organization.update({
    where: { ownerId },
    data: fields,
  });
}
