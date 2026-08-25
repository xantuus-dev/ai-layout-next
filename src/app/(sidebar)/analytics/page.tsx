'use client';

/**
 * Analytics — the destination the sidebar's "Analytics" item points at.
 *
 * The same dashboard is also reachable as the Usage tab inside Settings. This
 * route exists because the sidebar entry previously linked straight to
 * /settings/usage, which renders under SettingsLayout: the page that came up
 * was titled "Settings", wrapped in settings tabs and a "Back to Home" button.
 * Clicking "Analytics" and landing on Settings is the bug this fixes.
 *
 * Both routes render the one component, so the two never drift.
 */

import UsageDashboard from '@/components/analytics/UsageDashboard';

export default function AnalyticsPage() {
  return <UsageDashboard title="Analytics" />;
}
