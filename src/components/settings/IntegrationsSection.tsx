'use client';

/**
 * Integrations Section
 *
 * Manage Google integrations (Drive, Gmail, Calendar)
 */

import { useState, useEffect } from 'react';
import { Puzzle, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { useSession } from 'next-auth/react';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  status: 'connected' | 'disconnected' | 'error';
}

export function IntegrationsSection() {
  const { data: session } = useSession();
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'google-drive',
      name: 'Google Drive',
      description: 'Upload and access files in your Google Drive',
      icon: '📁',
      enabled: false,
      status: 'disconnected',
    },
    {
      id: 'gmail',
      name: 'Gmail',
      description: 'Send emails through your Gmail account',
      icon: '📧',
      enabled: false,
      status: 'disconnected',
    },
    {
      id: 'google-calendar',
      name: 'Google Calendar',
      description: 'Manage your calendar events',
      icon: '📅',
      enabled: false,
      status: 'disconnected',
    },
  ]);
  const [loading, setLoading] = useState(false);

  const handleConnect = async (integrationId: string) => {
    setLoading(true);
    try {
      if (integrationId.startsWith('google-')) {
        // Redirect to Google OAuth
        window.location.href = '/api/integrations/google/connect';
      }
    } catch (error) {
      console.error('Connection error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    setLoading(true);
    try {
      if (integrationId.startsWith('google-')) {
        const response = await fetch('/api/integrations/google/disconnect', {
          method: 'POST',
        });

        if (response.ok) {
          setIntegrations(prev =>
            prev.map(int =>
              int.id.startsWith('google-')
                ? { ...int, enabled: false, status: 'disconnected' as const }
                : int
            )
          );
        }
      }
    } catch (error) {
      console.error('Disconnection error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-white mb-2">Integrations</h2>
        <p className="text-sm text-gray-400">
          Connect your Google services to enhance AI capabilities
        </p>
      </div>

      {/* Google Integration Status */}
      <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
            <span className="text-xl">G</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Google Services</h3>
            <p className="text-xs text-gray-400">Signed in as {session?.user?.email}</p>
          </div>
        </div>
      </div>

      {/* Available Integrations */}
      <div className="space-y-4">
        {integrations.map((integration) => (
          <div
            key={integration.id}
            className="bg-[#252525] border border-gray-800 rounded-lg p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 flex-1">
                <div className="w-12 h-12 bg-[#1a1a1a] rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                  {integration.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-semibold text-white">
                      {integration.name}
                    </h3>
                    {integration.status === 'connected' && (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    )}
                    {integration.status === 'error' && (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mb-3">
                    {integration.description}
                  </p>

                  <div className="flex items-center gap-2">
                    {integration.status === 'connected' ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-xs font-medium text-green-400">
                          <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                          Connected
                        </span>
                        <button
                          onClick={() => handleDisconnect(integration.id)}
                          disabled={loading}
                          className="text-xs text-red-400 hover:text-red-300 font-medium"
                        >
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleConnect(integration.id)}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        {loading ? 'Connecting...' : 'Connect'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* API Keys */}
      <div className="bg-[#252525] border border-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Puzzle className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">API Keys</h3>
        </div>

        <p className="text-sm text-gray-400 mb-4">
          Generate API keys to use Xantuus AI in your own applications.
        </p>

        <button className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg text-sm text-gray-200 hover:bg-[#2a2a2a] transition-colors">
          <span>Manage API Keys</span>
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>

      {/* Webhooks */}
      <div className="bg-[#252525] border border-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-5 h-5 text-blue-400">🔗</div>
          <h3 className="text-lg font-semibold text-white">Webhooks</h3>
        </div>

        <p className="text-sm text-gray-400 mb-4">
          Set up webhooks to receive real-time notifications about events in your account.
        </p>

        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
          <span>Configure Webhooks</span>
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>

      {/* OAuth Scopes Info */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
        <h4 className="text-sm font-semibold text-blue-400 mb-2">🔒 Privacy & Security</h4>
        <p className="text-sm text-gray-400">
          We only request the minimum necessary permissions for each integration. You can revoke
          access at any time from your Google Account settings.
        </p>
      </div>
    </div>
  );
}
