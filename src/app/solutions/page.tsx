import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { MarketingHeader, MarketingFooter } from '@/components/MarketingChrome';
import { SOLUTIONS } from '@/lib/solutions';

export const metadata: Metadata = {
  title: 'Solutions — Xantuus AI',
  description:
    'AI agents, automation, security, and dashboards — every leading model behind one credit balance.',
};

export default function SolutionsPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 -translate-x-[70%] w-[36rem] h-[36rem] rounded-full bg-teal-500/25 blur-3xl" />
          <div className="absolute top-20 right-[10%] w-[26rem] h-[26rem] rounded-full bg-violet-500/15 blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 md:px-8 pt-20 pb-12 text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6">
            Four ways teams put <span className="text-gradient">Xantuus to work</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Agents that act, workflows that run themselves, the governance to keep both accountable, and
            dashboards that explain what happened — on one credit balance, across every leading model.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 md:px-8 pb-16">
        <div className="grid sm:grid-cols-2 gap-6">
          {SOLUTIONS.map((solution) => {
            const Icon = solution.icon;
            return (
              <Link
                key={solution.slug}
                href={`/solutions/${solution.slug}`}
                className="group p-8 rounded-2xl border border-border bg-card hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  {solution.badge && (
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      {solution.badge}
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">{solution.name}</h2>
                <p className="text-sm text-muted-foreground mb-6">{solution.summary}</p>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                  Learn more
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 md:px-8 pb-16">
        <div className="rounded-3xl border border-border bg-card px-6 py-12 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            Not sure which one you need?
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">
            Describe the task in a sentence or two. We will tell you whether it is a template, a workflow,
            an agent, or something we should not sell you.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-8 py-3 text-base font-semibold gradient-primary hover:gradient-primary-hover text-white rounded-full transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
          >
            Get in touch
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
