'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, Calendar, Zap, ArrowUpRight, CheckCircle2, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import Sidebar from '@/components/Sidebar';

interface UsageHistoryItem {
  date: string;
  credits: number;
  description: string;
  model?: string;
}

interface UsageData {
  currentPlan: string;
  creditsUsed: number;
  creditsTotal: number;
  resetDate: string;
  usageHistory: UsageHistoryItem[];
  dailyUsage: { date: string; credits: number; requests: number }[];
}

export default function UsagePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/?auth=signin');
      return;
    }

    if (status === 'authenticated') {
      fetchUsageData();
    }
  }, [status, router]);

  const fetchUsageData = async () => {
    try {
      const response = await fetch('/api/usage/credits');
      if (!response.ok) throw new Error('Failed to fetch usage data');
      const data = await response.json();
      setUsageData(data);
    } catch (error) {
      console.error('Error fetching usage data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!usageData) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-gray-500">Failed to load usage data</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const usagePercentage = Math.min((usageData.creditsUsed / usageData.creditsTotal) * 100, 100);
  const creditsRemaining = Math.max(usageData.creditsTotal - usageData.creditsUsed, 0);

  return (
    <div className="relative">
      <Sidebar />
      <div className="lg:ml-64 transition-all duration-300">
        <div className="space-y-6">
      {/* Plan Header with Upgrade Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
          {usageData.currentPlan}
        </h2>
        <Button
          onClick={() => router.push('/pricing')}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6"
        >
          Upgrade
        </Button>
      </div>

      <div className="border-t border-dashed border-gray-300 dark:border-gray-700 my-6" />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Credits Card */}
        <Card className="border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Credits Display */}
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <div>
                    <p className="text-base font-medium text-gray-900 dark:text-white">Credits</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Free credits</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {creditsRemaining.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {usageData.creditsTotal.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Daily Refresh Credits */}
              <div className="flex items-center justify-between py-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <div>
                    <p className="text-base font-medium text-gray-900 dark:text-white">Daily refresh credits</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Refresh to {usageData.creditsTotal.toLocaleString()} at{' '}
                      {new Date(usageData.resetDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {Math.floor(usageData.creditsTotal * 0.3).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                  {usageData.creditsUsed.toLocaleString()}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Credits consumed
                </p>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {usageData.usageHistory.length}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Total requests
                </p>
              </div>

              <Button
                onClick={() => router.push('/pricing')}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
              >
                Upgrade Plan
                <ArrowUpRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Chart */}
      {usageData.dailyUsage && usageData.dailyUsage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-500" />
              Credits Usage Over Time
            </CardTitle>
            <CardDescription>Daily credit consumption for the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={usageData.dailyUsage}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis
                  dataKey="date"
                  className="text-gray-600 dark:text-gray-400"
                  tickFormatter={(value) => format(new Date(value), 'MMM d')}
                />
                <YAxis className="text-gray-600 dark:text-gray-400" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                  labelFormatter={(value) => format(new Date(value), 'MMM d, yyyy')}
                />
                <Line
                  type="monotone"
                  dataKey="credits"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Usage History Table */}
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardContent className="p-0">
          {usageData.usageHistory.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                <CheckCircle2 className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400">No usage data yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Start using the AI assistant to see your usage here
              </p>
            </div>
          ) : (
            <div className="overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-3 gap-4 px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Details</div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Date</div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 text-right">Credits change</div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[500px] overflow-y-auto">
                {usageData.usageHistory.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-3 gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-900 dark:text-white">
                        {item.description}
                      </p>
                      {item.model && (
                        <Badge variant="outline" className="text-xs">
                          {item.model}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(item.date).toLocaleString('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <div className="text-sm font-semibold text-right">
                      <span className="text-red-600 dark:text-red-400">
                        -{item.credits.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credit Info Card */}
      <Card className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200 dark:border-purple-900/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Zap className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                How Credits Work
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Credits are consumed based on the AI model used and the complexity of your requests:
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-0.5">•</span>
                  <span><strong>Haiku 4.5:</strong> ~1 credit per 1000 tokens</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-0.5">•</span>
                  <span><strong>Sonnet 4.5:</strong> ~3 credits per 1000 tokens</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-0.5">•</span>
                  <span><strong>Opus 4.5:</strong> ~15 credits per 1000 tokens</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
        </div>
      </div>
    </div>
  );
}
