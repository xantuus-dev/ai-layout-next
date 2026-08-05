import type { Session } from 'next-auth';

/**
 * Coarse admin check: a single email address configured via ADMIN_EMAIL.
 * There is no admin role/permission system yet — this is a placeholder
 * until one exists (see api/admin/templates/route.ts for the original,
 * duplicated version of this same check).
 */
export function isAdmin(session: Session | null): boolean {
  return !!session?.user?.email && session.user.email === process.env.ADMIN_EMAIL;
}
