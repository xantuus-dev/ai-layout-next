'use client';

/**
 * Connectors Section
 *
 * Manage external service connections and API integrations
 */

import { useState } from 'react';
import { Link2, CheckCircle, Circle, ExternalLink } from 'lucide-react';

interface Connector {
  id: string;
  name: string;
  description: string;
  icon: string;
  connected: boolean;
  category: 'productivity' | 'communication' | 'storage' | 'developer';
}

const connectors: Connector[] = [
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Upload and manage files in Google Drive',
    icon: '📁',
    connected: false,
    category: 'storage',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Send emails through your Gmail account',
    icon: '📧',
    connected: false,
    category: 'communication',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Create and manage calendar events',
    icon: '📅',
    connected: false,
    category: 'productivity',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send messages and notifications to Slack',
    icon: '💬',
    connected: false,
    category: 'communication',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Create and update Notion pages',
    icon: '📝',
    connected: false,
    category: 'productivity',
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Integrate with GitHub repositories',
    icon: '🐙',
    connected: false,
    category: 'developer',
  },
];

export function ConnectorsSection() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All Connectors' },
    { id: 'productivity', label: 'Productivity' },
    { id: 'communication', label: 'Communication' },
    { id: 'storage', label: 'Storage' },
    { id: 'developer', label: 'Developer' },
  ];

  const filteredConnectors = selectedCategory === 'all'
    ? connectors
    : connectors.filter(c => c.category === selectedCategory);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-white mb-2">Connectors</h2>
        <p className="text-sm text-gray-400">
          Connect external services to extend your AI capabilities
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedCategory === category.id
                ? 'bg-blue-600 text-white'
                : 'bg-[#252525] text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a]'
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>

      {/* Connectors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredConnectors.map((connector) => (
          <div
            key={connector.id}
            className="bg-[#252525] border border-gray-800 rounded-lg p-5 hover:border-gray-700 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1a1a1a] rounded-lg flex items-center justify-center text-2xl">
                  {connector.icon}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{connector.name}</h3>
                  <p className="text-xs text-gray-500 capitalize">{connector.category}</p>
                </div>
              </div>
              {connector.connected ? (
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-gray-600 flex-shrink-0" />
              )}
            </div>

            <p className="text-sm text-gray-400 mb-4">{connector.description}</p>

            <button
              className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                connector.connected
                  ? 'bg-red-600/10 text-red-400 border border-red-600/20 hover:bg-red-600/20'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {connector.connected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        ))}
      </div>

      {/* Custom Connectors */}
      <div className="bg-[#252525] border border-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Link2 className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Custom Connectors</h3>
        </div>

        <p className="text-sm text-gray-400 mb-4">
          Create custom connectors for any API or service using webhooks and HTTP requests.
        </p>

        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
          <span>Create Custom Connector</span>
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>

      {/* Help Section */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
        <h4 className="text-sm font-semibold text-blue-400 mb-2">📚 Need Help?</h4>
        <p className="text-sm text-gray-400 mb-3">
          Learn how to set up and use connectors effectively with our documentation.
        </p>
        <button className="text-sm text-blue-400 hover:text-blue-300 font-medium">
          View Connector Documentation →
        </button>
      </div>
    </div>
  );
}
