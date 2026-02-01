'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, AlertCircle, Mail, Calendar, CreditCard, MessageSquare, FileText } from 'lucide-react';

interface IntegrationStatus {
  googleDriveEnabled: boolean;
  googleGmailEnabled: boolean;
  googleCalendarEnabled: boolean;
  googleAccessToken: boolean;
  notionEnabled?: boolean;
  stripeEnabled?: boolean;
  slackEnabled?: boolean;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  status: 'connected' | 'disconnected';
  onConnect?: () => void;
  onDisconnect?: () => void;
}

function IntegrationsPageContent() {
  const { data: session, status: sessionStatus } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Check for success/error from OAuth callback
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const services = searchParams.get('services');

    if (success && services) {
      setMessage({
        type: 'success',
        text: `Successfully connected: ${services}`,
      });
      router.replace('/settings/integrations');
    } else if (error) {
      setMessage({
        type: 'error',
        text: `Connection failed: ${error}`,
      });
      router.replace('/settings/integrations');
    }
  }, [searchParams, router]);

  // Load integration status
  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      loadIntegrationStatus();
    }
  }, [sessionStatus]);

  const loadIntegrationStatus = async () => {
    try {
      const response = await fetch('/api/auth/session');
      const session = await response.json();

      if (session?.user) {
        setIntegrations({
          googleDriveEnabled: session.user.googleDriveEnabled || false,
          googleGmailEnabled: session.user.googleGmailEnabled || false,
          googleCalendarEnabled: session.user.googleCalendarEnabled || false,
          googleAccessToken: !!session.user.googleAccessToken,
          notionEnabled: false, // TODO: Add actual status
          stripeEnabled: false, // TODO: Add actual status
          slackEnabled: false, // TODO: Add actual status
        });
      }
    } catch (error) {
      console.error('Error loading integration status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGmail = async () => {
    setConnecting('gmail');
    setMessage(null);

    try {
      const response = await fetch(
        `/api/integrations/google/connect?services=gmail&returnUrl=/settings/integrations`
      );

      if (!response.ok) {
        throw new Error('Failed to initiate connection');
      }

      const data = await response.json();
      window.location.href = data.url;
    } catch (error) {
      console.error('Error connecting:', error);
      setMessage({
        type: 'error',
        text: 'Failed to connect to Gmail. Please try again.',
      });
      setConnecting(null);
    }
  };

  const handleConnectCalendar = async () => {
    setConnecting('calendar');
    setMessage(null);

    try {
      const response = await fetch(
        `/api/integrations/google/connect?services=calendar&returnUrl=/settings/integrations`
      );

      if (!response.ok) {
        throw new Error('Failed to initiate connection');
      }

      const data = await response.json();
      window.location.href = data.url;
    } catch (error) {
      console.error('Error connecting:', error);
      setMessage({
        type: 'error',
        text: 'Failed to connect to Google Calendar. Please try again.',
      });
      setConnecting(null);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect this service?')) {
      return;
    }

    try {
      const response = await fetch('/api/integrations/google/disconnect', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      setMessage({
        type: 'success',
        text: 'Successfully disconnected',
      });

      await loadIntegrationStatus();
    } catch (error) {
      console.error('Error disconnecting:', error);
      setMessage({
        type: 'error',
        text: 'Failed to disconnect. Please try again.',
      });
    }
  };

  const handleComingSoon = (name: string) => {
    setMessage({
      type: 'error',
      text: `${name} integration coming soon!`,
    });
  };

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Authentication Required
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Please sign in to manage integrations
          </p>
        </Card>
      </div>
    );
  }

  const integrationsList: Integration[] = [
    {
      id: 'gmail',
      name: 'Gmail',
      description: 'Send emails and manage your inbox',
      icon: <Mail className="w-6 h-6 text-white" />,
      iconBg: 'bg-red-500',
      status: integrations?.googleGmailEnabled ? 'connected' : 'disconnected',
      onConnect: handleConnectGmail,
      onDisconnect: handleDisconnect,
    },
    {
      id: 'notion',
      name: 'Notion',
      description: 'Sync and create Notion pages',
      icon: <FileText className="w-6 h-6 text-white" />,
      iconBg: 'bg-gray-800',
      status: 'disconnected',
      onConnect: () => handleComingSoon('Notion'),
    },
    {
      id: 'stripe',
      name: 'Stripe',
      description: 'Process payments and manage subscriptions',
      icon: <CreditCard className="w-6 h-6 text-white" />,
      iconBg: 'bg-indigo-500',
      status: 'disconnected',
      onConnect: () => handleComingSoon('Stripe'),
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Send messages and notifications',
      icon: <MessageSquare className="w-6 h-6 text-white" />,
      iconBg: 'bg-purple-500',
      status: 'disconnected',
      onConnect: () => handleComingSoon('Slack'),
    },
    {
      id: 'google-calendar',
      name: 'Google Calendar',
      description: 'Create and manage calendar events',
      icon: <Calendar className="w-6 h-6 text-white" />,
      iconBg: 'bg-blue-500',
      status: integrations?.googleCalendarEnabled ? 'connected' : 'disconnected',
      onConnect: handleConnectCalendar,
      onDisconnect: handleDisconnect,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Message Banner */}
      {message && (
        <div
          className={`p-4 rounded-lg flex items-start gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          )}
          <p
            className={`text-sm ${
              message.type === 'success'
                ? 'text-green-700 dark:text-green-300'
                : 'text-red-700 dark:text-red-300'
            }`}
          >
            {message.text}
          </p>
        </div>
      )}

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrationsList.map((integration) => (
          <Card
            key={integration.id}
            className="p-6 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${integration.iconBg}`}>
                  {integration.icon}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {integration.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {integration.description}
                  </p>
                </div>
              </div>
              {integration.status === 'connected' ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-xs font-medium text-green-700 dark:text-green-300">
                    Connected
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full">
                  <XCircle className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Not connected
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {integration.status === 'connected' ? (
                <Button
                  onClick={integration.onDisconnect}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  Disconnect
                </Button>
              ) : (
                <Button
                  onClick={integration.onConnect}
                  disabled={connecting === integration.id}
                  size="sm"
                  className="flex-1 gradient-primary hover:gradient-primary-hover"
                >
                  {connecting === integration.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    'Connect'
                  )}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Info */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <strong>Note:</strong> These integrations enhance your AI capabilities with real-world services.
          Your data is only accessed when you explicitly use these features.
        </p>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    }>
      <IntegrationsPageContent />
    </Suspense>
  );
}
