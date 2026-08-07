'use client';

import { useState, useEffect } from 'react';
import { X, Megaphone, Sparkles } from 'lucide-react';

// Renders one dismissible ad/notification strip directly above the chat
// input. Add entries here to promote a feature, run a sponsored placement,
// etc. Only the first non-dismissed entry (by id) is shown; each dismissal
// is remembered in localStorage so it doesn't reappear on the same device.
type ChatNotice = {
  id: string;
  type: 'ad' | 'notification';
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
};

const CHAT_NOTICES: ChatNotice[] = [];

const DISMISSED_KEY = 'xantuus:dismissedChatNotices';

export default function ChatFooterNotice() {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setDismissed(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'));
    } catch {
      setDismissed([]);
    }
    setHydrated(true);
  }, []);

  const notice = CHAT_NOTICES.find((n) => !dismissed.includes(n.id));
  if (!hydrated || !notice) return null;

  const dismiss = () => {
    try {
      const next = [...dismissed, notice.id];
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
      setDismissed(next);
    } catch {
      setDismissed((prev) => [...prev, notice.id]);
    }
  };

  const Icon = notice.type === 'ad' ? Megaphone : Sparkles;

  return (
    <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="w-4 h-4 flex-shrink-0 text-primary" />
        <span className="truncate text-foreground">{notice.message}</span>
        {notice.ctaLabel && notice.ctaHref && (
          <a
            href={notice.ctaHref}
            className="flex-shrink-0 font-medium text-primary hover:underline"
          >
            {notice.ctaLabel}
          </a>
        )}
      </div>
      <button onClick={dismiss} aria-label="Dismiss" className="flex-shrink-0 hover:opacity-75 transition-opacity">
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
}
