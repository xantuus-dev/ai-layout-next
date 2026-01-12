'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GoogleIntegrationBadge } from '@/components/ui/GoogleIntegrationBadge';
import { CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';

interface IntegrationStatus {
  googleDriveEnabled: boolean;
  googleGmailEnabled: boolean;
  googleCalendarEnabled: boolean;
  googleAccessToken: boolean;
}

function IntegrationsPageContent() {
  const { data: session, status: sessionStatus } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
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
      // Clean up URL
      router.replace('/settings/integrations');
    } else if (error) {
      setMessage({
        type: 'error',
        text: `Connection failed: ${error}`,
      });
      // Clean up URL
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
        });
      }
    } catch (error) {
      console.error('Error loading integration status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (services: string[]) => {
    setConnecting(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/integrations/google/connect?services=${services.join(',')}&returnUrl=/settings/integrations`
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
        text: 'Failed to connect to Google. Please try again.',
      });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect all Google services?')) {
      return;
    }

    setDisconnecting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/integrations/google/disconnect', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      setMessage({
        type: 'success',
        text: 'Successfully disconnected from Google services',
      });

      await loadIntegrationStatus();
    } catch (error) {
      console.error('Error disconnecting:', error);
      setMessage({
        type: 'error',
        text: 'Failed to disconnect. Please try again.',
      });
    } finally {
      setDisconnecting(false);
    }
  };

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please sign in to manage integrations</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isConnected = integrations?.googleAccessToken;
  const hasAnyService = integrations?.googleDriveEnabled || integrations?.googleGmailEnabled || integrations?.googleCalendarEnabled;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Integrations
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Connect external services to enhance your templates
          </p>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
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

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <img
                    src="https://www.google.com/favicon.ico"
                    alt="Google"
                    className="w-6 h-6"
                  />
                  Google Services
                </CardTitle>
                <CardDescription>
                  Connect your Google account to use Drive, Gmail, and Calendar features
                </CardDescription>
              </div>
              {isConnected && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                    Connected
                  </span>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Service Status */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Available Services
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Google Drive */}
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <GoogleIntegrationBadge service="drive" size="md" />
                    {integrations?.googleDriveEnabled ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Upload and manage files in Google Drive
                  </p>
                </div>

                {/* Gmail */}
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <GoogleIntegrationBadge service="gmail" size="md" />
                    {integrations?.googleGmailEnabled ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Send emails through your Gmail account
                  </p>
                </div>

                {/* Google Calendar */}
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <GoogleIntegrationBadge service="calendar" size="md" />
                    {integrations?.googleCalendarEnabled ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Create and manage calendar events
                  </p>
                </div>
              </div>
            </div>

            {/* Connection Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              {!isConnected ? (
                <>
                  <Button
                    onClick={() => handleConnect(['drive', 'gmail', 'calendar'])}
                    disabled={connecting}
                    className="flex-1 bg-blue-500 hover:bg-blue-600"
                  >
                    {connecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      'Connect All Services'
                    )}
                  </Button>
                  <Button
                    onClick={() => handleConnect(['drive'])}
                    disabled={connecting}
                    variant="outline"
                  >
                    Drive Only
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  variant="destructive"
                >
                  {disconnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    'Disconnect Google Services'
                  )}
                </Button>
              )}
            </div>

            {/* Info */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Note:</strong> Google integrations are required for certain premium templates.
                Your data is only accessed when you explicitly use these features.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    }>
      <IntegrationsPageContent />
    </Suspense>
  );
}
