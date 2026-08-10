'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthModal from './ui/AuthModal';
import ThemeToggle from './ThemeToggle';
import {
  Sparkles,
  Workflow,
  Layers,
  Users,
  Zap,
  ShieldCheck,
  Check,
  ArrowRight,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Layers,
    title: 'Every model, one place',
    description: 'Claude, GPT, and Gemini behind a single chat — pick the right model per task instead of committing to one vendor.',
  },
  {
    icon: Workflow,
    title: 'Templates & automation',
    description: 'A library of ready-to-run prompts for real business tasks, plus workflow automation for the ones you repeat every week.',
  },
  {
    icon: Zap,
    title: 'Pay for usage, not seats',
    description: 'Credits meter actual AI usage. No per-seat tax — top up anytime without renegotiating your plan.',
  },
  {
    icon: Users,
    title: 'One bill for the whole team',
    description: 'Invite teammates to share your credit pool. One invoice, shared usage, admin controls over who can spend.',
  },
  {
    icon: Sparkles,
    title: 'Image generation built in',
    description: 'Generate on-brand images for decks, listings, and marketing without a separate subscription.',
  },
  {
    icon: ShieldCheck,
    title: 'Built on the providers you trust',
    description: 'Backed by Anthropic, OpenAI, and Google’s models — you’re never locked into a single AI vendor’s roadmap.',
  },
];

const STEPS = [
  {
    step: '1',
    title: 'Sign up free',
    description: 'Create an account in seconds with Google or Apple. No card required to start.',
  },
  {
    step: '2',
    title: 'Describe the task or pick a template',
    description: 'Type what you need, or start from a template built for common business work.',
  },
  {
    step: '3',
    title: 'Get it done, automatically',
    description: 'The right model handles it — and you can turn any repeated task into an automated workflow.',
  },
];

const PRICING_TEASER = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Perfect for trying it out',
    features: ['4,000 credits / month', 'Access to every model', 'Template library'],
    cta: 'Start free',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$60',
    period: '/month',
    description: 'For professionals and teams',
    features: ['12,000 credits / month', 'Team credit pooling', 'Priority support'],
    cta: 'Get started',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: '$185',
    period: '/month',
    description: 'For larger organizations',
    features: ['40,000 credits / month', 'Admin & team roles', 'Dedicated support'],
    cta: 'Get started',
    highlight: false,
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const openSignUp = () => setShowAuthModal(true);

  return (
    <div className="min-h-screen bg-background">
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => setShowAuthModal(false)}
      />

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          {/* The real wordmark lockup, not the bare X mark plus typed text.
              The icon is 417x570 — at w-8 it is a 32px glyph, which is what made
              the brand look undersized on a phone.

              Sized by WIDTH: the wordmark is 2255x685 (aspect 3.29), so a height
              constraint under-renders the type. 132px is ~40px tall on a phone
              and leaves room for the theme toggle and sign-in button on a 390px
              viewport; 168px from md up, where the nav appears alongside.

              No adjacent <span> — the asset already contains "XANTUUS AI", so
              text next to it would duplicate the brand. */}
          <div className="flex items-center min-w-0">
            <img
              src="/xantuus-wordmark-dark.png"
              alt="Xantuus AI"
              className="w-[132px] md:w-[168px] max-w-full h-auto object-contain object-left dark:hidden"
            />
            <img
              src="/xantuus-wordmark-white.png"
              alt="Xantuus AI"
              className="w-[132px] md:w-[168px] max-w-full h-auto object-contain object-left hidden dark:block"
            />
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={openSignUp}
              className="hidden sm:block px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={openSignUp}
              className="px-5 py-2 text-sm font-semibold gradient-primary hover:gradient-primary-hover text-white rounded-full transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
            >
              Sign Up
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 md:px-8 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-accent/50 text-xs font-medium text-muted-foreground mb-6">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          Multi-model AI, built for small business
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6">
          Run your business tasks on <span className="text-gradient">every leading AI model</span> — one credit balance
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Xantuus gives your team Claude, GPT, and Gemini in one place, with ready-made templates,
          automation, and a credit-based plan that scales with actual usage — not seats.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={openSignUp}
            className="w-full sm:w-auto px-8 py-3 text-base font-semibold gradient-primary hover:gradient-primary-hover text-white rounded-full transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2"
          >
            Get started free
            <ArrowRight className="w-4 h-4" />
          </button>
          <a
            href="#pricing"
            className="w-full sm:w-auto px-8 py-3 text-base font-semibold text-foreground border border-border rounded-full hover:bg-accent transition-colors text-center"
          >
            See pricing
          </a>
        </div>
        <p className="text-sm text-muted-foreground mt-4">No credit card required to start.</p>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-4 md:px-8 py-16 border-t border-border">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-3">Everything your team needs, nothing you have to stitch together</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            One subscription instead of five. One credit balance instead of per-seat licenses for tools you barely use.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="p-6 rounded-2xl border border-border bg-card">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-4 md:px-8 py-16 border-t border-border">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-3">Up and running in three steps</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map((s) => (
            <div key={s.step} className="text-center">
              <div className="w-10 h-10 rounded-full gradient-primary text-white font-bold flex items-center justify-center mx-auto mb-4">
                {s.step}
              </div>
              <h3 className="font-semibold text-foreground mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section id="pricing" className="max-w-6xl mx-auto px-4 md:px-8 py-16 border-t border-border">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-3">Simple, credit-based pricing</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Every plan includes every model. Upgrade, downgrade, or top up credits anytime.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {PRICING_TEASER.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col p-6 rounded-2xl border-2 transition-all ${
                plan.highlight
                  ? 'border-primary shadow-xl scale-105 bg-card'
                  : 'border-border bg-card hover:border-primary/30'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-semibold text-white gradient-primary rounded-full">
                  Most Popular
                </div>
              )}
              <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
              <div className="mb-4">
                <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>
              <ul className="space-y-2 mb-6 flex-grow">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => (plan.name === 'Free' ? openSignUp() : router.push('/pricing'))}
                className={`w-full py-2.5 rounded-lg font-semibold transition-colors ${
                  plan.highlight
                    ? 'gradient-primary hover:gradient-primary-hover text-white'
                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground mt-8">
          Need more credits or a custom tier?{' '}
          <Link href="/pricing" className="text-primary hover:underline font-medium">
            See full pricing
          </Link>
        </p>
      </section>

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto px-4 md:px-8 py-16 text-center">
        <div className="rounded-3xl gradient-primary p-10 md:p-14">
          <h2 className="text-3xl font-bold text-white mb-3">Ready to put AI to work?</h2>
          <p className="text-white/90 mb-8 max-w-lg mx-auto">
            Create your account and send your first request in under a minute.
          </p>
          <button
            onClick={openSignUp}
            className="px-8 py-3 text-base font-semibold bg-white text-gray-900 rounded-full transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            Get started free
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Same wordmark as the header, one step smaller — the footer is
              secondary, but it should still be the brand rather than a 24px glyph. */}
          <div className="flex items-center min-w-0">
            <img
              src="/xantuus-wordmark-dark.png"
              alt="Xantuus AI"
              className="w-[112px] max-w-full h-auto object-contain object-left dark:hidden"
            />
            <img
              src="/xantuus-wordmark-white.png"
              alt="Xantuus AI"
              className="w-[112px] max-w-full h-auto object-contain object-left hidden dark:block"
            />
          </div>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          </nav>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Xantuus AI</p>
        </div>
      </footer>
    </div>
  );
}
