'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronDown, AlertCircle } from 'lucide-react';
import { PLANS } from '@/lib/stripe';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  CREDIT_TIER_PRICES,
  ENTRY_TIER_CREDITS,
  INTRO_TRIAL,
  getAvailableCreditOptions,
  getCreditsFromDisplayName,
  getPriceId,
  getCostPer1KCredits,
  isPriceIdConfigured,
  isPricingConfigured,
} from '@/lib/pricing-config';

export default function PricingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [selectedCredits, setSelectedCredits] = useState<string>("12,000 credits / month");
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);

  // Check if pricing is properly configured
  useEffect(() => {
    if (!isPricingConfigured()) {
      setPricingError('Pricing is not fully configured. Please contact support.');
    }
  }, []);

  const handleSubscribe = async (priceId: string | null | undefined, planName: string, isProTier: boolean = false) => {
    console.log('handleSubscribe called:', { priceId, planName, isProTier, session: !!session });

    // For Pro tier, use dynamic price ID based on selected credits and billing cycle
    let finalPriceId = priceId;
    if (isProTier) {
      const credits = getCreditsFromDisplayName(selectedCredits);
      console.log('Pro tier - selected credits:', selectedCredits, 'parsed:', credits);
      if (credits) {
        finalPriceId = getPriceId(credits, billingCycle);
        console.log('Final price ID for Pro:', finalPriceId);
      }
    }

    if (!finalPriceId) {
      console.error('No price ID available');
      alert('This plan is not available yet. Please contact support or choose a different plan.');
      return;
    }

    if (!isPriceIdConfigured(finalPriceId)) {
      console.error('Price ID not configured:', finalPriceId);
      alert('This pricing tier is not configured. Please contact support.');
      return;
    }

    console.log('Starting checkout with price ID:', finalPriceId);
    setIsLoading(planName);

    try {
      const requestBody = {
        priceId: finalPriceId,
        billingCycle,
        credits: isProTier ? getCreditsFromDisplayName(selectedCredits) : undefined,
      };
      console.log('Sending checkout request:', requestBody);

      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      console.log('Checkout response status:', response.status);
      const data = await response.json();
      console.log('Checkout response data:', data);

      if (data.error) {
        console.error('Checkout error:', data.error, 'Details:', data.details);
        const errorMsg = data.details
          ? `${data.error} (${data.details})`
          : data.error;

        if (data.redirect) {
          alert(data.message || errorMsg);
          router.push(data.redirect);
        } else {
          alert(`Error: ${errorMsg}\n\nPlease try again or contact support if the issue persists.`);
        }
        return;
      }

      if (data.url) {
        console.log('Redirecting to Stripe checkout:', data.url);
        window.location.href = data.url;
      } else {
        console.error('No checkout URL in response');
        alert('Failed to get checkout URL. Please try again.');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setIsLoading(null);
    }
  };

  const currentPlan = session?.user?.plan || 'free';

  // Get current tier pricing
  const getCurrentTierPrice = () => {
    const credits = getCreditsFromDisplayName(selectedCredits);
    if (!credits) return { monthly: 0, yearly: 0 };

    const tier = CREDIT_TIER_PRICES[credits.toString()];
    if (!tier) return { monthly: 0, yearly: 0 };

    return {
      monthly: tier.monthlyPrice,
      yearly: tier.yearlyPrice,
    };
  };

  const currentTierPrice = getCurrentTierPrice();
  const displayPrice = billingCycle === 'monthly' ? currentTierPrice.monthly : currentTierPrice.yearly;
  const monthlySavings = currentTierPrice.monthly * 12 - currentTierPrice.yearly;

  // Get cost per 1K credits
  const costPer1K = (() => {
    const credits = getCreditsFromDisplayName(selectedCredits);
    if (!credits) return 0;
    return getCostPer1KCredits(credits, currentTierPrice.monthly);
  })();

  // Create dynamic Pro plan features based on selected credits.
  // The credits line is features[0]; it moved up when the phantom
  // "500 refresh credits everyday" line was removed from the plan.
  const getProFeatures = (): string[] => {
    const baseFeatures: string[] = [...PLANS.PRO.features];
    baseFeatures[0] = selectedCredits; // Replace the credits line with selected value
    return baseFeatures;
  };

  // The intro offer checks out against its own 14-day price, not the
  // monthly tier — the customer is charged $9.95 today and the subscription
  // schedule moves them onto the monthly price afterwards.
  const trialPriceId = INTRO_TRIAL.priceId;

  // Whether this account can still take the intro offer. Deliberately NOT
  // `currentPlan === 'trial'`: users grandfathered off the old free tier sit
  // on a courtesy trial with hasUsedTrial still false, and gating on the plan
  // label would grey out the CTA for exactly the cohort we most need to
  // convert. The checkout route enforces the same rule server-side.
  const hasUsedIntroOffer = session?.user?.hasUsedTrial === true;

  // The intro price has to exist in Stripe before the offer can be sold. Without
  // this the CTA rendered enabled and clicking it only reached handleSubscribe's
  // null guard — an alert reading "not available yet" on the primary
  // acquisition CTA. Disable it at the source instead, and say so on the button.
  const introOfferUnavailable = !trialPriceId;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-16 md:py-24">
        {/* Pricing Configuration Error */}
        {pricingError && (
          <div className="mb-8 max-w-3xl mx-auto bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                Configuration Notice
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                {pricingError}
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-gradient mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose the perfect plan for your needs. Upgrade or downgrade at any time.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                billingCycle === 'monthly'
                  ? 'gradient-primary text-white shadow-md'
                  : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2 rounded-lg font-semibold transition-all relative ${
                billingCycle === 'yearly'
                  ? 'gradient-primary text-white shadow-md'
                  : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
              }`}
            >
              Yearly
              <span className="ml-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Free trial — replaces the old ongoing free tier */}
          <Card className="relative flex flex-col border-2 border-border hover:border-primary/30 transition-all hover:shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">Try Xantuus</CardTitle>
              <CardDescription>
                ${INTRO_TRIAL.price.toFixed(2)} for {INTRO_TRIAL.days} days, then $
                {CREDIT_TIER_PRICES[String(ENTRY_TIER_CREDITS)].monthlyPrice.toFixed(2)}/month
              </CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold text-foreground">
                  ${INTRO_TRIAL.price.toFixed(2)}
                </span>
                <span className="text-muted-foreground">for {INTRO_TRIAL.days} days</span>
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
              <ul className="space-y-3">
                {PLANS.TRIAL.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">
                ${INTRO_TRIAL.price.toFixed(2)} is charged today. After {INTRO_TRIAL.days} days
                it becomes ${CREDIT_TIER_PRICES[String(ENTRY_TIER_CREDITS)].monthlyPrice.toFixed(2)}/month
                — we&apos;ll email you three days before. Cancel any time.
              </p>
            </CardContent>
            <CardFooter className="flex-col items-stretch">
              <button
                onClick={() => handleSubscribe(trialPriceId, 'TRIAL', false)}
                disabled={hasUsedIntroOffer || introOfferUnavailable || isLoading === 'TRIAL'}
                className="w-full py-3 px-6 rounded-lg font-semibold transition-colors bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {introOfferUnavailable
                  ? 'Currently unavailable'
                  : hasUsedIntroOffer
                    ? currentPlan === 'trial' ? 'Offer active' : 'Offer already used'
                    : isLoading === 'TRIAL'
                      ? 'Starting…'
                      : `Start for $${INTRO_TRIAL.price.toFixed(2)}`}
              </button>
              {introOfferUnavailable && (
                <p className="mt-2 text-xs text-muted-foreground text-center">
                  This offer isn&apos;t open yet — pick a monthly plan below to get started.
                </p>
              )}
            </CardFooter>
          </Card>

          {/* Pro Plan */}
          <Card className="relative flex flex-col border-2 border-primary shadow-xl scale-105 glow-green">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <Badge className="gradient-primary text-white px-4 py-1 text-sm">Most Popular</Badge>
            </div>
            <CardHeader>
              <CardTitle className="text-2xl">Pro</CardTitle>
              <CardDescription>For professionals and teams</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold text-foreground">
                  ${displayPrice.toLocaleString()}
                </span>
                <span className="text-muted-foreground">/{billingCycle === 'monthly' ? 'month' : 'year'}</span>
              </div>
              {billingCycle === 'yearly' && (
                <div className="mt-2">
                  <span className="text-sm text-green-600 dark:text-green-400 font-semibold">
                    Save ${monthlySavings.toLocaleString()}/year
                  </span>
                </div>
              )}
              {/* Credits Dropdown */}
              <div className="mt-4">
                <Select value={selectedCredits} onValueChange={setSelectedCredits}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select credits per month" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableCreditOptions().map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {selectedCredits.split(' ')[0]} credits per month
                </span>
                <span className="text-accent font-medium">
                  ${costPer1K.toFixed(2)}/1K credits
                </span>
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
              <ul className="space-y-3">
                {getProFeatures().map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <button
                onClick={() => handleSubscribe(null, 'PRO', true)}
                disabled={isLoading === 'PRO' || currentPlan === 'pro'}
                className="w-full py-3 px-6 rounded-lg font-semibold gradient-primary hover:gradient-primary-hover hover:-translate-y-0.5 transition-all text-white shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading === 'PRO' ? 'Loading...' : currentPlan === 'pro' ? 'Current Plan' : 'Get Started'}
              </button>
            </CardFooter>
          </Card>

          {/* Enterprise Plan */}
          <Card className="relative flex flex-col border-2 border-border hover:border-accent/30 transition-all hover:shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">Enterprise</CardTitle>
              <CardDescription>For large organizations</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold text-foreground">
                  ${billingCycle === 'monthly' ? '185' : '1,776'}
                </span>
                <span className="text-muted-foreground">/{billingCycle === 'monthly' ? 'month' : 'year'}</span>
              </div>
              {billingCycle === 'yearly' && (
                <div className="mt-2">
                  <span className="text-sm text-green-600 dark:text-green-400 font-semibold">
                    Save $444/year
                  </span>
                </div>
              )}
            </CardHeader>
            <CardContent className="flex-grow">
              <ul className="space-y-3">
                {PLANS.ENTERPRISE.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <button
                onClick={() => {
                  // Enterprise = 40K credits tier
                  const enterprisePriceId = getPriceId(40000, billingCycle);
                  handleSubscribe(enterprisePriceId, 'ENTERPRISE', false);
                }}
                disabled={isLoading === 'ENTERPRISE' || currentPlan === 'enterprise'}
                className="w-full py-3 px-6 rounded-lg font-semibold gradient-accent hover:gradient-accent-hover hover:-translate-y-0.5 transition-all text-white shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading === 'ENTERPRISE' ? 'Loading...' : currentPlan === 'enterprise' ? 'Current Plan' : 'Get Started'}
              </button>
            </CardFooter>
          </Card>
        </div>

        {/* FAQ Section */}
        <div className="mt-24 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {[
              {
                question: "What happens when I run out of credits?",
                answer: "Your credits reset monthly. If you need more, you can upgrade to a higher plan at any time."
              },
              {
                question: "Can I cancel my subscription?",
                answer: "Yes, you can cancel anytime from your account settings. You'll retain access until the end of your billing period."
              },
              {
                question: "Do you offer refunds?",
                answer: "We offer a 14-day money-back guarantee on all paid plans. Contact support for a refund."
              }
            ].map((faq, index) => (
              <div
                key={index}
                className="border border-border rounded-lg overflow-hidden bg-card"
              >
                <button
                  onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-accent transition-colors"
                >
                  <h3 className="text-lg font-semibold text-foreground">
                    {faq.question}
                  </h3>
                  <ChevronDown
                    className={`w-5 h-5 text-muted-foreground transition-transform ${
                      openFaqIndex === index ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openFaqIndex === index && (
                  <div className="px-6 pb-4 pt-2">
                    <p className="text-muted-foreground">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
