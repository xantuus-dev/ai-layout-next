'use client';

import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import Sidebar from '@/components/Sidebar';

export default function AccountPage() {
  const { data: session } = useSession();

  if (!session) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-gray-600 dark:text-gray-400">
            Please sign in to view your account settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getPlanBadge = () => {
    const plan = session.user?.plan || 'free';
    const colors = {
      free: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
      pro: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
      enterprise: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
    };

    return (
      <Badge className={colors[plan as keyof typeof colors]}>
        {plan.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="relative">
      <Sidebar />
      <div className="lg:ml-64 transition-all duration-300">
        <div className="space-y-6">
      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Your account information from your OAuth provider
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <Avatar className="w-20 h-20">
              <AvatarImage src={session.user?.image || ''} alt={session.user?.name || ''} />
              <AvatarFallback className="text-2xl">
                {session.user?.name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Profile Picture</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Managed by your OAuth provider
              </p>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={session.user?.name || ''}
              disabled
              className="bg-gray-50 dark:bg-gray-800"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={session.user?.email || ''}
              disabled
              className="bg-gray-50 dark:bg-gray-800"
            />
          </div>
        </CardContent>
      </Card>

      {/* Plan Card */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>Your subscription plan and limits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Plan</p>
              <div className="mt-1">{getPlanBadge()}</div>
            </div>
            <a
              href="/pricing"
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              Upgrade Plan
            </a>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Monthly Credits</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {session.user?.monthlyCredits?.toLocaleString() || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Credits Used</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {session.user?.creditsUsed?.toLocaleString() || 0}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>Usage</span>
                <span>
                  {Math.round(
                    ((session.user?.creditsUsed || 0) / (session.user?.monthlyCredits || 1)) * 100
                  )}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      ((session.user?.creditsUsed || 0) / (session.user?.monthlyCredits || 1)) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
        </div>
      </div>
    </div>
  );
}
