'use client';

/**
 * Usage Section
 *
 * View usage statistics and billing information
 */

import { useState, useEffect } from 'react';
import { TrendingUp, Zap, Calendar, CreditCard } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CreditStatus {
  plan: string;
  monthlyCredits: number;
  creditsUsed: number;
  creditsRemaining: number;
}

export function UsageSection() {
  const router = useRouter();
  const [creditStatus, setCreditStatus] = useState<CreditStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCreditStatus();
  }, []);

  const fetchCreditStatus = async () => {
    try {
      const response = await fetch('/api/usage/credits');
      if (response.ok) {
        const data = await response.json();
        setCreditStatus({
          plan: data.currentPlan,
          monthlyCredits: data.creditsTotal,
          creditsUsed: data.creditsUsed,
          creditsRemaining: data.creditsTotal - data.creditsUsed,
        });
      }
    } catch (error) {
      console.error('Error fetching credit status:', error);
    } finally {
      setLoading(false);
    }
  };

  const usagePercentage = creditStatus
    ? Math.min((creditStatus.creditsUsed / creditStatus.monthlyCredits) * 100, 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-white mb-2">Usage</h2>
        <p className="text-sm text-gray-400">
          Monitor your credit usage and subscription details
        </p>
      </div>

      {/* Current Plan */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6 text-blue-400" />
            <div>
              <h3 className="text-lg font-semibold text-white">
                {creditStatus?.plan || 'Free'} Plan
              </h3>
              <p className="text-xs text-gray-400">Monthly subscription</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/pricing')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Upgrade Plan
          </button>
        </div>
      </div>

      {/* Credits Usage */}
      <div className="bg-[#252525] border border-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="w-5 h-5 text-green-400" />
          <h3 className="text-lg font-semibold text-white">Credits Usage</h3>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : (
          <div className="space-y-4">
            {/* Credits Display */}
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-white">
                {creditStatus?.creditsRemaining.toLocaleString() || '0'}
              </span>
              <span className="text-lg text-gray-400">
                / {creditStatus?.monthlyCredits.toLocaleString() || '0'}
              </span>
              <span className="text-sm text-gray-500 ml-2">credits remaining</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${usagePercentage}%` }}
              />
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-400">
                {creditStatus?.creditsUsed.toLocaleString() || '0'} used
              </span>
              <span className="text-gray-400">
                {usagePercentage.toFixed(1)}% consumed
              </span>
            </div>

            {/* Detailed View Link */}
            <button
              onClick={() => router.push('/settings/usage')}
              className="w-full mt-4 px-4 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg text-sm text-gray-200 hover:bg-[#2a2a2a] transition-colors"
            >
              View Detailed Usage Analytics
            </button>
          </div>
        )}
      </div>

      {/* Billing Information */}
      <div className="bg-[#252525] border border-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <CreditCard className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Billing</h3>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-[#1a1a1a] border border-gray-800 rounded-lg">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-200">Next Billing Date</p>
                <p className="text-xs text-gray-500">
                  {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => router.push('/settings/billing')}
            className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-800 rounded-lg text-sm text-gray-200 hover:bg-[#2a2a2a] transition-colors text-left"
          >
            Manage Billing & Payment Methods
          </button>
        </div>
      </div>

      {/* Usage Tips */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
        <h4 className="text-sm font-semibold text-blue-400 mb-2">💡 Usage Tips</h4>
        <ul className="space-y-1 text-sm text-gray-400">
          <li>• Use Haiku model for simple tasks to save credits</li>
          <li>• Batch similar operations to optimize credit usage</li>
          <li>• Monitor your usage regularly to avoid hitting limits</li>
          <li>• Upgrade to Pro for 3x more monthly credits</li>
        </ul>
      </div>
    </div>
  );
}
