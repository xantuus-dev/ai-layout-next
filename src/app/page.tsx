'use client';

import PromptCard from '@/components/ui/PromptCard';
import MiniCard from '@/components/ui/MiniCard';
import AuthModal from '@/components/ui/AuthModal';
import ThemeToggle from '@/components/ThemeToggle';
import UserProfileDropdown from '@/components/UserProfileDropdown';
import { CreditsCard } from '@/components/CreditsCard';
import SidebarLayout from '@/components/SidebarLayout';
import LandingPage from '@/components/LandingPage';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

function CheckoutSuccessBanner({
  show,
  onDismiss,
  onSignIn,
}: {
  show: boolean;
  onDismiss: () => void;
  onSignIn: () => void;
}) {
  if (!show) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-md w-full mx-4">
      <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-500 rounded-lg p-6 shadow-xl backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
              Payment Successful!
            </h3>
            <p className="text-sm text-green-700 dark:text-green-300 mb-4">
              Your subscription is active. Sign in with the email you used during checkout to access your account.
            </p>
            <button
              onClick={onSignIn}
              className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
            >
              Sign In Now
            </button>
          </div>
          <button onClick={onDismiss} className="flex-shrink-0 text-green-500 hover:text-green-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { status } = useSession();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false);

  const isAuthenticated = status === 'authenticated';

  // Check for checkout success parameter
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('checkout') === 'success') {
        setShowCheckoutSuccess(true);
        window.history.replaceState({}, '', '/');
      }
    }
  }, []);

  const checkoutBanner = (
    <CheckoutSuccessBanner
      show={showCheckoutSuccess && !isAuthenticated}
      onDismiss={() => setShowCheckoutSuccess(false)}
      onSignIn={() => {
        setShowCheckoutSuccess(false);
        setShowAuthModal(true);
      }}
    />
  );

  // Avoid a flash of the marketing page for a user who's actually signed in
  if (status === 'loading') {
    return <div className="min-h-screen bg-background" />;
  }

  if (!isAuthenticated) {
    return (
      <>
        {checkoutBanner}
        <LandingPage />
      </>
    );
  }

  return (
    <SidebarLayout>
      {checkoutBanner}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => setShowAuthModal(false)}
      />

      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="px-4 md:px-8 py-4 flex justify-between items-center ml-16 lg:ml-0">
          <div className="lg:hidden">
            <a href="/" className="flex items-center">
              <img
                src="/xantuus-logo-dark.png"
                alt="Xantuus AI"
                className="h-12 w-auto object-contain dark:hidden"
              />
              <img
                src="/xantuus-logo-white.png"
                alt="Xantuus AI"
                className="h-12 w-auto object-contain hidden dark:block"
              />
            </a>
          </div>

          <div className="hidden lg:block">
            <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <ThemeToggle />
            <CreditsCard />
            <UserProfileDropdown />
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
              <p className="text-muted-foreground">
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
              <p className="text-muted-foreground">
                Streamline operations with AI-powered automation solutions.
              </p>
            </MiniCard>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
