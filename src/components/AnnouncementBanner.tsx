'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { X, Sparkles, AlertTriangle } from 'lucide-react';

// Bump this list whenever you ship something worth telling users about.
// Only the first (newest) entry is shown; each id is remembered as seen in
// localStorage so it doesn't nag on every visit. Add new entries to the top.
const ANNOUNCEMENTS: { id: string; message: string }[] = [
  {
    id: 'sessions-sidebar-2026-08',
    message: "New: your recent sessions now live right in the sidebar, and we've refreshed the look across the app.",
  },
];

const DISMISSED_KEY = 'xantuus:dismissedAnnouncements';

export default function AnnouncementBanner() {
  const { data: session } = useSession();
  const router = useRouter();
  const [creditStatus, setCreditStatus] = useState<{ creditsUsed: number; monthlyCredits: number } | null>(null);
  const [dismissedCreditWarning, setDismissedCreditWarning] = useState(false);
  const [announcementDismissed, setAnnouncementDismissed] = useState(true); // default hidden until checked

  const latestAnnouncement = ANNOUNCEMENTS[0];

  useEffect(() => {
    if (!session?.user) return;

    fetch('/api/usage/credits')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setCreditStatus({ creditsUsed: data.creditsUsed, monthlyCredits: data.monthlyCredits });
        }
      })
      .catch(() => {});

    if (latestAnnouncement) {
      try {
        const dismissed: string[] = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
        setAnnouncementDismissed(dismissed.includes(latestAnnouncement.id));
      } catch {
        setAnnouncementDismissed(false);
      }
    }
  }, [session?.user, latestAnnouncement]);

  const dismissAnnouncement = () => {
    if (latestAnnouncement) {
      try {
        const dismissed: string[] = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
        localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed, latestAnnouncement.id]));
      } catch {
        // localStorage unavailable — dismissal just won't persist across reloads
      }
    }
    setAnnouncementDismissed(true);
  };

  if (!session?.user) return null;

  const percentUsed = creditStatus && creditStatus.monthlyCredits > 0
    ? (creditStatus.creditsUsed / creditStatus.monthlyCredits) * 100
    : 0;

  // Credit warnings take priority over general announcements — more actionable.
  if (percentUsed >= 80 && !dismissedCreditWarning) {
    const isFull = percentUsed >= 100;
    return (
      <div className={`px-4 py-2.5 flex items-center justify-between gap-3 text-sm relative z-20 ${isFull ? 'bg-destructive text-white' : 'bg-amber-500 text-white'}`}>
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">
            {isFull
              ? "You've used all your credits this cycle."
              : `You've used ${Math.round(percentUsed)}% of your credits this cycle.`}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => router.push('/settings/billing')}
            className="px-3 py-1 bg-white/90 hover:bg-white text-gray-900 rounded-md text-sm font-medium transition-colors"
          >
            {isFull ? 'Upgrade or buy credits' : 'Manage plan'}
          </button>
          <button onClick={() => setDismissedCreditWarning(true)} aria-label="Dismiss" className="hover:opacity-75 transition-opacity">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (latestAnnouncement && !announcementDismissed) {
    return (
      <div className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm relative z-20 bg-primary/10 text-foreground border-b border-primary/20">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 flex-shrink-0 text-primary" />
          <span className="truncate">{latestAnnouncement.message}</span>
        </div>
        <button onClick={dismissAnnouncement} aria-label="Dismiss" className="flex-shrink-0 hover:opacity-75 transition-opacity">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return null;
}
