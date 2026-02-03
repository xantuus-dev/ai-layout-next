/**
 * Browser Control Page
 *
 * Provides secure browser automation interface for Pro and Enterprise users
 */

import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import BrowserTabbedInterface from '@/components/browser/BrowserTabbedInterface';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Browser Control | AI Layout',
  description: 'Secure automated web browsing with AI',
};

export default async function BrowserPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect('/');
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { plan: true, monthlyCredits: true, creditsUsed: true },
  });

  if (!user) {
    redirect('/');
  }

  // Check if user has access
  const hasAccess = user.plan === 'pro' || user.plan === 'enterprise';

  return (
    <div className="relative">
      <Sidebar />
      <div className="lg:ml-64 transition-all duration-300">
        <div className="container max-w-6xl mx-auto py-8 px-4">
      {!hasAccess ? (
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Browser Control</h1>
          <p className="text-muted-foreground mb-6">
            Browser automation requires a Pro or Enterprise plan.
          </p>
          <a
            href="/pricing"
            className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Upgrade Now
          </a>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Browser Control</h1>
            <p className="text-muted-foreground">
              Automate web browsing securely with prompt injection protection and content
              filtering
            </p>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>Available Credits:</strong>{' '}
                {(user.monthlyCredits - user.creditsUsed).toLocaleString()} / {user.monthlyCredits.toLocaleString()}
              </p>
            </div>
          </div>

          <BrowserTabbedInterface
            initialCredits={user.monthlyCredits - user.creditsUsed}
          />

          {/* Security Information */}
          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h3 className="font-semibold mb-2">🔒 Security Features</h3>
            <ul className="text-sm space-y-1">
              <li>✓ Prompt injection detection and blocking</li>
              <li>✓ XSS content filtering</li>
              <li>✓ Private network and local file access blocked</li>
              <li>✓ Resource size limits and timeouts</li>
              <li>✓ Rate limiting (100 requests/hour)</li>
              <li>✓ Session isolation and sandboxing</li>
              <li>✓ Automatic session cleanup</li>
            </ul>
          </div>

          {/* Usage Guidelines */}
          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <h3 className="font-semibold mb-2">⚠️ Usage Guidelines</h3>
            <ul className="text-sm space-y-1">
              <li>• Respect website terms of service and robots.txt</li>
              <li>• Do not use for scraping protected content</li>
              <li>• Rate limit your requests to avoid overwhelming servers</li>
              <li>• Sessions expire after 2 minutes of inactivity</li>
              <li>• Maximum 5 pages per session</li>
            </ul>
          </div>
        </>
      )}
        </div>
      </div>
    </div>
  );
}
