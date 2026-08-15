import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { MarketingHeader, MarketingFooter } from '@/components/MarketingChrome';
import { SOLUTIONS, getSolution } from '@/lib/solutions';

interface SolutionPageProps {
  params: { slug: string };
}

export function generateStaticParams() {
  return SOLUTIONS.map((solution) => ({ slug: solution.slug }));
}

export function generateMetadata({ params }: SolutionPageProps): Metadata {
  const solution = getSolution(params.slug);
  if (!solution) return { title: 'Not found — Xantuus AI' };

  return {
    title: `${solution.name} — Xantuus AI`,
    description: solution.subhead,
  };
}

export default function SolutionPage({ params }: SolutionPageProps) {
  const solution = getSolution(params.slug);
  if (!solution) notFound();

  const Icon = solution.icon;
  // Prefills the "Service Interested In" select on /contact so the visitor
  // does not re-state what they just clicked through to read about.
  const contactHref = `/contact?prompt=${encodeURIComponent(solution.contactService)}`;
  const related = SOLUTIONS.filter((item) => item.slug !== solution.slug);

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 -translate-x-[80%] w-[36rem] h-[36rem] rounded-full bg-teal-500/25 blur-3xl" />
          <div className="absolute top-24 right-[8%] w-[28rem] h-[28rem] rounded-full bg-emerald-500/20 blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 md:px-8 pt-12 pb-16 text-center">
          {/* Own block: the badge below is inline-flex, so an inline back link
              would share its line and overlap in the centered container. */}
          <div className="mb-8">
            <Link
              href="/solutions"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              All solutions
            </Link>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-accent/50 text-xs font-medium text-muted-foreground mb-6">
            <Icon className="w-3.5 h-3.5 text-primary" />
            {solution.eyebrow}
            {solution.badge && (
              <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {solution.badge}
              </span>
            )}
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6">
            {solution.headline} <span className="text-gradient">{solution.headlineAccent}</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            {solution.subhead}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={contactHref}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 text-base font-semibold gradient-primary hover:gradient-primary-hover text-white rounded-full transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
            >
              Talk to us about {solution.name}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/pricing"
              className="w-full sm:w-auto px-8 py-3 text-base font-semibold text-foreground border border-border rounded-full hover:bg-accent transition-colors text-center"
            >
              See pricing
            </Link>
          </div>

          {/* Stats */}
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto mt-16 pt-10 border-t border-border">
            {solution.stats.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <span className="block text-3xl font-bold text-foreground">{stat.value}</span>
                  <span className="block text-sm text-muted-foreground mt-1">{stat.label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 py-16 border-t border-border">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-3">What you get</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Built on the same multi-model runtime, credit balance, and audit trail as the rest of Xantuus.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {solution.features.map((feature) => {
            const FeatureIcon = feature.icon;
            return (
              <div key={feature.title} className="p-6 rounded-2xl border border-border bg-card">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <FeatureIcon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 py-16 border-t border-border">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">How it works</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {solution.steps.map((step, index) => (
            <div key={step.title} className="text-left">
              <div className="w-10 h-10 mb-4 rounded-full gradient-primary text-white font-bold flex items-center justify-center">
                {index + 1}
              </div>
              <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Use cases */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 py-16 border-t border-border">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-3">Where teams start</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            The first three things customers usually put into production.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {solution.useCases.map((useCase) => (
            <div key={useCase.title} className="p-6 rounded-2xl border border-border bg-card">
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 shrink-0 text-primary mt-0.5" />
                <div>
                  <h3 className="font-semibold text-foreground mb-2">{useCase.title}</h3>
                  <p className="text-sm text-muted-foreground">{useCase.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ — <details> keeps this interactive without shipping client JS */}
      <section className="max-w-3xl mx-auto px-4 md:px-8 py-16 border-t border-border">
        <h2 className="text-3xl font-bold text-foreground mb-8 text-center">Common questions</h2>
        <div className="space-y-4">
          {solution.faqs.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-2xl border border-border bg-card p-6 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold text-foreground">
                {faq.question}
                <span className="shrink-0 text-muted-foreground transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-4 text-sm text-muted-foreground">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Related solutions */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 py-16 border-t border-border">
        <h2 className="text-2xl font-bold text-foreground mb-8">Explore the rest of the platform</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {related.map((item) => {
            const RelatedIcon = item.icon;
            return (
              <Link
                key={item.slug}
                href={`/solutions/${item.slug}`}
                className="group p-6 rounded-2xl border border-border bg-card hover:border-primary/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <RelatedIcon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                  {item.name}
                  <ArrowRight className="w-4 h-4 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                </h3>
                <p className="text-sm text-muted-foreground">{item.summary}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 py-16">
        <div className="rounded-3xl gradient-primary px-6 py-14 text-center text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            Tell us what you want {solution.name} to do
          </h2>
          <p className="text-white/80 max-w-xl mx-auto mb-8">
            Send us the task. We will tell you whether it is a template, a workflow, or a custom build — and
            roughly what it costs to run.
          </p>
          <Link
            href={contactHref}
            className="inline-flex items-center gap-2 px-8 py-3 text-base font-semibold bg-white text-gray-900 rounded-full transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
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
