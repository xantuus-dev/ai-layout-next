'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, AlertCircle, CheckCircle, Home, Download, FileText, File, Mail, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ClaudeChatInput from '@/components/ui/claude-style-chat-input';
import { InlineQuickActionButtons } from '@/components/workspace/InlineQuickActionButtons';
import ChatFooterNotice from '@/components/workspace/ChatFooterNotice';
import ReasoningBlock from '@/components/workspace/ReasoningBlock';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DEFAULT_ANTHROPIC_MODEL } from '@/lib/ai-providers/catalog';

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
  // Extended-thinking output for the in-flight response, shown in its own
  // collapsible block above the answer.
  const [reasoningContent, setReasoningContent] = useState('');
  const [reasoningMs, setReasoningMs] = useState<number | undefined>(undefined);
  const [executionStatus, setExecutionStatus] = useState<
    'idle' | 'thinking' | 'streaming' | 'complete' | 'error'
  >('idle');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [inputMessage, setInputMessage] = useState('');
  const [inputFiles, setInputFiles] = useState<any[]>([]);
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
    setReasoningContent('');
    setReasoningMs(undefined);
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

      // SSE events are delimited by a blank line but arrive on arbitrary network
      // chunk boundaries, so incomplete trailing events must be carried over to
      // the next read. Without this, a split event is dropped or throws in
      // JSON.parse and kills the stream. The old fake typewriter emitted one
      // small chunk every 10ms, which hid the problem; real streaming coalesces
      // deltas and hits it routinely.
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // stream: true so a multi-byte UTF-8 character split across chunks is
        // not mangled.
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        // The last element is whatever came after the final delimiter: either
        // an empty string or a partial event still in flight.
        buffer = events.pop() ?? '';

        for (const line of events) {
          if (line.startsWith('data: ')) {
            const eventData = JSON.parse(line.substring(6));

            if (eventData.type === 'userMessage') {
              // Refresh in the background: awaiting here blocks the read loop
              // for three sequential round trips while the server is already
              // pushing reasoning and text, which stalls the whole stream and
              // makes the response look frozen for seconds.
              void fetchWorkspaceData();
            } else if (eventData.type === 'thinking') {
              setExecutionStatus('thinking');
            } else if (eventData.type === 'reasoning') {
              setReasoningContent((prev) => prev + eventData.content);
            } else if (eventData.type === 'streaming') {
              setExecutionStatus('streaming');
              // Reasoning is finished by the time the first answer token
              // arrives; freeze its duration so the block can collapse to
              // "Thought for Ns".
              if (eventData.reasoningMs) setReasoningMs(eventData.reasoningMs);
            } else if (eventData.type === 'chunk') {
              setStreamingContent((prev) => prev + eventData.content);
            } else if (eventData.type === 'complete') {
              setExecutionStatus('complete');
              setIsStreaming(false);
              setStreamingContent('');
              setReasoningContent('');
              setReasoningMs(undefined);
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

  // Send message function for multi-turn conversations.
  // `options` carries what the composer knows (thinking toggle, chosen model);
  // these were previously dropped at the call site, which meant extended
  // thinking was always off no matter what the composer sent.
  const sendMessage = async (
    message: string,
    files?: any[],
    options?: { isThinkingEnabled?: boolean; model?: string; pastedContent?: any }
  ) => {
    if (!conversation || !message.trim()) return;

    setInputMessage('');
    setInputFiles([]);
    setError(null);

    await executeAgent({
      conversationId: conversation.id,
      message,
      files: files || [],
      pastedContent: options?.pastedContent ?? null,
      model: options?.model || conversation.model || DEFAULT_ANTHROPIC_MODEL,
      isThinkingEnabled: options?.isThinkingEnabled ?? false,
    });
  };

  // Export conversation to different formats
  const exportConversation = async (format: string) => {
    if (!conversation) return;

    try {
      const response = await fetch(
        `/api/workspace/conversations/${conversation.id}/export?format=${format}`
      );

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${conversation.title || 'conversation'}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export conversation. Please try again.');
    }
  };

  // Share via email
  const shareViaEmail = () => {
    if (!conversation) return;

    const subject = encodeURIComponent(conversation.title || 'Conversation from Xantuus AI');
    const body = encodeURIComponent(
      `Check out my AI conversation:\n\n${window.location.href}\n\nGenerated with Xantuus AI`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // Render message component
  //
  // The assistant reply sits directly on the page background with no card,
  // border or shadow, so long answers read as a document rather than as a
  // boxed-in panel. Only the user's own turn keeps a container, as a compact
  // neutral bubble on the right — the same shape ChatGPT, Claude and Gemini use.
  const MessageBubble = ({ message }: { message: Message }) => (
    <div
      className={
        message.role === 'user'
          ? 'ml-auto w-fit max-w-[85%] rounded-2xl bg-muted px-4 py-3'
          : 'w-full py-2'
      }
    >
      {/* A right-aligned bubble already reads as "you", and the model that
          answered is not a property of what the user typed. Label the
          assistant turn only, so the user's bubble can stay compact. */}
      {message.role === 'assistant' && (
        <div className="text-xs font-semibold mb-2 text-muted-foreground">
          AI Agent
          {message.model && ` (${message.model})`}
        </div>
      )}
      <div className="prose dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
      </div>
      {message.tokens && (
        <div className="mt-2 text-xs text-gray-500">
          {message.tokens} tokens • {message.credits} credits
        </div>
      )}

      {/* Quick action buttons for assistant messages */}
      {message.role === 'assistant' && (
        <InlineQuickActionButtons
          onSelectAction={(prompt) => sendMessage(prompt)}
          isLoading={isStreaming || executionStatus === 'thinking'}
        />
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header — sticky to the top of the page's own scroll, so it works
          correctly regardless of whether a banner is rendered above this
          page (a hardcoded h-screen here would overflow the viewport once
          a banner adds height above it). */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-xl flex-shrink-0">
        <div className="px-4 md:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </button>
            <div className="border-l border-border h-4" />
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xl flex-shrink-0">{workspace?.icon || '🤖'}</span>
              <h1 className="text-lg font-bold text-foreground truncate">
                {conversation?.title || workspace?.name || 'Agent Workspace'}
              </h1>
              <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </div>
          </div>

            {/* Status Indicator and Export */}
            <div className="flex items-center gap-3">
              {/* Status */}
              {executionStatus === 'thinking' && (
                <div className="flex items-center gap-2 text-primary">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm hidden sm:inline">Thinking...</span>
                </div>
              )}
              {executionStatus === 'streaming' && (
                <div className="flex items-center gap-2 text-accent">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm hidden sm:inline">Streaming...</span>
                </div>
              )}
              {executionStatus === 'complete' && (
                <div className="flex items-center gap-2 text-green-500">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm hidden sm:inline">Complete</span>
                </div>
              )}
              {executionStatus === 'error' && (
                <div className="flex items-center gap-2 text-red-500">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm hidden sm:inline">Error</span>
                </div>
              )}

              {/* Export Dropdown */}
              {conversation && messages.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      <span className="hidden sm:inline">Export</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => exportConversation('pdf')}>
                      <FileText className="w-4 h-4 mr-2" />
                      Export as PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportConversation('docx')}>
                      <File className="w-4 h-4 mr-2" />
                      Export as Word
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportConversation('markdown')}>
                      <FileText className="w-4 h-4 mr-2" />
                      Export as Markdown
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportConversation('txt')}>
                      <FileText className="w-4 h-4 mr-2" />
                      Export as Text
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={shareViaEmail}>
                      <Mail className="w-4 h-4 mr-2" />
                      Share via Email
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </header>

        {/* Messages — flows with the page's own scroll (see note above) */}
        <div className="flex-1">
          <div className="max-w-4xl mx-auto p-4 md:p-8">
            <div className="space-y-4">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}

              {/* In-flight response: reasoning block, then the answer as it
                  streams. Both live in one bubble so they read as a single
                  turn rather than two separate messages. */}
              {isStreaming && (
                // Matches the finalized assistant turn above: plain on the page
                // background. If this kept a card, the answer would visibly jump
                // out of a box the moment streaming finished.
                <div className="w-full py-2 space-y-3">
                  {(reasoningContent || executionStatus === 'thinking') && (
                    <ReasoningBlock
                      content={reasoningContent}
                      isActive={executionStatus === 'thinking'}
                      durationMs={reasoningMs}
                    />
                  )}

                  {/* No separate spinner here: ReasoningBlock already renders
                      an active "Thinking…" row while waiting, so adding one
                      would show two progress indicators at once. */}
                  {streamingContent && (
                    <div className="prose dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="p-4 rounded-lg bg-red-950/30 border border-red-900/50">
                  <div className="flex items-center gap-2 text-red-400">
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

        {/* Chat Input Section - Multi-turn conversations */}
        {conversation && !isStreaming && executionStatus !== 'thinking' && (
          <div className="sticky bottom-0 border-t border-border bg-card/80 backdrop-blur-xl p-4 flex-shrink-0">
            <div className="max-w-4xl mx-auto">
              <ChatFooterNotice />
              <ClaudeChatInput
                onSendMessage={(data) =>
                  sendMessage(data.message, data.files, {
                    isThinkingEnabled: data.isThinkingEnabled,
                    model: data.model,
                    pastedContent: data.pastedContent,
                  })
                }
                initialMessage={inputMessage}
                onMessageChange={setInputMessage}
              />
            </div>
          </div>
        )}
    </div>
  );
}
