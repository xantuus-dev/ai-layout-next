/* "Why not just use ChatGPT" — comparison table in the style of the
   supercool.com deliverables-vs-competitors grid, rebuilt against what
   Xantuus actually ships (multi-model chat, images, templates, workflow
   automation, integrations, credit pooling — see CapabilitiesSection and
   the home page FEATURES list) instead of supercool's video/song/book
   deliverables, which Xantuus does not offer. */

import { Check, X } from 'lucide-react';

const COMPETITORS = ['ChatGPT', 'Gemini', 'Zapier', 'Canva'] as const;

interface Row {
  label: string;
  /** One entry per COMPETITORS column; null renders a plain X mark. */
  competitors: (string | null)[];
  xantuus: string;
}

const ROWS: Row[] = [
  {
    label: 'Claude, GPT & Gemini in one chat',
    competitors: ['GPT only', 'Gemini only', null, null],
    xantuus: 'all three — one credit balance',
  },
  {
    label: 'On-brand AI images & graphics',
    competitors: ['separate limits, no brand kit', 'separate Imagen access', null, 'templates, not AI-generated art'],
    xantuus: 'built in, no extra subscription',
  },
  {
    label: 'Business templates, fill-in-the-blank',
    competitors: ['blank chat — you write the prompt', 'same — you write the prompt', 'workflow templates, no AI drafting', 'design templates only'],
    xantuus: 'ready-to-run, organized by category',
  },
  {
    label: 'Workflow automation on a schedule',
    competitors: [null, null, 'automation — you bring your own AI', null],
    xantuus: 'visual builder, AI steps included',
  },
  {
    label: 'Finished work in Gmail, Drive & Calendar',
    competitors: ['copy-paste it yourself', 'copy-paste it yourself', 'connects the apps, not the AI', 'export only'],
    xantuus: 'lands where you already work',
  },
  {
    label: 'One credit balance, whole team',
    competitors: ['per-seat license', 'per-seat license', 'per-seat + task limits', 'per-seat license'],
    xantuus: 'pay for usage, not seats',
  },
  {
    label: 'Agents with human approval checkpoints',
    competitors: [null, null, null, null],
    xantuus: 'pauses and waits for sign-off',
  },
];

export default function ComparisonSection() {
  return (
    <section className="max-w-6xl mx-auto px-4 md:px-8 py-20 border-t border-border">
      <div className="text-center mb-12">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground mb-4">
          Why not just use ChatGPT
        </p>
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
          One platform. <span className="text-gradient">Every deliverable.</span>
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
          A single chat model gets you a draft. Xantuus gets the work finished and delivered where
          you already work.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <div className="min-w-[860px]">
          {/* Header row */}
          <div className="grid grid-cols-[1.6fr_repeat(4,1fr)_1.3fr] bg-accent/40">
            <div className="px-5 py-4" />
            {COMPETITORS.map((name) => (
              <div
                key={name}
                className="px-4 py-4 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground"
              >
                {name}
              </div>
            ))}
            <div className="px-4 py-4 flex items-center justify-center">
              <span className="rounded-full gradient-primary px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
                Xantuus
              </span>
            </div>
          </div>

          {/* Rows */}
          {ROWS.map((row, i) => (
            <div
              key={row.label}
              className={`grid grid-cols-[1.6fr_repeat(4,1fr)_1.3fr] items-center ${
                i % 2 === 0 ? 'bg-card' : 'bg-background'
              } border-t border-border`}
            >
              <div className="px-5 py-5 text-sm font-semibold text-foreground">{row.label}</div>
              {row.competitors.map((cell, ci) => (
                <div key={ci} className="px-4 py-5 text-center">
                  {cell === null ? (
                    <X className="w-4 h-4 mx-auto text-muted-foreground/50" />
                  ) : (
                    <span className="text-xs text-muted-foreground leading-snug block">{cell}</span>
                  )}
                </div>
              ))}
              <div className="px-4 py-5 flex flex-col items-center gap-1.5 bg-primary/5 h-full justify-center">
                <Check className="w-5 h-5 rounded-full bg-primary text-white p-1" />
                <span className="text-xs font-medium text-primary text-center leading-snug">
                  {row.xantuus}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
