'use client';

import { useEffect, useState } from 'react';

const TYPED_PROMPT =
  'Create a marketing email announcing our spring sale — friendly tone, clear call to action.';

const RESPONSE_LINES = [
  'Subject: "Spring is here — 25% off everything, this week only"',
  'Drafted a 3-paragraph body in your brand voice',
  'Added CTA button: "Shop the Sale"',
  'Draft ready to review and send',
];

const START_DELAY_MS = 600;
const TYPE_SPEED_MS = 45;
const PAUSE_AFTER_TYPING_MS = 700;
const RESPONSE_LINE_DELAY_MS = 550;
const HOLD_BEFORE_RESTART_MS = 4500;

export default function TerminalDemo() {
  const [typedChars, setTypedChars] = useState(0);
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    // Static render for users who prefer reduced motion.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTypedChars(TYPED_PROMPT.length);
      setVisibleLines(RESPONSE_LINES.length);
      return;
    }

    let cancelled = false;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    (async () => {
      while (!cancelled) {
        setTypedChars(0);
        setVisibleLines(0);
        await sleep(START_DELAY_MS);
        for (let i = 1; i <= TYPED_PROMPT.length && !cancelled; i++) {
          setTypedChars(i);
          await sleep(TYPE_SPEED_MS);
        }
        await sleep(PAUSE_AFTER_TYPING_MS);
        for (let i = 1; i <= RESPONSE_LINES.length && !cancelled; i++) {
          setVisibleLines(i);
          await sleep(RESPONSE_LINE_DELAY_MS);
        }
        await sleep(HOLD_BEFORE_RESTART_MS);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="max-w-2xl mx-auto mt-14 text-left">
      <div className="rounded-xl overflow-hidden border border-border bg-[#0d1117] shadow-2xl">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-[#161b22] border-b border-white/10">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <span className="w-3 h-3 rounded-full bg-[#28c840]" />
          <span className="ml-3 text-xs font-mono text-zinc-500">xantuus — ai terminal</span>
        </div>

        {/* Body — fixed min-height so response lines don't shift the page */}
        <div className="p-4 md:p-6 font-mono text-[13px] md:text-sm leading-relaxed min-h-[240px] md:min-h-[220px]">
          <p className="text-zinc-100 break-words">
            <span className="text-emerald-400">➜</span>{' '}
            <span className="text-sky-400">xantuus</span>{' '}
            <span>{TYPED_PROMPT.slice(0, typedChars)}</span>
            <span
              aria-hidden="true"
              className="inline-block w-2 h-4 ml-0.5 align-middle bg-zinc-100 animate-pulse"
            />
          </p>

          <div className="mt-4 space-y-2">
            {RESPONSE_LINES.slice(0, visibleLines).map((line, i) => (
              <p key={line} className="text-zinc-400 break-words">
                <span className={i === RESPONSE_LINES.length - 1 ? 'text-sky-400' : 'text-emerald-400'}>
                  {i === RESPONSE_LINES.length - 1 ? '→' : '✓'}
                </span>{' '}
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
