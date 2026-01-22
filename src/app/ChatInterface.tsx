'use client';

import { ClaudeChatInput } from '@/components/ui/claude-style-chat-input';
import { TemplateSelector } from '@/components/ui/TemplateSelector';
import { TemplateVariableForm } from '@/components/ui/TemplateVariableForm';
import { TemplateUpgradeBanner } from '@/components/ui/TemplateUpgradeBanner';
import { FeaturedTemplates } from '@/components/FeaturedTemplates';
import { useState, useRef } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  files?: any[];
  model?: string;
  timestamp: Date;
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

  // Template system state
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showVariableForm, setShowVariableForm] = useState(false);
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false);
  const [upgradeInfo, setUpgradeInfo] = useState<any>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(initialCategoryFilter || null);

  const chatInputRef = useRef<any>(null);

  const handleSendMessage = async (data: {
    message: string;
    files: any[];
    pastedContent: any[];
    model: string;
    isThinkingEnabled: boolean;
  }) => {
    console.log('Sending message:', data);

    // Add user message to chat
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: data.message,
      files: data.files,
      model: data.model,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Call the API
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

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.response,
        model: result.model,
        timestamp: new Date(result.timestamp),
      };

      setMessages(prev => [...prev, assistantMessage]);
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
    <div className="w-full space-y-4">
      {/* Featured Templates - Show only when no messages */}
      {messages.length === 0 && (
        <div className="max-w-4xl mx-auto">
          <FeaturedTemplates onSelectTemplate={handleSelectTemplate} />
        </div>
      )}

      {/* Messages Display */}
      {messages.length > 0 && (
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
              <div className="text-gray-900 dark:text-gray-100">{msg.content}</div>
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

      {/* Chat Input */}
      <ClaudeChatInput
        ref={chatInputRef}
        onSendMessage={handleSendMessage}
        onOpenTemplateSelector={handleOpenTemplateSelector}
      />

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
