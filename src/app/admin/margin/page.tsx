'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import type { MarginReport } from '@/lib/admin/margin';

const PERIOD_OPTIONS = [7, 30, 90];

function formatUsd(value: number, digits = 2): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export default function AdminMarginPage() {
  const { status } = useSession();
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<MarginReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async (periodDays: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/margin?days=${periodDays}`);
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to load margin report');
        return;
      }
      setReport(data);
    } catch {
      setError('Failed to load margin report');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchReport(days);
    }
  }, [status, days, fetchReport]);

  if (status === 'loading' || (status === 'authenticated' && isLoading && !report && !error)) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  }

  if (status !== 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Please sign in.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
            <p className="text-gray-900 dark:text-white font-medium">{error}</p>
            <p className="text-sm text-gray-500 mt-1">This dashboard is restricted to the admin account.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!report) return null;

  const marginIsPositive = report.totals.impliedMargin >= 0;

  return (
    <main className="min-h-screen p-4 md:p-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Margin Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Real AI cost vs. implied revenue, by model and customer</p>
          </div>
          <div className="flex gap-2">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => setDays(option)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  days === option
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                }`}
              >
                {option}d
              </button>
            ))}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">Requests</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{report.totals.requests.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">Real AI cost</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatUsd(report.totals.realCost)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">Implied revenue</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatUsd(report.totals.impliedRevenue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">Implied margin</p>
              <p className={`text-2xl font-bold flex items-center gap-1 ${marginIsPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {marginIsPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                {formatUsd(report.totals.impliedMargin)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* By model */}
        <Card>
          <CardHeader>
            <CardTitle>By Model</CardTitle>
            <CardDescription>Sorted by real cost, highest first</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4">Model</th>
                  <th className="py-2 pr-4">Requests</th>
                  <th className="py-2 pr-4">Credits charged</th>
                  <th className="py-2 pr-4">Real cost</th>
                  <th className="py-2 pr-4">Implied revenue</th>
                  <th className="py-2 pr-4">Break-even $/credit</th>
                </tr>
              </thead>
              <tbody>
                {report.byModel.map((row) => {
                  const rowMargin = row.impliedRevenue - row.realCost;
                  return (
                    <tr key={row.model} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 pr-4">
                        <div className="font-medium text-gray-900 dark:text-white">{row.model}</div>
                        {row.provider && <Badge className="mt-1 text-xs">{row.provider}</Badge>}
                      </td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{row.requests.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{row.creditsCharged.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{formatUsd(row.realCost, 4)}</td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{formatUsd(row.impliedRevenue, 4)}</td>
                      <td className={`py-2 pr-4 font-medium ${rowMargin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {row.breakEvenRatePerCredit !== null ? `$${row.breakEvenRatePerCredit.toFixed(5)}` : '—'}
                      </td>
                    </tr>
                  );
                })}
                {report.byModel.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-gray-500">No usage in this period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Top customers by cost */}
        <Card>
          <CardHeader>
            <CardTitle>Top Customers by Cost</CardTitle>
            <CardDescription>Who's actually expensive to serve, regardless of what plan they're on</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4">Customer</th>
                  <th className="py-2 pr-4">Plan</th>
                  <th className="py-2 pr-4">Credits charged</th>
                  <th className="py-2 pr-4">Real cost</th>
                  <th className="py-2 pr-4">Implied revenue</th>
                  <th className="py-2 pr-4">Margin</th>
                </tr>
              </thead>
              <tbody>
                {report.topCustomersByCost.map((row) => {
                  const rowMargin = row.impliedRevenue - row.realCost;
                  return (
                    <tr key={row.userId} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 pr-4">
                        <div className="font-medium text-gray-900 dark:text-white">{row.name || row.email}</div>
                        {row.name && <div className="text-xs text-gray-500">{row.email}</div>}
                      </td>
                      <td className="py-2 pr-4"><Badge className="text-xs">{row.plan}</Badge></td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{row.creditsCharged.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{formatUsd(row.realCost, 4)}</td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{formatUsd(row.impliedRevenue, 4)}</td>
                      <td className={`py-2 pr-4 font-medium ${rowMargin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatUsd(rowMargin, 4)}
                      </td>
                    </tr>
                  );
                })}
                {report.topCustomersByCost.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-gray-500">No usage in this period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {report.caveats.length > 0 && (
          <Card className="border-yellow-200 dark:border-yellow-800">
            <CardContent className="pt-6 space-y-1">
              {report.caveats.map((caveat, i) => (
                <p key={i} className="text-xs text-yellow-800 dark:text-yellow-300">⚠ {caveat}</p>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
