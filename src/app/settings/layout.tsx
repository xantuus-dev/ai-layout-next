'use client';

import { usePathname, useRouter } from 'next/navigation';
import { User, CreditCard, BarChart3, Key, ArrowLeft, Plug } from 'lucide-react';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const tabs = [
    { name: 'Account', href: '/settings/account', icon: User },
    { name: 'Billing', href: '/settings/billing', icon: CreditCard },
    { name: 'Usage', href: '/settings/usage', icon: BarChart3 },
    { name: 'API Keys', href: '/settings/api-keys', icon: Key },
    { name: 'Integrations', href: '/settings/integrations', icon: Plug },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Back button */}
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage your account settings and preferences
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = pathname === tab.href;

              return (
                <button
                  key={tab.name}
                  onClick={() => router.push(tab.href)}
                  className={`
                    flex items-center gap-2 pb-4 px-1 border-b-2 font-medium text-sm transition-colors
                    ${isActive
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div>{children}</div>
      </div>
    </div>
  );
}
