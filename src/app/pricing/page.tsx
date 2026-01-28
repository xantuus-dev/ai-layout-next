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

    if (!session) {
      console.log('No session, redirecting to signin');
      router.push('/?auth=signin');
      return;
    }

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
        console.error('Checkout error:', data.error);
        if (data.redirect) {
          alert(data.message || data.error);
          router.push(data.redirect);
        } else {
          alert(data.error);
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

  // Create dynamic Pro plan features based on selected credits
  const getProFeatures = (): string[] => {
    const baseFeatures: string[] = [...PLANS.PRO.features];
    baseFeatures[1] = selectedCredits; // Replace the credits line with selected value
    return baseFeatures;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
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
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Choose the perfect plan for your needs. Upgrade or downgrade at any time.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2 rounded-lg font-semibold transition-all relative ${
                billingCycle === 'yearly'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
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
          {/* Free Plan */}
          <Card className="relative flex flex-col border-2 hover:border-blue-200 dark:hover:border-blue-800 transition-all">
            <CardHeader>
              <CardTitle className="text-2xl">Free</CardTitle>
              <CardDescription>Perfect for getting started</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold text-gray-900 dark:text-white">$0</span>
                <span className="text-gray-600 dark:text-gray-400">/month</span>
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
              <ul className="space-y-3">
                {PLANS.FREE.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <button
                onClick={() => {
                  if (!session) {
                    router.push('/?auth=signin');
                  }
                }}
                disabled={currentPlan === 'free'}
                className="w-full py-3 px-6 rounded-lg font-semibold transition-colors bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {currentPlan === 'free' ? 'Current Plan' : 'Get Started'}
              </button>
            </CardFooter>
          </Card>

          {/* Pro Plan */}
          <Card className="relative flex flex-col border-2 border-blue-500 dark:border-blue-600 shadow-xl scale-105">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <Badge className="bg-blue-500 text-white px-4 py-1 text-sm">Most Popular</Badge>
            </div>
            <CardHeader>
              <CardTitle className="text-2xl">Pro</CardTitle>
              <CardDescription>For professionals and teams</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold text-gray-900 dark:text-white">
                  ${displayPrice.toLocaleString()}
                </span>
                <span className="text-gray-600 dark:text-gray-400">/{billingCycle === 'monthly' ? 'month' : 'year'}</span>
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
                <span className="text-gray-500 dark:text-gray-400">
                  {selectedCredits.split(' ')[0]} credits per month
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  ${costPer1K.toFixed(2)}/1K credits
                </span>
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
              <ul className="space-y-3">
                {getProFeatures().map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <button
                onClick={() => handleSubscribe(null, 'PRO', true)}
                disabled={isLoading === 'PRO' || currentPlan === 'pro'}
                className="w-full py-3 px-6 rounded-lg font-semibold transition-colors bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading === 'PRO' ? 'Loading...' : currentPlan === 'pro' ? 'Current Plan' : 'Get Started'}
              </button>
            </CardFooter>
          </Card>

          {/* Enterprise Plan */}
          <Card className="relative flex flex-col border-2 hover:border-purple-200 dark:hover:border-purple-800 transition-all">
            <CardHeader>
              <CardTitle className="text-2xl">Enterprise</CardTitle>
              <CardDescription>For large organizations</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold text-gray-900 dark:text-white">
                  ${billingCycle === 'monthly' ? '185' : '1,776'}
                </span>
                <span className="text-gray-600 dark:text-gray-400">/{billingCycle === 'monthly' ? 'month' : 'year'}</span>
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
                    <span className="text-gray-700 dark:text-gray-300">{feature}</span>
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
                className="w-full py-3 px-6 rounded-lg font-semibold transition-colors bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading === 'ENTERPRISE' ? 'Loading...' : currentPlan === 'enterprise' ? 'Current Plan' : 'Get Started'}
              </button>
            </CardFooter>
          </Card>
        </div>

        {/* FAQ Section */}
        <div className="mt-24 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
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
                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800"
              >
                <button
                  onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {faq.question}
                  </h3>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${
                      openFaqIndex === index ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openFaqIndex === index && (
                  <div className="px-6 pb-4 pt-2">
                    <p className="text-gray-600 dark:text-gray-400">
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
