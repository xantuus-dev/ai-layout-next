'use client';

/**
 * Browser Tabbed Interface
 *
 * Provides tabs for different browser features:
 * - Control: Traditional browser automation
 * - Chat: AI chat with webpages
 * - Navigation: Natural language commands (Phase 3)
 * - Workflows: Automation workflows (Phase 4)
 * - Monitoring: Page monitoring (Phase 5)
 */

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Terminal, Sparkles, Workflow, Bell } from 'lucide-react';
import BrowserControl from '@/components/ui/BrowserControl';
import WebpageChat from './WebpageChat';
import AINavigation from './AINavigation';
import WorkflowManager from './WorkflowManager';
import { Badge } from '@/components/ui/badge';

interface BrowserTabbedInterfaceProps {
  initialCredits: number;
}

export default function BrowserTabbedInterface({
  initialCredits,
}: BrowserTabbedInterfaceProps) {
  const [activeTab, setActiveTab] = useState('control');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState('');
  const [currentHtml, setCurrentHtml] = useState('');
  const [creditsRemaining, setCreditsRemaining] = useState(initialCredits);
  const [chatEnabled, setChatEnabled] = useState(false);
  const [navigationEnabled, setNavigationEnabled] = useState(false);

  // Create session with chat enabled when switching to chat tab
  const createChatSession = async () => {
    if (sessionId && chatEnabled) return; // Already have chat session

    try {
      const response = await fetch('/api/browser/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: currentUrl || 'about:blank',
          chatEnabled: true,
          navigationEnabled: false,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSessionId(data.sessionId);
        setChatEnabled(true);
        setCreditsRemaining((prev) => prev - data.creditsUsed);
      }
    } catch (error) {
      console.error('Failed to create chat session:', error);
    }
  };

  // Create session with navigation enabled when switching to navigation tab
  const createNavigationSession = async () => {
    if (sessionId && navigationEnabled) return; // Already have navigation session

    try {
      const response = await fetch('/api/browser/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: currentUrl || 'about:blank',
          chatEnabled: false,
          navigationEnabled: true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSessionId(data.sessionId);
        setNavigationEnabled(true);
        setCreditsRemaining((prev) => prev - data.creditsUsed);
      }
    } catch (error) {
      console.error('Failed to create navigation session:', error);
    }
  };

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);

    if (value === 'chat' && !chatEnabled) {
      createChatSession();
    } else if (value === 'navigation' && !navigationEnabled) {
      createNavigationSession();
    }
  };

  // Handle credits used in chat
  const handleCreditsUsed = (credits: number) => {
    setCreditsRemaining((prev) => prev - credits);
  };

  return (
    <div className="space-y-4">
      {/* Credits Display */}
      <div className="flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
        <div>
          <p className="text-sm text-slate-400">Available Credits</p>
          <p className="text-2xl font-bold">{creditsRemaining.toLocaleString()}</p>
        </div>
        {sessionId && (
          <Badge variant="secondary" className="text-xs">
            Session Active
          </Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-slate-800/50 border border-slate-700">
          <TabsTrigger value="control" className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            <span className="hidden sm:inline">Control</span>
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Chat</span>
          </TabsTrigger>
          <TabsTrigger value="navigation" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Navigation</span>
          </TabsTrigger>
          <TabsTrigger value="workflows" className="flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            <span className="hidden sm:inline">Workflows</span>
          </TabsTrigger>
          <TabsTrigger value="monitoring" disabled className="flex items-center gap-2 opacity-50">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Monitoring</span>
            <Badge variant="outline" className="ml-1 text-xs hidden lg:inline">
              Coming Soon
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Control Tab */}
        <TabsContent value="control" className="mt-6">
          <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold mb-2">Browser Control</h2>
              <p className="text-sm text-slate-400">
                Execute browser actions with security and rate limiting
              </p>
            </div>
            <BrowserControl />
          </div>
        </TabsContent>

        {/* Chat Tab */}
        <TabsContent value="chat" className="mt-6">
          <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-6 h-[700px]">
            <div className="mb-4">
              <h2 className="text-xl font-semibold mb-2">Chat with Webpage</h2>
              <p className="text-sm text-slate-400">
                Ask questions, extract information, or get summaries from any webpage
              </p>
            </div>

            {sessionId && chatEnabled ? (
              <div className="h-[calc(100%-80px)]">
                <WebpageChat
                  sessionId={sessionId}
                  currentUrl={currentUrl}
                  currentHtml={currentHtml}
                  onCreditsUsed={handleCreditsUsed}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-[calc(100%-80px)] text-slate-400">
                <div className="text-center">
                  <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Creating chat session...</p>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Navigation Tab */}
        <TabsContent value="navigation" className="mt-6">
          <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-6 h-[700px]">
            <div className="mb-4">
              <h2 className="text-xl font-semibold mb-2">AI Navigation</h2>
              <p className="text-sm text-slate-400">
                Control the browser with natural language commands
              </p>
            </div>

            {sessionId && navigationEnabled ? (
              <div className="h-[calc(100%-80px)]">
                <AINavigation
                  sessionId={sessionId}
                  currentUrl={currentUrl}
                  onCreditsUsed={handleCreditsUsed}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-[calc(100%-80px)] text-slate-400">
                <div className="text-center">
                  <Sparkles className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Creating navigation session...</p>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Workflows Tab */}
        <TabsContent value="workflows" className="mt-6">
          <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-6">
            {sessionId ? (
              <WorkflowManager
                sessionId={sessionId}
                onCreditsUsed={handleCreditsUsed}
              />
            ) : (
              <div className="flex items-center justify-center h-[600px] text-slate-400">
                <div className="text-center">
                  <Workflow className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Creating browser session for workflows...</p>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Monitoring Tab (Phase 5) */}
        <TabsContent value="monitoring" className="mt-6">
          <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-6 h-[600px] flex items-center justify-center">
            <div className="text-center text-slate-400">
              <Bell className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Page Monitoring</p>
              <p className="text-sm mt-2">
                Watch pages for changes with AI-powered alerts
              </p>
              <p className="text-xs mt-4">Coming in Phase 5</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Feature Preview */}
      <div className="mt-8 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          AI Browser Features
        </h3>
        <ul className="text-sm space-y-1 text-slate-300">
          <li>✓ <strong>Control:</strong> Traditional browser automation with security</li>
          <li>✓ <strong>Chat:</strong> AI chat with webpage understanding</li>
          <li>✓ <strong>Navigation:</strong> Natural language browser commands</li>
          <li>✓ <strong>Workflows:</strong> Record and replay automations with AI recovery</li>
          <li>• <strong>Monitoring:</strong> Watch pages with alerts (Phase 5)</li>
        </ul>
      </div>
    </div>
  );
}
