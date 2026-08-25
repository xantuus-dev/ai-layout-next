'use client';

/**
 * Settings → Usage.
 *
 * The dashboard itself lives in @/components/analytics/UsageDashboard so this
 * tab and the standalone /analytics route render the same thing. No `title` is
 * passed: SettingsLayout already provides the <h1> and tab bar above this.
 */

import UsageDashboard from '@/components/analytics/UsageDashboard';

export default function UsagePage() {
  return <UsageDashboard />;
}
