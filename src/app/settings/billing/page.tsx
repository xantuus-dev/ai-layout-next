'use client';

import { useState, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, ExternalLink, Check, X } from 'lucide-react';
import { format } from 'date-fns';

function BillingPageContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  const handleManageSubscription = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!session) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-gray-600 dark:text-gray-400">
            Please sign in to view your billing information.
          </p>
        </CardContent>
      </Card>
    );
  }

  const plan = session.user?.plan || 'free';
  const isPaidPlan = plan !== 'free';

  return (
    <div className="space-y-6">
      {/* Success/Cancel Messages */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
          <Check className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
          <div>
            <h3 className="font-semibold text-green-900 dark:text-green-100">
              Subscription activated!
            </h3>
            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
              Your subscription has been successfully activated. Thank you!
            </p>
          </div>
        </div>
      )}

      {canceled && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <X className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900 dark:text-red-100">
              Checkout canceled
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              Your subscription was not activated. You can try again anytime.
            </p>
          </div>
        </div>
      )}

      {/* Current Subscription */}
      <Card>
        <CardHeader>
          <CardTitle>Current Subscription</CardTitle>
          <CardDescription>Manage your billing and subscription</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Plan Info */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Current Plan</p>
              <Badge
                className={
                  plan === 'free'
                    ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                    : plan === 'pro'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
                    : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100'
                }
              >
                {plan.toUpperCase()}
              </Badge>
              {isPaidPlan && session.user?.stripeCurrentPeriodEnd && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Renews on {format(new Date(session.user.stripeCurrentPeriodEnd), 'MMMM d, yyyy')}
                </p>
              )}
            </div>

            {!isPaidPlan ? (
              <button
                onClick={() => router.push('/pricing')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Upgrade Plan
              </button>
            ) : (
              <button
                onClick={handleManageSubscription}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                <CreditCard className="w-4 h-4" />
                {isLoading ? 'Loading...' : 'Manage Subscription'}
                <ExternalLink className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Features */}
          <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Plan Features</h3>
            <ul className="space-y-2">
              {plan === 'free' && (
                <>
                  <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Check className="w-4 h-4 text-green-500" />
                    1,000 credits per month
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Check className="w-4 h-4 text-green-500" />
                    Basic AI models
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Check className="w-4 h-4 text-green-500" />
                    Email support
                  </li>
                </>
              )}
              {plan === 'pro' && (
                <>
                  <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Check className="w-4 h-4 text-green-500" />
                    50,000 credits per month
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Check className="w-4 h-4 text-green-500" />
                    All AI models
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Check className="w-4 h-4 text-green-500" />
                    Priority support
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Check className="w-4 h-4 text-green-500" />
                    API access
                  </li>
                </>
              )}
              {plan === 'enterprise' && (
                <>
                  <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Check className="w-4 h-4 text-green-500" />
                    500,000 credits per month
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Check className="w-4 h-4 text-green-500" />
                    All AI models
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Check className="w-4 h-4 text-green-500" />
                    Dedicated support
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Check className="w-4 h-4 text-green-500" />
                    Unlimited API access
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Check className="w-4 h-4 text-green-500" />
                    SLA guarantee
                  </li>
                </>
              )}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Billing Info */}
      {isPaidPlan && (
        <Card>
          <CardHeader>
            <CardTitle>Billing Information</CardTitle>
            <CardDescription>Manage payment methods and invoices</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Click &quot;Manage Subscription&quot; above to update your payment method, view invoices, or cancel your subscription.
            </p>
            <button
              onClick={handleManageSubscription}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <ExternalLink className="w-4 h-4" />
              {isLoading ? 'Loading...' : 'Open Billing Portal'}
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <BillingPageContent />
    </Suspense>
  );
}
