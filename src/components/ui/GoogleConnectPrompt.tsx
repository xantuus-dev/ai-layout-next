'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GoogleIntegrationBadge } from './GoogleIntegrationBadge';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface GoogleConnectPromptProps {
  services: ('drive' | 'gmail' | 'calendar')[];
  title?: string;
  description?: string;
  onConnect?: () => void;
  inline?: boolean;
}

export function GoogleConnectPrompt({
  services,
  title = 'Connect Google Services',
  description = 'This feature requires connecting to Google services.',
  onConnect,
  inline = false,
}: GoogleConnectPromptProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // Get OAuth URL
      const response = await fetch(
        `/api/integrations/google/connect?services=${services.join(',')}&returnUrl=${encodeURIComponent(window.location.pathname)}`
      );

      if (!response.ok) {
        throw new Error('Failed to initiate connection');
      }

      const data = await response.json();

      // Redirect to Google OAuth
      window.location.href = data.url;

      onConnect?.();
    } catch (err) {
      console.error('Error connecting to Google:', err);
      setError('Failed to connect to Google. Please try again.');
      setIsConnecting(false);
    }
  };

  if (success) {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-green-700 dark:text-green-300">
            <CheckCircle className="w-5 h-5" />
            <p className="font-medium">Successfully connected to Google services!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (inline) {
    return (
      <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Google services required
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {services.map((service) => (
              <GoogleIntegrationBadge key={service} service={service} size="sm" />
            ))}
          </div>
        </div>
        <Button
          onClick={handleConnect}
          disabled={isConnecting}
          className="ml-4 bg-amber-600 hover:bg-amber-700"
          size="sm"
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            'Connect'
          )}
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Required services:
          </p>
          <div className="flex flex-wrap gap-2">
            {services.map((service) => (
              <GoogleIntegrationBadge key={service} service={service} />
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <Button
          onClick={handleConnect}
          disabled={isConnecting}
          className="w-full bg-blue-500 hover:bg-blue-600"
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Connecting to Google...
            </>
          ) : (
            'Connect Google Services'
          )}
        </Button>

        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          You'll be redirected to Google to authorize access
        </p>
      </CardContent>
    </Card>
  );
}
