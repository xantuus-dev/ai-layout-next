'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Sparkles, Calendar, HelpCircle, ChevronRight } from 'lucide-react';
import { PLAN_DEFINITIONS } from '@/lib/plans';

interface CreditInfo {
  totalCredits: number;
  monthlyCredits: number;
  creditsUsed: number;
  creditsRemaining: number;
  plan: string;
  dailyRefreshCredits: number;
  freeCredits: number;
  nextResetTime: string;
}

const PLAN_ORDER = ['free', 'pro', 'enterprise'];

export function CreditsCard() {
  const { data: session } = useSession();
  const router = useRouter();
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (session?.user) {
      fetchCreditInfo();
    }
  }, [session]);

  const fetchCreditInfo = async () => {
    try {
      const response = await fetch('/api/usage/credits');
      if (response.ok) {
        const data = await response.json();
        setCreditInfo(data);
      }
    } catch (error) {
      console.error('Error fetching credit info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getNextPlan = () => {
    const currentPlan = session?.user?.plan || 'free';
    const currentIndex = PLAN_ORDER.indexOf(currentPlan);
    if (currentIndex < PLAN_ORDER.length - 1) {
      return PLAN_ORDER[currentIndex + 1];
    }
    return null;
  };

  const handleUpgrade = () => {
    router.push('/pricing');
    setIsOpen(false);
  };

  const handleViewUsage = () => {
    router.push('/settings/usage');
    setIsOpen(false);
  };

  if (!session?.user) {
    return null;
  }

  const currentPlan = session.user.plan || 'free';
  const planName = currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1);
  const nextPlan = getNextPlan();
  const totalCredits = creditInfo?.creditsRemaining || 0;
  const dailyRefresh = 500; // Daily refresh credits
  const freeCredits = creditInfo?.freeCredits || 0;

  return (
    <div className="relative">
      {/* Credits Badge Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors border border-gray-700 dark:border-gray-600"
      >
        <Sparkles className="w-4 h-4 text-yellow-400" />
        <span className="text-white font-semibold">
          {totalCredits.toLocaleString()}
        </span>
      </button>

      {/* Credits Card Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Card */}
          <div className="absolute right-0 top-full mt-2 w-[400px] z-50 rounded-2xl bg-gray-900 dark:bg-gray-800 border border-gray-700 dark:border-gray-600 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-white text-xl font-bold">{planName}</span>
                {currentPlan === 'free' && (
                  <span className="text-xs text-gray-400 px-2 py-1 rounded-full bg-gray-800 dark:bg-gray-700">
                    Free
                  </span>
                )}
                {currentPlan === 'pro' && (
                  <span className="text-xs text-blue-400 px-2 py-1 rounded-full bg-blue-900/30">
                    Pro
                  </span>
                )}
                {currentPlan === 'enterprise' && (
                  <span className="text-xs text-purple-400 px-2 py-1 rounded-full bg-purple-900/30">
                    Enterprise
                  </span>
                )}
              </div>
              {nextPlan && (
                <button
                  onClick={handleUpgrade}
                  className="px-4 py-2 rounded-full bg-white hover:bg-gray-100 text-gray-900 font-semibold text-sm transition-colors"
                >
                  Upgrade
                </button>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-gray-700 dark:border-gray-600 mx-6" />

            {/* Credits Section */}
            <div className="p-6 space-y-4">
              {/* Total Credits */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                  <span className="text-white font-semibold">Credits</span>
                  <button className="text-gray-400 hover:text-gray-300">
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-white text-xl font-bold">
                  {totalCredits.toLocaleString()}
                </span>
              </div>

              {/* Free Credits */}
              <div className="flex items-center justify-between pl-7">
                <span className="text-gray-400 text-sm">Free credits</span>
                <span className="text-gray-400 text-sm">
                  {freeCredits.toLocaleString()}
                </span>
              </div>

              {/* Daily Refresh Credits */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <span className="text-white font-semibold">Daily refresh credits</span>
                    <button className="text-gray-400 hover:text-gray-300">
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-white text-xl font-bold">
                    {dailyRefresh}
                  </span>
                </div>
                <p className="text-gray-400 text-sm pl-7">
                  Refresh to {dailyRefresh} at 00:00 every day
                </p>
              </div>
            </div>

            {/* View Usage Link */}
            <div className="border-t border-gray-700 dark:border-gray-600">
              <button
                onClick={handleViewUsage}
                className="w-full px-6 py-4 flex items-center justify-between text-gray-400 hover:text-white hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="font-medium">View usage</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
