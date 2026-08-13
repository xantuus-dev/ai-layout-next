'use client';

import { useEffect, useRef, useState } from 'react';

/* Animated mock editor window — sibling to TerminalDemo's chrome so the two
   read as one product. Code is typed character-by-character, the window
   auto-scrolls as it fills, then the output lines "run" at the end. */

type Seg = { text: string; cls?: string };
type Line = { segs: Seg[]; output?: boolean };

const KW = 'text-fuchsia-400';
const STR = 'text-emerald-300';
const FN = 'text-sky-300';
const CMT = 'text-zinc-500';

const CODE_LINES: Line[] = [
  { segs: [{ text: '// One request. Copy, image, and send — automated.', cls: CMT }] },
  {
    segs: [
      { text: 'const', cls: KW },
      { text: ' campaign = ' },
      { text: 'await', cls: KW },
      { text: ' xantuus.' },
      { text: 'run', cls: FN },
      { text: '({' },
    ],
  },
  { segs: [{ text: '  template: ' }, { text: "'marketing-email'", cls: STR }, { text: ',' }] },
  { segs: [{ text: '  model: ' }, { text: "'claude-sonnet'", cls: STR }, { text: ',' }] },
  { segs: [{ text: '  inputs: {' }] },
  { segs: [{ text: '    product: ' }, { text: "'Spring collection'", cls: STR }, { text: ',' }] },
  { segs: [{ text: '    tone: ' }, { text: "'friendly'", cls: STR }, { text: ',' }] },
  { segs: [{ text: '    heroImage: ' }, { text: "'pastel florals, studio light'", cls: STR }, { text: ',' }] },
  { segs: [{ text: '    cta: ' }, { text: "'Shop the Sale'", cls: STR }, { text: ',' }] },
  { segs: [{ text: '  },' }] },
  { segs: [{ text: '  deliverTo: ' }, { text: "'gmail-drafts'", cls: STR }, { text: ',' }] },
  { segs: [{ text: '});' }] },
  { output: true, segs: [{ text: '// → subject: "Spring is here — 25% off everything"', cls: CMT }] },
  { output: true, segs: [{ text: '// → hero image rendered · draft saved to Gmail ✓', cls: CMT }] },
];

const lineLength = (line: Line) => line.segs.reduce((n, s) => n + s.text.length, 0);
const TOTAL_TYPED_CHARS = CODE_LINES.filter((l) => !l.output).reduce((n, l) => n + lineLength(l), 0);
const OUTPUT_COUNT = CODE_LINES.filter((l) => l.output).length;

const START_DELAY_MS = 600;
const TYPE_SPEED_MS = 24;
const LINE_PAUSE_MS = 140;
const RUN_PAUSE_MS = 900;
const OUTPUT_LINE_DELAY_MS = 650;
const HOLD_BEFORE_RESTART_MS = 5000;

export default function CodeWindow() {
  const [typedChars, setTypedChars] = useState(0);
  const [outputLines, setOutputLines] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Static render for users who prefer reduced motion.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTypedChars(TOTAL_TYPED_CHARS);
      setOutputLines(OUTPUT_COUNT);
      return;
    }

    let cancelled = false;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    (async () => {
      while (!cancelled) {
        setTypedChars(0);
        setOutputLines(0);
        await sleep(START_DELAY_MS);

        let count = 0;
        for (const line of CODE_LINES) {
          if (line.output || cancelled) continue;
          const len = lineLength(line);
          for (let i = 0; i < len && !cancelled; i++) {
            count++;
            setTypedChars(count);
            await sleep(TYPE_SPEED_MS);
          }
          await sleep(LINE_PAUSE_MS);
        }

        await sleep(RUN_PAUSE_MS);
        for (let i = 1; i <= OUTPUT_COUNT && !cancelled; i++) {
          setOutputLines(i);
          await sleep(OUTPUT_LINE_DELAY_MS);
        }
        await sleep(HOLD_BEFORE_RESTART_MS);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the newest line in view, like a real editor following the cursor.
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [typedChars, outputLines]);

  // Build the visible lines from the typed-character budget.
  let remaining = typedChars;
  let outputIndex = 0;
  const visibleLines: { key: number; line: Line; visibleChars: number; cursor: boolean }[] = [];
  for (let i = 0; i < CODE_LINES.length; i++) {
    const line = CODE_LINES[i];
    if (line.output) {
      if (outputIndex < outputLines) {
        visibleLines.push({ key: i, line, visibleChars: lineLength(line), cursor: false });
      }
      outputIndex++;
      continue;
    }
    if (remaining <= 0) break;
    const len = lineLength(line);
    const visibleChars = Math.min(remaining, len);
    remaining -= visibleChars;
    const isTypingHere = typedChars < TOTAL_TYPED_CHARS && remaining === 0;
    visibleLines.push({ key: i, line, visibleChars, cursor: isTypingHere });
  }

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-[#0d1117] glow-ambient text-left">
      {/* Title bar with editor tab */}
      <div className="flex items-center gap-2 px-4 pt-3 bg-[#161b22] border-b border-white/10">
        <span className="w-3 h-3 rounded-full bg-[#ff5f57] mb-3" />
        <span className="w-3 h-3 rounded-full bg-[#febc2e] mb-3" />
        <span className="w-3 h-3 rounded-full bg-[#28c840] mb-3" />
        <span className="ml-3 px-3 py-1.5 rounded-t-md bg-[#0d1117] border border-b-0 border-white/10 text-xs font-mono text-zinc-300">
          spring-sale.workflow.ts
        </span>
      </div>

      {/* Fixed-height body; programmatic scroll keeps the cursor line in view */}
      <div
        ref={bodyRef}
        className="p-4 md:p-6 font-mono text-[12px] md:text-[13px] leading-relaxed text-zinc-300 h-[280px] md:h-[320px] overflow-hidden"
      >
        {visibleLines.map(({ key, line, visibleChars, cursor }) => {
          let budget = visibleChars;
          return (
            <div
              key={key}
              className={`whitespace-pre min-h-[1.625em] ${line.output && key === CODE_LINES.length - OUTPUT_COUNT ? 'mt-3' : ''}`}
            >
              {line.segs.map((seg, k) => {
                if (budget <= 0) return null;
                const text = seg.text.slice(0, budget);
                budget -= seg.text.length;
                return (
                  <span key={k} className={seg.cls}>
                    {text}
                  </span>
                );
              })}
              {cursor && (
                <span
                  aria-hidden="true"
                  className="inline-block w-2 h-4 ml-px align-middle bg-zinc-100 animate-pulse"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
