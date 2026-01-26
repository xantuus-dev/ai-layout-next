'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, AlertCircle, CheckCircle, Home } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  tokens?: number;
  credits?: number;
  createdAt: string;
  attachments?: any[];
}

interface Workspace {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

interface Conversation {
  id: string;
  title: string;
  model?: string;
  messageCount: number;
}

export default function WorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();

  const workspaceId = params.id as string;
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [executionStatus, setExecutionStatus] = useState<
    'idle' | 'thinking' | 'streaming' | 'complete' | 'error'
  >('idle');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasExecuted = useRef(false);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Fetch workspace and conversation
  useEffect(() => {
    if (status === 'authenticated' && workspaceId) {
      fetchWorkspaceData();
    } else if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, workspaceId]);

  // Auto-execute pending execution from sessionStorage
  useEffect(() => {
    if (!conversation || hasExecuted.current) return;

    const pendingExecution = sessionStorage.getItem('pendingExecution');
    if (pendingExecution) {
      sessionStorage.removeItem('pendingExecution');
      const data = JSON.parse(pendingExecution);

      // Verify this is the correct conversation
      if (data.conversationId === conversation.id) {
        hasExecuted.current = true;
        executeAgent(data);
      }
    } else {
      setIsLoading(false);
    }
  }, [conversation]);

  const fetchWorkspaceData = async () => {
    try {
      // Fetch workspace
      const wsRes = await fetch(`/api/workspace/workspaces/${workspaceId}`);
      if (!wsRes.ok) {
        throw new Error('Failed to fetch workspace');
      }
      const wsData = await wsRes.json();
      setWorkspace(wsData.workspace);

      // Fetch conversations in workspace
      const convRes = await fetch(`/api/workspace/conversations?workspaceId=${workspaceId}`);
      if (!convRes.ok) {
        throw new Error('Failed to fetch conversations');
      }
      const convData = await convRes.json();

      if (convData.conversations && convData.conversations.length > 0) {
        const conv = convData.conversations[0];
        setConversation(conv);

        // Fetch messages if conversation has messages
        if (conv.messageCount > 0) {
          const msgRes = await fetch(`/api/workspace/conversations/${conv.id}/messages`);
          if (msgRes.ok) {
            const msgData = await msgRes.json();
            setMessages(msgData.messages || []);
          }
        }
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching workspace:', err);
      setError('Failed to load workspace');
      setIsLoading(false);
    }
  };

  const executeAgent = async (data: any) => {
    setIsStreaming(true);
    setExecutionStatus('thinking');
    setStreamingContent('');
    setIsLoading(false);

    try {
      const response = await fetch(`/api/workspace/${workspaceId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: data.conversationId,
          message: data.message,
          files: data.files,
          pastedContent: data.pastedContent,
          model: data.model,
          isThinkingEnabled: data.isThinkingEnabled,
        }),
      });

      if (!response.ok) {
        throw new Error('Execution failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response stream');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const eventData = JSON.parse(line.substring(6));

            if (eventData.type === 'userMessage') {
              // User message created, refresh messages
              await fetchWorkspaceData();
            } else if (eventData.type === 'thinking') {
              setExecutionStatus('thinking');
            } else if (eventData.type === 'streaming') {
              setExecutionStatus('streaming');
            } else if (eventData.type === 'chunk') {
              setStreamingContent((prev) => prev + eventData.content);
            } else if (eventData.type === 'complete') {
              setExecutionStatus('complete');
              setIsStreaming(false);
              setStreamingContent('');
              // Refresh messages to show final saved message
              await fetchWorkspaceData();
            } else if (eventData.type === 'error') {
              setError(eventData.message);
              setExecutionStatus('error');
              setIsStreaming(false);
            }
          }
        }
      }
    } catch (err) {
      console.error('Execution error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setExecutionStatus('error');
      setIsStreaming(false);
    }
  };

  // Render message component
  const MessageBubble = ({ message }: { message: Message }) => (
    <div
      className={`p-4 rounded-lg ${
        message.role === 'user'
          ? 'bg-blue-50 dark:bg-blue-900/20 ml-8'
          : 'bg-white dark:bg-gray-800 mr-8 shadow-sm'
      }`}
    >
      <div className="text-xs font-semibold mb-2 text-gray-500 dark:text-gray-400">
        {message.role === 'user' ? 'You' : 'AI Agent'}
        {message.model && ` (${message.model})`}
      </div>
      <div className="prose dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
      </div>
      {message.tokens && (
        <div className="mt-2 text-xs text-gray-400">
          {message.tokens} tokens • {message.credits} credits
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-600 dark:text-gray-400">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </button>
            <div className="border-l border-gray-300 dark:border-gray-600 h-4" />
            <div className="flex items-center gap-2">
              <span className="text-xl">{workspace?.icon || '🤖'}</span>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                {workspace?.name || 'Agent Workspace'}
              </h1>
            </div>
          </div>

          {/* Status Indicator */}
          <div className="flex items-center gap-2">
            {executionStatus === 'thinking' && (
              <div className="flex items-center gap-2 text-blue-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            )}
            {executionStatus === 'streaming' && (
              <div className="flex items-center gap-2 text-green-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Streaming...</span>
              </div>
            )}
            {executionStatus === 'complete' && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Complete</span>
              </div>
            )}
            {executionStatus === 'error' && (
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">Error</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="space-y-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Streaming message */}
          {isStreaming && streamingContent && (
            <div className="p-4 rounded-lg bg-white dark:bg-gray-800 mr-8 shadow-sm">
              <div className="text-xs font-semibold mb-2 text-gray-500 dark:text-gray-400">
                AI Agent (streaming...)
              </div>
              <div className="prose dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Thinking indicator */}
          {executionStatus === 'thinking' && !streamingContent && (
            <div className="p-4 rounded-lg bg-white dark:bg-gray-800 mr-8 shadow-sm">
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>AI is thinking...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span className="font-semibold">Error:</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
}
