'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, RefreshCw, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  tokens?: number;
  credits?: number;
  thinkingEnabled?: boolean;
  createdAt: Date;
}

interface PageContext {
  url: string;
  title: string;
  wordCount?: number;
  summary?: string;
}

interface QuickAction {
  label: string;
  prompt: string;
}

interface WebpageChatProps {
  sessionId: string;
  currentUrl: string;
  currentHtml: string;
  onCreditsUsed?: (credits: number) => void;
}

export default function WebpageChat({
  sessionId,
  currentUrl,
  currentHtml,
  onCreditsUsed,
}: WebpageChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pageContext, setPageContext] = useState<PageContext | null>(null);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load chat history on mount
  useEffect(() => {
    loadChatHistory();
  }, [sessionId]);

  // Auto-focus textarea
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`/api/browser/chat?sessionId=${sessionId}`);
      const data = await response.json();

      if (data.success) {
        setMessages(
          data.messages.map((msg: any) => ({
            ...msg,
            createdAt: new Date(msg.createdAt),
          }))
        );

        if (data.sessionInfo) {
          setPageContext({
            url: data.sessionInfo.url,
            title: data.sessionInfo.title,
          });
        }
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const sendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;

    setIsLoading(true);

    // Add user message immediately
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: message,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');

    try {
      const response = await fetch('/api/browser/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message,
          html: currentHtml,
          url: currentUrl,
          thinkingEnabled,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      // Update page context
      if (data.context) {
        setPageContext(data.context);
      }

      // Update quick actions for new chats
      if (data.quickActions) {
        setQuickActions(data.quickActions);
      }

      // Add assistant response
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message,
        model: data.usage?.model,
        tokens: data.usage?.tokens,
        credits: data.usage?.credits,
        thinkingEnabled: data.thinking ? true : false,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Notify parent of credits used
      if (onCreditsUsed && data.usage?.credits) {
        onCreditsUsed(data.usage.credits);
      }
    } catch (error: any) {
      console.error('Chat error:', error);

      // Add error message
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error.message}`,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = async () => {
    if (!confirm('Clear all chat history? This cannot be undone.')) return;

    try {
      const response = await fetch(`/api/browser/chat?sessionId=${sessionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMessages([]);
        setQuickActions([]);
      }
    } catch (error) {
      console.error('Failed to clear chat:', error);
    }
  };

  const handleRefreshContext = async () => {
    setPageContext(null);
    setMessages([]);
    setQuickActions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputMessage);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Page Context Card */}
      {pageContext && (
        <Card className="mb-4 border-slate-700 bg-slate-800/50">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base truncate">{pageContext.title}</CardTitle>
                <CardDescription className="truncate text-xs">
                  {pageContext.url}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefreshContext}
                className="ml-2 shrink-0"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          {(pageContext.wordCount || pageContext.summary) && (
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {pageContext.wordCount && (
                  <Badge variant="secondary" className="text-xs">
                    {pageContext.wordCount.toLocaleString()} words
                  </Badge>
                )}
                {pageContext.summary && (
                  <p className="text-xs text-slate-400 mt-1">{pageContext.summary}</p>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Quick Actions */}
      {quickActions.length > 0 && messages.length <= 2 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => sendMessage(action.prompt)}
              disabled={isLoading}
              className="text-xs"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 mb-4 overflow-y-auto">
        <div className="space-y-4 pr-4">
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-12 text-slate-400">
              <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Chat with this webpage</p>
              <p className="text-sm mt-2">
                Ask questions, extract information, or get summaries
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-100 border border-slate-700'
                }`}
              >
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>

                {message.credits && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-700 text-xs text-slate-400">
                    <Badge variant="secondary" className="text-xs">
                      {message.credits} credits
                    </Badge>
                    {message.tokens && (
                      <span>{message.tokens.toLocaleString()} tokens</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-700 pt-4">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about this page..."
              className="min-h-[80px] resize-none bg-slate-800 border-slate-700"
              disabled={isLoading}
            />
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearChat}
                  disabled={messages.length === 0 || isLoading}
                  className="text-xs"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear
                </Button>

                <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={thinkingEnabled}
                    onChange={(e) => setThinkingEnabled(e.target.checked)}
                    className="rounded"
                  />
                  Extended thinking
                </label>
              </div>

              <span className="text-xs text-slate-500">
                Press Enter to send, Shift+Enter for new line
              </span>
            </div>
          </div>

          <Button
            onClick={() => sendMessage(inputMessage)}
            disabled={!inputMessage.trim() || isLoading}
            className="mb-8"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
