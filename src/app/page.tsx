'use client';

import PromptCard from '@/components/ui/PromptCard';
import MiniCard from '@/components/ui/MiniCard';
import AuthModal from '@/components/ui/AuthModal';
import ThemeToggle from '@/components/ThemeToggle';
import UserProfileDropdown from '@/components/UserProfileDropdown';
import { CreditsCard } from '@/components/CreditsCard';
import { useState } from 'react';
import { useSession } from 'next-auth/react';

export default function Home() {
  const { data: session, status } = useSession();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const isAuthenticated = status === 'authenticated';

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />

      <header className="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex justify-between items-center">
          <nav className="flex items-center gap-6">
            <a
              href="/"
              className="flex items-center"
            >
              <img
                src="/xantuus-logo.svg"
                alt="Xantuus AI"
                className="h-8 w-auto dark:hidden"
              />
              <img
                src="/xantuus-logo-dark.svg"
                alt="Xantuus AI"
                className="h-8 w-auto hidden dark:block"
              />
            </a>
            <a
              href="/pricing"
              className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Pricing
            </a>
            <a
              href="/templates"
              className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Templates
            </a>
            {isAuthenticated && (
              <>
                <a
                  href="/workspace"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Workspace
                </a>
                <a
                  href="/settings/account"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Settings
                </a>
              </>
            )}
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {!isAuthenticated ? (
              <>
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-6 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full hover:opacity-90 transition-opacity shadow-md"
                >
                  Sign Up
                </button>
              </>
            ) : (
              <>
                <CreditsCard />
                <UserProfileDropdown />
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="space-y-8">
          <PromptCard />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MiniCard
              title="AI Agents"
              badges={['Popular']}
              cta={[
                { text: 'Learn More', href: '/contact', variant: 'primary' }
              ]}
            >
              <p className="text-gray-600 dark:text-gray-300">
                Build intelligent agents that automate complex workflows and decision-making.
              </p>
            </MiniCard>

            <MiniCard
              title="Automation"
              badges={['New']}
              cta={[
                { text: 'Get Started', href: '/contact', variant: 'primary' }
              ]}
            >
              <p className="text-gray-600 dark:text-gray-300">
                Streamline operations with AI-powered automation solutions.
              </p>
            </MiniCard>
          </div>
        </div>
      </div>
    </main>
  );
}
