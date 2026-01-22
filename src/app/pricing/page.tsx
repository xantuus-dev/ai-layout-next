'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronDown } from 'lucide-react';
import { PLANS } from '@/lib/stripe';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CREDITS_OPTIONS = [
  "8,000 credits / month",
  "12,000 credits / month",
  "16,000 credits / month",
  "20,000 credits / month",
  "40,000 credits / month",
  "63,000 credits / month",
  "85,000 credits / month",
  "110,000 credits / month",
  "170,000 credits / month",
  "230,000 credits / month",
  "350,000 credits / month",
  "480,000 credits / month",
  "1,200,000 credits / month",
];

// Pricing map based on credits
const CREDITS_PRICING: Record<string, number> = {
  "8,000 credits / month": 40,
  "12,000 credits / month": 60,
  "16,000 credits / month": 80,
  "20,000 credits / month": 100,
  "40,000 credits / month": 185,
  "63,000 credits / month": 280,
  "85,000 credits / month": 370,
  "110,000 credits / month": 475,
  "170,000 credits / month": 725,
  "230,000 credits / month": 975,
  "350,000 credits / month": 1470,
  "480,000 credits / month": 2010,
  "1,200,000 credits / month": 5000,
};

export default function PricingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [selectedCredits, setSelectedCredits] = useState<string>("12,000 credits / month");
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const handleSubscribe = async (priceId: string | null | undefined, planName: string) => {
    if (!session) {
      router.push('/?auth=signin');
      return;
    }

    if (!priceId) {
      // Free plan - no checkout needed
      return;
    }

    setIsLoading(planName);

    try {
      // Use Stripe checkout endpoint
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId,
        }),
      });

      const data = await response.json();

      if (data.error) {
        // Handle errors (e.g., already subscribed)
        if (data.redirect) {
          alert(data.message || data.error);
          router.push(data.redirect);
        } else {
          alert(data.error);
        }
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setIsLoading(null);
    }
  };

  const currentPlan = session?.user?.plan || 'free';

  // Calculate pricing based on billing cycle (20% off for yearly)
  const calculatePrice = (monthlyPrice: number) => {
    if (billingCycle === 'yearly') {
      return Math.round(monthlyPrice * 12 * 0.8); // 20% discount on yearly
    }
    return monthlyPrice;
  };

  const calculateSavings = (monthlyPrice: number) => {
    const yearlyFull = monthlyPrice * 12;
    const yearlyDiscounted = monthlyPrice * 12 * 0.8;
    return Math.round(yearlyFull - yearlyDiscounted);
  };

  // Create dynamic Pro plan features based on selected credits
  const getProFeatures = (): string[] => {
    const baseFeatures: string[] = [...PLANS.PRO.features];
    baseFeatures[1] = selectedCredits; // Replace the credits line with selected value
    return baseFeatures;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-16 md:py-24">
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
                  ${calculatePrice(CREDITS_PRICING[selectedCredits] || 60)}
                </span>
                <span className="text-gray-600 dark:text-gray-400">/{billingCycle === 'monthly' ? 'month' : 'year'}</span>
              </div>
              {billingCycle === 'yearly' && (
                <div className="mt-2">
                  <span className="text-sm text-green-600 dark:text-green-400 font-semibold">
                    Save ${calculateSavings(CREDITS_PRICING[selectedCredits] || 60)}/year
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
                    {CREDITS_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">
                  {selectedCredits.split(' ')[0]} credits {billingCycle === 'monthly' ? 'per month' : 'per month'}
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  ${((CREDITS_PRICING[selectedCredits] || 60) / (parseInt(selectedCredits.replace(/,/g, '')) / 1000)).toFixed(2)}/1K credits
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
                onClick={() => handleSubscribe(PLANS.PRO.priceId, 'PRO')}
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
                  ${calculatePrice(199)}
                </span>
                <span className="text-gray-600 dark:text-gray-400">/{billingCycle === 'monthly' ? 'month' : 'year'}</span>
              </div>
              {billingCycle === 'yearly' && (
                <div className="mt-2">
                  <span className="text-sm text-green-600 dark:text-green-400 font-semibold">
                    Save ${calculateSavings(199)}/year
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
                onClick={() => handleSubscribe(PLANS.ENTERPRISE.priceId, 'ENTERPRISE')}
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
