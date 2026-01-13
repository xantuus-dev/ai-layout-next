'use client';

/**
 * Browser Control UI Component
 *
 * Provides a user interface for secure browser automation with:
 * - Session management
 * - Action execution (navigate, click, type, screenshot, extract)
 * - Security warnings display
 * - Credit tracking
 * - Response visualization
 */

import { useState } from 'react';
import { Loader2, Globe, MousePointer, Type, Camera, FileCode, Play, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { Card } from './card';
import { Badge } from './badge';

interface BrowserAction {
  type: 'navigate' | 'click' | 'type' | 'screenshot' | 'extract' | 'evaluate';
  target?: string;
  value?: string;
  selector?: string;
  code?: string;
}

interface BrowserResult {
  success: boolean;
  data?: any;
  screenshot?: string;
  html?: string;
  error?: string;
  securityWarnings?: string[];
  creditsUsed?: number;
  creditsRemaining?: number;
}

export default function BrowserControl() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState<BrowserAction['type']>('navigate');
  const [url, setUrl] = useState('');
  const [selector, setSelector] = useState('');
  const [value, setValue] = useState('');
  const [code, setCode] = useState('');
  const [result, setResult] = useState<BrowserResult | null>(null);
  const [history, setHistory] = useState<Array<{ action: string; result: BrowserResult }>>([]);

  // Create browser session
  const createSession = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/browser/session', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create session');
      }

      setSessionId(data.sessionId);
      setResult({
        success: true,
        data: { message: 'Session created successfully', sessionId: data.sessionId },
        creditsUsed: data.creditsUsed,
        creditsRemaining: data.creditsRemaining,
      });
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Close browser session
  const closeSession = async () => {
    if (!sessionId) return;

    setLoading(true);
    try {
      await fetch('/api/browser/session', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      setSessionId(null);
      setResult({ success: true, data: { message: 'Session closed' } });
      setHistory([]);
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Execute browser action
  const executeAction = async () => {
    if (!sessionId) {
      setResult({ success: false, error: 'No active session' });
      return;
    }

    const action: BrowserAction = { type: actionType };

    if (actionType === 'navigate') {
      if (!url) {
        setResult({ success: false, error: 'URL required' });
        return;
      }
      action.target = url;
    } else if (actionType === 'click') {
      if (!selector) {
        setResult({ success: false, error: 'Selector required' });
        return;
      }
      action.selector = selector;
    } else if (actionType === 'type') {
      if (!selector || !value) {
        setResult({ success: false, error: 'Selector and value required' });
        return;
      }
      action.selector = selector;
      action.value = value;
    } else if (actionType === 'extract') {
      if (!selector) {
        setResult({ success: false, error: 'Selector required' });
        return;
      }
      action.selector = selector;
    } else if (actionType === 'evaluate') {
      if (!code) {
        setResult({ success: false, error: 'Code required' });
        return;
      }
      action.code = code;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/browser/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, action }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Action failed');
      }

      setResult(data);
      setHistory([
        ...history,
        { action: `${actionType}: ${url || selector || code}`, result: data },
      ]);
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Browser Control</h2>
          <p className="text-sm text-muted-foreground">
            Secure automated web browsing with prompt injection protection
          </p>
        </div>
        {sessionId ? (
          <Badge variant="default" className="text-sm">
            Session Active
          </Badge>
        ) : (
          <Badge variant="secondary">No Session</Badge>
        )}
      </div>

      {/* Session Controls */}
      <Card className="p-4">
        <div className="flex gap-2">
          {!sessionId ? (
            <Button onClick={createSession} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Globe className="w-4 h-4 mr-2" />}
              Start Browser Session (50 credits)
            </Button>
          ) : (
            <Button onClick={closeSession} variant="destructive" disabled={loading}>
              <XCircle className="w-4 h-4 mr-2" />
              Close Session
            </Button>
          )}
        </div>
      </Card>

      {/* Action Controls */}
      {sessionId && (
        <Card className="p-4 space-y-4">
          <div className="flex gap-2">
            <Button
              variant={actionType === 'navigate' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActionType('navigate')}
            >
              <Globe className="w-4 h-4 mr-2" />
              Navigate (10c)
            </Button>
            <Button
              variant={actionType === 'click' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActionType('click')}
            >
              <MousePointer className="w-4 h-4 mr-2" />
              Click (5c)
            </Button>
            <Button
              variant={actionType === 'type' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActionType('type')}
            >
              <Type className="w-4 h-4 mr-2" />
              Type (5c)
            </Button>
            <Button
              variant={actionType === 'screenshot' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActionType('screenshot')}
            >
              <Camera className="w-4 h-4 mr-2" />
              Screenshot (15c)
            </Button>
            <Button
              variant={actionType === 'extract' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActionType('extract')}
            >
              <FileCode className="w-4 h-4 mr-2" />
              Extract (10c)
            </Button>
          </div>

          {/* Input fields based on action type */}
          <div className="space-y-2">
            {actionType === 'navigate' && (
              <Input
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            )}

            {(actionType === 'click' || actionType === 'type' || actionType === 'extract') && (
              <Input
                placeholder="CSS Selector (e.g., #button, .class)"
                value={selector}
                onChange={(e) => setSelector(e.target.value)}
              />
            )}

            {actionType === 'type' && (
              <Input
                placeholder="Value to type"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            )}

            {actionType === 'evaluate' && (
              <textarea
                className="w-full min-h-[100px] p-2 border rounded"
                placeholder="JavaScript code to evaluate (restricted)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            )}

            <Button onClick={executeAction} disabled={loading} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Execute Action
            </Button>
          </div>
        </Card>
      )}

      {/* Result Display */}
      {result && (
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Result</h3>
              <Badge variant={result.success ? 'default' : 'destructive'}>
                {result.success ? 'Success' : 'Failed'}
              </Badge>
            </div>

            {/* Security Warnings */}
            {result.securityWarnings && result.securityWarnings.length > 0 && (
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">Security Warnings:</p>
                    <ul className="list-disc list-inside text-sm mt-1">
                      {result.securityWarnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {result.error && (
              <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded">
                <p className="text-sm text-red-800 dark:text-red-200">{result.error}</p>
              </div>
            )}

            {/* Data */}
            {result.data && (
              <div className="p-3 bg-muted rounded">
                <pre className="text-xs overflow-auto">{JSON.stringify(result.data, null, 2)}</pre>
              </div>
            )}

            {/* Screenshot */}
            {result.screenshot && (
              <div>
                <p className="text-sm font-semibold mb-2">Screenshot:</p>
                <img
                  src={`data:image/png;base64,${result.screenshot}`}
                  alt="Screenshot"
                  className="border rounded"
                />
              </div>
            )}

            {/* HTML */}
            {result.html && (
              <details className="cursor-pointer">
                <summary className="text-sm font-semibold mb-2">Page HTML</summary>
                <div className="p-3 bg-muted rounded mt-2">
                  <pre className="text-xs overflow-auto max-h-[300px]">{result.html}</pre>
                </div>
              </details>
            )}

            {/* Credits */}
            {result.creditsUsed !== undefined && (
              <div className="flex justify-between text-sm">
                <span>Credits Used: {result.creditsUsed}</span>
                <span>Remaining: {result.creditsRemaining}</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Action History</h3>
          <div className="space-y-2">
            {history.map((item, i) => (
              <div key={i} className="p-2 bg-muted rounded text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono">{item.action}</span>
                  <Badge variant={item.result.success ? 'default' : 'destructive'} className="text-xs">
                    {item.result.success ? '✓' : '✗'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
