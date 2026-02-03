'use client';

import { useState, useEffect } from 'react';
import { Send, Loader2, CheckCircle2, XCircle, Clock, Sparkles, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface BrowserAction {
  type: string;
  target?: string;
  selector?: string;
  value?: string;
  wait?: number;
}

interface ActionResult {
  action: BrowserAction;
  success: boolean;
  data?: any;
  error?: string;
}

interface ExecutionResult {
  success: boolean;
  command: {
    original: string;
    parsed: string;
    reasoning?: string;
    actions: BrowserAction[];
  };
  execution: {
    totalActions: number;
    successfulActions: number;
    results: ActionResult[];
    executionTime: number;
  };
  usage: {
    credits: number;
    creditsRemaining: number;
  };
}

interface CommandHistoryItem {
  id: string;
  command: string;
  actions: number;
  successfulActions: number;
  credits: number;
  createdAt: Date;
}

interface AINavigationProps {
  sessionId: string;
  currentUrl: string;
  pageContext?: string;
  onCreditsUsed?: (credits: number) => void;
}

export default function AINavigation({
  sessionId,
  currentUrl,
  pageContext,
  onCreditsUsed,
}: AINavigationProps) {
  const [command, setCommand] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [history, setHistory] = useState<CommandHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load command history
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const response = await fetch('/api/browser/navigate?limit=10');
      const data = await response.json();

      if (data.success) {
        setHistory(
          data.history.map((item: any) => ({
            ...item,
            createdAt: new Date(item.createdAt),
          }))
        );
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const executeCommand = async (cmd: string) => {
    if (!cmd.trim() || isExecuting) return;

    setIsExecuting(true);
    setResult(null);

    try {
      const response = await fetch('/api/browser/navigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          command: cmd,
          currentUrl,
          pageContext,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to execute command');
      }

      setResult(data);

      // Notify parent of credits used
      if (onCreditsUsed && data.usage?.credits) {
        onCreditsUsed(data.usage.credits);
      }

      // Reload history
      loadHistory();
    } catch (error: any) {
      console.error('Navigation error:', error);
      setResult({
        success: false,
        command: {
          original: cmd,
          parsed: 'Failed to parse command',
          actions: [],
        },
        execution: {
          totalActions: 0,
          successfulActions: 0,
          results: [],
          executionTime: 0,
        },
        usage: {
          credits: 0,
          creditsRemaining: 0,
        },
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSubmit = () => {
    executeCommand(command);
    setCommand('');
  };

  const handleExampleClick = (exampleCommand: string) => {
    setCommand(exampleCommand);
  };

  const examples = [
    { label: 'Search Google', command: 'search google for latest AI news' },
    { label: 'Navigate', command: 'go to wikipedia.org' },
    { label: 'Click Button', command: 'click the sign in button' },
    { label: 'Extract Data', command: 'extract all article titles from this page' },
    { label: 'Fill Form', command: 'type test@example.com in the email field' },
    { label: 'Multi-Step', command: 'go to github.com and click sign in' },
  ];

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'navigate':
        return '🌐';
      case 'click':
        return '👆';
      case 'type':
        return '⌨️';
      case 'extract':
        return '📋';
      case 'wait':
        return '⏳';
      case 'scroll':
        return '📜';
      case 'screenshot':
        return '📸';
      default:
        return '▶️';
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold mb-2">AI Navigation</h2>
        <p className="text-sm text-slate-400">
          Control the browser with natural language commands
        </p>
      </div>

      {/* Example Commands */}
      {!result && (
        <div>
          <p className="text-sm font-medium mb-2 text-slate-300">Quick Examples:</p>
          <div className="flex flex-wrap gap-2">
            {examples.map((example, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleExampleClick(example.command)}
                disabled={isExecuting}
                className="text-xs"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                {example.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Command Input */}
      <Card className="border-slate-700 bg-slate-800/50">
        <CardContent className="pt-6">
          <div className="space-y-3">
            <Textarea
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Enter a natural language command... (e.g., 'search google for hotels in Paris')"
              className="min-h-[100px] bg-slate-900 border-slate-700"
              disabled={isExecuting}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Press Cmd/Ctrl+Enter to execute
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHistory(!showHistory)}
                  disabled={isExecuting}
                >
                  <History className="h-4 w-4 mr-1" />
                  History
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!command.trim() || isExecuting}
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Execute
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Command History */}
      {showHistory && history.length > 0 && (
        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="text-base">Recent Commands</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-slate-900 rounded border border-slate-700 hover:border-slate-600 cursor-pointer"
                  onClick={() => setCommand(item.command)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{item.command}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {item.successfulActions}/{item.actions} actions • {item.credits} credits
                    </p>
                  </div>
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Execution Result */}
      {result && (
        <div className="space-y-4 flex-1 overflow-y-auto">
          {/* Command Summary */}
          <Card className={`border-2 ${result.success ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/50 bg-red-500/5'}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <CardTitle className="text-base">
                      {result.success ? 'Command Executed Successfully' : 'Command Failed'}
                    </CardTitle>
                  </div>
                  <CardDescription className="mt-2">
                    {result.command.parsed}
                  </CardDescription>
                  {result.command.reasoning && (
                    <p className="text-xs text-slate-400 mt-2">
                      <strong>Reasoning:</strong> {result.command.reasoning}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <Badge variant="secondary">{result.usage.credits} credits</Badge>
                  <p className="text-xs text-slate-400 mt-1">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {result.execution.executionTime}ms
                  </p>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Action Results */}
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="text-base">
                Execution Log ({result.execution.successfulActions}/{result.execution.totalActions} successful)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {result.execution.results.map((actionResult, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded border ${
                      actionResult.success
                        ? 'border-green-500/30 bg-green-500/5'
                        : 'border-red-500/30 bg-red-500/5'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getActionIcon(actionResult.action.type)}</span>
                          <span className="text-sm font-medium">
                            Step {index + 1}: {actionResult.action.type}
                          </span>
                          {actionResult.success ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        <div className="mt-2 text-xs text-slate-400 space-y-1">
                          {actionResult.action.target && (
                            <p><strong>Target:</strong> {actionResult.action.target}</p>
                          )}
                          {actionResult.action.selector && (
                            <p><strong>Selector:</strong> {actionResult.action.selector}</p>
                          )}
                          {actionResult.action.value && (
                            <p><strong>Value:</strong> {actionResult.action.value}</p>
                          )}
                          {actionResult.error && (
                            <p className="text-red-400"><strong>Error:</strong> {actionResult.error}</p>
                          )}
                          {actionResult.data && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-blue-400">View Data</summary>
                              <pre className="mt-2 p-2 bg-slate-900 rounded text-xs overflow-x-auto">
                                {JSON.stringify(actionResult.data, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!result && !isExecuting && (
        <div className="flex-1 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <Sparkles className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Ready for your command</p>
            <p className="text-sm mt-2">
              Type a natural language command or choose an example
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
