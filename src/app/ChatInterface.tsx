'use client';

import { ClaudeChatInput } from '@/components/ui/claude-style-chat-input';
import { TemplateSelector } from '@/components/ui/TemplateSelector';
import { TemplateVariableForm } from '@/components/ui/TemplateVariableForm';
import { TemplateUpgradeBanner } from '@/components/ui/TemplateUpgradeBanner';
import { FeaturedTemplates } from '@/components/FeaturedTemplates';
import { QuickActions } from '@/components/QuickActions';
import { ConversationSidebar } from '@/components/ConversationSidebar';
import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  files?: any[];
  model?: string;
  timestamp: Date;
  tokens?: number;
  credits?: number;
}

interface Template {
  id: string;
  title: string;
  description: string | null;
  template: string;
  tier: string;
  category: {
    id: string;
    name: string;
    icon: string | null;
  } | null;
  tags: string[];
  variables: any[];
  isFeatured: boolean;
  usageCount: number;
  requiresGoogleDrive: boolean;
  requiresGmail: boolean;
  requiresCalendar: boolean;
}

interface ChatInterfaceProps {
  initialCategoryFilter?: string | null;
  onTemplateSelectorOpen?: () => void;
}

export function ChatInterface({ initialCategoryFilter, onTemplateSelectorOpen }: ChatInterfaceProps = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);

  // Template system state
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showVariableForm, setShowVariableForm] = useState(false);
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false);
  const [upgradeInfo, setUpgradeInfo] = useState<any>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(initialCategoryFilter || null);

  const chatInputRef = useRef<any>(null);

  // Load conversation when selected
  useEffect(() => {
    if (currentConversationId) {
      loadConversation(currentConversationId);
    }
  }, [currentConversationId]);

  const loadConversation = async (conversationId: string) => {
    setIsLoadingConversation(true);
    try {
      const response = await fetch(`/api/workspace/conversations/${conversationId}?limit=100`);
      if (response.ok) {
        const data = await response.json();
        const loadedMessages: Message[] = data.messages.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          model: msg.model,
          timestamp: new Date(msg.createdAt),
          tokens: msg.tokens,
          credits: msg.credits,
        }));
        setMessages(loadedMessages);
        setShowQuickActions(false);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setIsLoadingConversation(false);
    }
  };

  const createNewConversation = async (firstMessage: string): Promise<string | null> => {
    try {
      const response = await fetch('/api/workspace/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : ''),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.id;
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
    return null;
  };

  const saveMessage = async (
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    model?: string,
    tokens?: number,
    credits?: number
  ): Promise<Message | null> => {
    try {
      const response = await fetch(`/api/workspace/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          content,
          model,
          tokens,
          credits,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          id: data.id,
          role: data.role,
          content: data.content,
          model: data.model,
          timestamp: new Date(data.createdAt),
          tokens: data.tokens,
          credits: data.credits,
        };
      }
    } catch (error) {
      console.error('Error saving message:', error);
    }
    return null;
  };

  const handleNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setShowQuickActions(true);
  };

  const handleSelectConversation = (conversationId: string) => {
    setCurrentConversationId(conversationId);
    setShowQuickActions(false);
  };

  const handleDeleteConversation = (conversationId: string) => {
    if (currentConversationId === conversationId) {
      handleNewConversation();
    }
  };

  const handleQuickAction = (prompt: string) => {
    setShowQuickActions(false);
    if (chatInputRef.current?.setMessage) {
      chatInputRef.current.setMessage(prompt);
    }
  };

  const handleSendMessage = async (data: {
    message: string;
    files: any[];
    pastedContent: any[];
    model: string;
    isThinkingEnabled: boolean;
  }) => {
    console.log('Sending message:', data);
    setIsLoading(true);

    try {
      // Create conversation if this is the first message
      let conversationId = currentConversationId;
      if (!conversationId) {
        conversationId = await createNewConversation(data.message);
        if (!conversationId) {
          throw new Error('Failed to create conversation');
        }
        setCurrentConversationId(conversationId);
      }

      // Save user message to database
      const savedUserMessage = await saveMessage(
        conversationId,
        'user',
        data.message,
        data.model
      );

      if (savedUserMessage) {
        setMessages(prev => [...prev, savedUserMessage]);
      } else {
        // Fallback to local message if save fails
        const userMessage: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: data.message,
          files: data.files,
          model: data.model,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);
      }

      // Call the AI API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: data.message,
          files: data.files,
          pastedContent: data.pastedContent,
          model: data.model,
          isThinkingEnabled: data.isThinkingEnabled,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();

      // Calculate tokens and credits from usage
      const tokens = result.usage?.totalTokens || 0;
      const credits = Math.ceil(tokens / 1000); // Approximate credit calculation

      // Save assistant message to database
      const savedAssistantMessage = await saveMessage(
        conversationId,
        'assistant',
        result.response,
        result.model,
        tokens,
        credits
      );

      if (savedAssistantMessage) {
        setMessages(prev => [...prev, savedAssistantMessage]);
      } else {
        // Fallback to local message if save fails
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: result.response,
          model: result.model,
          timestamp: new Date(result.timestamp),
          tokens,
          credits,
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);

      // Show error message to user
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, there was an error processing your message. Please try again.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Template handlers
  const handleOpenTemplateSelector = (categoryId: string | null = null) => {
    setCategoryFilter(categoryId);
    setShowTemplateSelector(true);
    onTemplateSelectorOpen?.();
  };

  const handleSelectTemplate = async (template: Template) => {
    setSelectedTemplate(template);
    setShowTemplateSelector(false);

    // Check access
    try {
      const response = await fetch(`/api/templates/${template.id}/check-access`, {
        method: 'POST',
      });

      const accessData = await response.json();

      if (!accessData.hasAccess) {
        // Show upgrade banner
        setUpgradeInfo(accessData);
        setShowUpgradeBanner(true);
      } else {
        // Show variable form
        setShowVariableForm(true);
      }
    } catch (error) {
      console.error('Error checking template access:', error);
      // On error, assume they have access
      setShowVariableForm(true);
    }
  };

  const handleUseTemplate = (populatedPrompt: string) => {
    setShowVariableForm(false);
    setSelectedTemplate(null);

    // Set the message in the chat input
    if (chatInputRef.current?.setMessage) {
      chatInputRef.current.setMessage(populatedPrompt);
    }
  };

  const handleCloseUpgradeBanner = () => {
    setShowUpgradeBanner(false);
    setUpgradeInfo(null);
    setSelectedTemplate(null);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Conversation Sidebar */}
      <ConversationSidebar
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="w-full space-y-4 p-4">
            {/* Quick Actions - Show only when no messages */}
            {messages.length === 0 && showQuickActions && (
              <div className="mb-8">
                <QuickActions onSelectAction={handleQuickAction} />
              </div>
            )}

            {/* Featured Templates - Show only when no messages */}
            {messages.length === 0 && !showQuickActions && (
              <div className="max-w-4xl mx-auto">
                <FeaturedTemplates onSelectTemplate={handleSelectTemplate} />
              </div>
            )}

            {/* Loading Conversation */}
            {isLoadingConversation && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Loading conversation...
              </div>
            )}

            {/* Messages Display */}
            {messages.length > 0 && !isLoadingConversation && (
              <div className="space-y-4 mb-8 max-w-2xl mx-auto">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`p-4 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-blue-50 dark:bg-blue-900/20 ml-8'
                        : 'bg-gray-50 dark:bg-gray-800 mr-8'
                    }`}
                  >
                    <div className="text-xs font-semibold mb-2 text-gray-500 dark:text-gray-400">
                      {msg.role === 'user' ? 'You' : 'Assistant'}
                      {msg.model && ` (${msg.model})`}
                    </div>
                    <div className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                      {msg.content}
                    </div>
                    {msg.tokens && (
                      <div className="text-xs text-gray-400 mt-2">
                        {msg.tokens} tokens • {msg.credits} credits
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 mr-8">
                    <div className="text-xs font-semibold mb-2 text-gray-500 dark:text-gray-400">
                      Assistant
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <div className="animate-pulse">Thinking...</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Chat Input - Fixed at bottom */}
        <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
          <div className="max-w-4xl mx-auto">
            <ClaudeChatInput
              ref={chatInputRef}
              onSendMessage={handleSendMessage}
              onOpenTemplateSelector={handleOpenTemplateSelector}
            />
          </div>
        </div>
      </div>

      {/* Template Selector Modal */}
      {showTemplateSelector && (
        <TemplateSelector
          open={showTemplateSelector}
          onClose={() => {
            setShowTemplateSelector(false);
            setCategoryFilter(null);
          }}
          onSelectTemplate={handleSelectTemplate}
          initialCategory={categoryFilter}
        />
      )}

      {/* Template Variable Form */}
      {showVariableForm && selectedTemplate && (
        <TemplateVariableForm
          template={selectedTemplate}
          onClose={() => {
            setShowVariableForm(false);
            setSelectedTemplate(null);
          }}
          onUseTemplate={handleUseTemplate}
        />
      )}

      {/* Upgrade Banner */}
      {showUpgradeBanner && upgradeInfo && selectedTemplate && (
        <TemplateUpgradeBanner
          templateTitle={selectedTemplate.title}
          templateTier={upgradeInfo.templateTier}
          userTier={upgradeInfo.userTier}
          missingIntegrations={upgradeInfo.missingIntegrations}
          onClose={handleCloseUpgradeBanner}
        />
      )}
    </div>
  );
}
