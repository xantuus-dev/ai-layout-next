'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { LogOut, Sparkles, TrendingUp, User, Settings, Link2, Puzzle } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { SettingsModal } from '@/components/SettingsModal';

interface CreditStatus {
  plan: string;
  monthlyCredits: number;
  creditsUsed: number;
  creditsRemaining: number;
}

export default function UserProfileDropdown() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSection, setSettingsSection] = useState<string>('account');
  const [creditStatus, setCreditStatus] = useState<CreditStatus | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch credit status when dropdown opens
  useEffect(() => {
    if (isOpen && session) {
      fetchCreditStatus();
    }
  }, [isOpen, session]);

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
    }
  };

  if (!session?.user) return null;

  const user = session.user;
  const userName = user.name || user.email || 'User';
  const userInitial = userName.charAt(0).toUpperCase();
  const userImage = user.image;

  const planColors: Record<string, string> = {
    FREE: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    PRO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    ENTERPRISE: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 focus:outline-none group"
      >
        <div className="relative">
          {userImage ? (
            <img
              src={userImage}
              alt={userName}
              className="w-9 h-9 rounded-full border-2 border-gray-200 dark:border-gray-700 group-hover:border-blue-500 dark:group-hover:border-blue-400 transition-colors"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm border-2 border-gray-200 dark:border-gray-700 group-hover:border-blue-500 dark:group-hover:border-blue-400 transition-colors shadow-sm">
              {userInitial}
            </div>
          )}
          {/* Online indicator */}
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50 animate-fade-in">
          {/* User Info Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-center gap-3">
              {userImage ? (
                <img
                  src={userImage}
                  alt={userName}
                  className="w-12 h-12 rounded-full border-2 border-gray-200 dark:border-gray-700"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                  {userInitial}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {userName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user.email}
                </p>
              </div>
            </div>
          </div>

          {/* Plan & Credits Section */}
          <div className="p-4 space-y-3">
            {/* Current Plan */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900/50 dark:to-gray-800/50 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Current Plan</p>
                  <p className={`text-sm font-semibold px-2 py-0.5 rounded inline-block mt-1 ${
                    planColors[creditStatus?.plan || 'FREE'] || planColors.FREE
                  }`}>
                    {creditStatus?.plan || 'Free'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push('/pricing');
                }}
                className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg transition-colors shadow-sm"
              >
                Upgrade
              </button>
            </div>

            {/* Credits Display */}
            <div className="p-3 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800/50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <p className="text-xs text-gray-600 dark:text-gray-400">Credits Available</p>
                </div>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    router.push('/settings/usage');
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  View Usage
                </button>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {creditStatus?.creditsRemaining?.toLocaleString() || '---'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  / {creditStatus?.monthlyCredits?.toLocaleString() || '---'}
                </p>
              </div>
              {creditStatus && (
                <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                  <div
                    className="bg-gradient-to-r from-green-500 to-emerald-500 h-1.5 rounded-full transition-all"
                    style={{
                      width: `${Math.min((creditStatus.creditsUsed / creditStatus.monthlyCredits) * 100, 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Menu Items */}
          <div className="border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/workspace');
              }}
              className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-3"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Workspace
            </button>

            <button
              onClick={() => {
                setSettingsSection('account');
                setShowSettings(true);
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-3"
            >
              <User className="w-4 h-4" />
              Account
            </button>

            <button
              onClick={() => {
                setSettingsSection('settings');
                setShowSettings(true);
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-3"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>

            <button
              onClick={() => {
                setSettingsSection('usage');
                setShowSettings(true);
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-3"
            >
              <TrendingUp className="w-4 h-4" />
              Usage
            </button>

            <button
              onClick={() => {
                setSettingsSection('personalization');
                setShowSettings(true);
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-3"
            >
              <Sparkles className="w-4 h-4" />
              Personalization
            </button>

            <button
              onClick={() => {
                setSettingsSection('connectors');
                setShowSettings(true);
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-3"
            >
              <Link2 className="w-4 h-4" />
              Connectors
            </button>

            <button
              onClick={() => {
                setSettingsSection('integrations');
                setShowSettings(true);
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-3"
            >
              <Puzzle className="w-4 h-4" />
              Integrations
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                signOut();
              }}
              className="w-full px-4 py-3 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-3 border-t border-gray-200 dark:border-gray-700"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        initialSection={settingsSection}
      />
    </div>
  );
}
