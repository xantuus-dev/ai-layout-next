'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { Turnstile } from '@marsidev/react-turnstile';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim() && isVerified) {
      setShowSuccess(true);
      // In production, implement email authentication here
      setTimeout(() => {
        onSuccess();
        onClose();
        setShowSuccess(false);
        setEmail('');
        setIsVerified(false);
      }, 2000);
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'apple' | 'azure-ad') => {
    try {
      setError('');
      console.log('Initiating OAuth login with provider:', provider);

      // Sign in with OAuth provider - this will redirect to provider's OAuth page
      const result = await signIn(provider, {
        callbackUrl: window.location.origin,
        redirect: true,
      });

      console.log('SignIn result:', result);
      // Note: Code after this typically won't execute as the page redirects
    } catch (error) {
      console.error('OAuth error:', error);
      setError('Failed to initiate login. Please try again.');
    }
  };

  const handleTurnstileSuccess = (token: string) => {
    setTurnstileToken(token);
    setIsVerified(true);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      {/* Modal */}
      <div className="relative w-full max-w-lg bg-[#1a1a1a] rounded-2xl shadow-2xl overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-8 md:p-12">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              Sign in or sign up
            </h2>
            <p className="text-gray-400 text-base">
              Start creating with Xantuus AI
            </p>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-3 mb-6">
            {/* Google */}
            <button
              onClick={() => handleOAuthLogin('google')}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#2a2a2a] hover:bg-[#333333] text-white rounded-xl transition-colors font-medium"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            {/* Microsoft */}
            <button
              onClick={() => handleOAuthLogin('azure-ad')}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#2a2a2a] hover:bg-[#333333] text-white rounded-xl transition-colors font-medium"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#f25022" d="M0 0h11.377v11.377H0z"/>
                <path fill="#00a4ef" d="M12.623 0H24v11.377H12.623z"/>
                <path fill="#7fba00" d="M0 12.623h11.377V24H0z"/>
                <path fill="#ffb900" d="M12.623 12.623H24V24H12.623z"/>
              </svg>
              Continue with Microsoft
            </button>

            {/* Apple */}
            <button
              onClick={() => handleOAuthLogin('apple')}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#2a2a2a] hover:bg-[#333333] text-white rounded-xl transition-colors font-medium"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              Continue with Apple
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#1a1a1a] text-gray-400">Or</span>
            </div>
          </div>

          {/* Email Input */}
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-4 py-4 bg-[#2a2a2a] text-white rounded-xl border border-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors placeholder:text-gray-500"
                required
              />
            </div>

            {/* Cloudflare Turnstile */}
            {!showSuccess && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
              <div className="flex justify-center">
                <Turnstile
                  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                  onSuccess={handleTurnstileSuccess}
                />
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {showSuccess && (
              <div className="p-4 bg-[#2a2a2a] border border-gray-700 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-white font-semibold text-lg">Success!</span>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <a href="#" className="hover:text-white transition-colors">Privacy</a>
                    <span>•</span>
                    <a href="#" className="hover:text-white transition-colors">Terms</a>
                  </div>
                </div>
              </div>
            )}

            {/* Continue Button */}
            <button
              type="submit"
              className="w-full py-4 bg-white hover:bg-gray-100 text-black font-semibold rounded-xl transition-colors text-lg"
            >
              Continue
            </button>
          </form>

          {/* Footer Links */}
          <div className="mt-6 text-center text-xs text-gray-500">
            By continuing, you agree to our{' '}
            <a href="#" className="text-gray-400 hover:text-white transition-colors">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</a>
          </div>
        </div>
      </div>
    </div>
  );
}
