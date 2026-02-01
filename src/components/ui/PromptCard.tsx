'use client';

import { ClaudeChatInput } from './claude-style-chat-input';
import AuthModal from './AuthModal';
import { QuickActionButtons } from './QuickActionButtons';
import { TemplateSelector } from './TemplateSelector';
import { TemplateVariableForm } from './TemplateVariableForm';
import { TemplateUpgradeBanner } from './TemplateUpgradeBanner';
import { MainPageTemplates } from '../MainPageTemplates';
import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';

const chipSuggestions = [
  { id: 1, text: 'AI Agent', fill: 'AI agent for IT helpdesk with approvals + audit logs' },
  { id: 2, text: 'Automation', fill: 'Automate tickets → routing → resolution with human-in-the-loop' },
  { id: 3, text: 'AI Security', fill: 'Secure AI rollout: policy, DLP, access controls, monitoring' },
  { id: 4, text: 'Pipelines', fill: 'Data pipeline: ingest → clean → warehouse → embeddings' },
  { id: 5, text: 'Dashboards', fill: 'Exec dashboards: KPIs + anomaly alerts + drilldowns' },
  { id: 6, text: 'Chatbots', fill: 'Business chatbot trained on docs + CRM + workflows' },
];

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

export default function PromptCard() {
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<{ setMessage: (msg: string) => void; focusAndHighlight?: () => void }>(null);

  // Template system state
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showVariableForm, setShowVariableForm] = useState(false);
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false);
  const [upgradeInfo, setUpgradeInfo] = useState<any>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const isAuthenticated = status === 'authenticated';

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (data: {
    message: string;
    files: any[];
    pastedContent: any[];
    model: string;
    isThinkingEnabled: boolean;
  }) => {
    // Check if user is authenticated
    if (!isAuthenticated) {
      setPendingAction(() => () => handleSendMessage(data));
      setShowAuthModal(true);
      return;
    }

    setIsCreatingWorkspace(true);

    try {
      // Step 1: Create workspace and conversation
      const response = await fetch('/api/workspace/create-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: data.message,
          model: data.model,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create workspace');
      }

      const { workspaceId, conversationId } = await response.json();

      // Step 2: Store execution data in sessionStorage for the workspace page
      sessionStorage.setItem(
        'pendingExecution',
        JSON.stringify({
          conversationId,
          message: data.message,
          files: data.files,
          pastedContent: data.pastedContent,
          model: data.model,
          isThinkingEnabled: data.isThinkingEnabled,
        })
      );

      // Step 3: Redirect to workspace page
      window.location.href = `/workspace/${workspaceId}`;
    } catch (error) {
      console.error('Error creating workspace:', error);
      alert('Failed to create workspace. Please try again.');
    } finally {
      setIsCreatingWorkspace(false);
    }
  };

  const handleChipClick = (chipText: string) => {
    // Check if user is authenticated before allowing interaction
    if (!isAuthenticated) {
      setPendingAction(() => () => setDraftMessage(chipText));
      setShowAuthModal(true);
      return;
    }
    // Just populate the input field, don't send automatically
    setDraftMessage(chipText);

    // Scroll the chatbox to center of screen and focus the input
    setTimeout(() => {
      if (chatInputRef.current) {
        // Get the chat input element
        const chatInputElement = chatInputRef.current.getInputElement?.() || chatInputRef.current;

        if (chatInputElement && chatInputElement.scrollIntoView) {
          chatInputElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }

        // Focus the input after scrolling
        chatInputRef.current.focus?.();
      }
    }, 100);
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    // Execute pending action if any
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const handleAuthClose = () => {
    setShowAuthModal(false);
    setPendingAction(null);
  };

  // Template handlers
  const handleCategorySelect = (categoryId: string | null, categoryName?: string) => {
    // Check if user is authenticated before allowing template access
    if (!isAuthenticated) {
      setPendingAction(() => () => handleCategorySelect(categoryId, categoryName));
      setShowAuthModal(true);
      return;
    }
    setCategoryFilter(categoryId);
    setShowTemplateSelector(true);
  };

  const handleOpenTemplateSelector = (categoryId: string | null = null) => {
    // Check if user is authenticated before allowing template access
    if (!isAuthenticated) {
      setPendingAction(() => () => handleOpenTemplateSelector(categoryId));
      setShowAuthModal(true);
      return;
    }
    setCategoryFilter(categoryId);
    setShowTemplateSelector(true);
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

    // Set the message in the draft
    setDraftMessage(populatedPrompt);

    // Scroll to chat input, focus, and highlight
    setTimeout(() => {
      if (chatInputRef.current) {
        chatInputRef.current.focusAndHighlight?.();
      }
    }, 100);
  };

  const handleCloseUpgradeBanner = () => {
    setShowUpgradeBanner(false);
    setUpgradeInfo(null);
    setSelectedTemplate(null);
  };

  const handleMainTemplateSelect = (templateText: string) => {
    // Check if user is authenticated before allowing template access
    if (!isAuthenticated) {
      setPendingAction(() => () => setDraftMessage(templateText));
      setShowAuthModal(true);
      return;
    }
    // Populate the chat input with the template text
    setDraftMessage(templateText);

    // Scroll the chatbox to center of screen and focus the input
    setTimeout(() => {
      if (chatInputRef.current) {
        // Get the chat input element
        const chatInputElement = chatInputRef.current.getInputElement?.() || chatInputRef.current;

        if (chatInputElement && chatInputElement.scrollIntoView) {
          chatInputElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }

        // Focus the input after scrolling
        chatInputRef.current.focus?.();
      }
    }, 100);
  };

  return (
    <div className="w-full">
      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={handleAuthClose}
        onSuccess={handleAuthSuccess}
      />

      <div className="w-full space-y-6">
        <div className="w-full rounded-2xl border border-gray-200 bg-white/80 shadow-lg dark:border-gray-700 dark:bg-gray-800/80 overflow-hidden">
        {/* Header Section */}
        <div className="p-6 bg-white dark:bg-gray-800">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            What do you want to build?
          </h2>

          {/* Claude Chat Input - Directly under heading */}
          <div className="mb-6">
            <ClaudeChatInput
              ref={chatInputRef}
              onSendMessage={handleSendMessage}
              initialMessage={draftMessage}
              onMessageChange={setDraftMessage}
              onOpenTemplateSelector={handleOpenTemplateSelector}
            />
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Choose a suggestion or describe your project
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {chipSuggestions.map((chip) => (
              <button
                key={chip.id}
                onClick={() => handleChipClick(chip.fill)}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 transition-colors hover:border-blue-200 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-200 dark:hover:border-blue-500 dark:hover:bg-blue-500"
              >
                {chip.text}
              </button>
            ))}
          </div>

          {/* Quick Action Buttons for Templates */}
          <QuickActionButtons onCategorySelect={handleCategorySelect} />
        </div>

        {/* Template Cards - Show only when no messages */}
        {messages.length === 0 && (
          <div className="px-6 py-6 bg-gray-50/50 dark:bg-gray-900/20 border-t border-gray-200 dark:border-gray-700">
            <MainPageTemplates onTemplateSelect={handleMainTemplateSelect} />
          </div>
        )}

        {/* Messages Display - Scrollable */}
        {messages.length > 0 && (
          <div
            ref={messagesContainerRef}
            className="max-h-[500px] overflow-y-auto px-6 py-4 space-y-4 bg-gray-50/50 dark:bg-gray-900/20 border-t border-gray-200 dark:border-gray-700"
            style={{ scrollBehavior: 'smooth' }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-4 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-50 dark:bg-blue-900/20 ml-8'
                    : 'bg-white dark:bg-gray-800 mr-8 shadow-sm'
                }`}
              >
                <div className="text-xs font-semibold mb-2 text-gray-500 dark:text-gray-400">
                  {msg.role === 'user' ? 'You' : 'Assistant'}
                  {msg.model && ` (${msg.model})`}
                </div>
                <div className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="p-4 rounded-lg bg-white dark:bg-gray-800 mr-8 shadow-sm">
                <div className="text-xs font-semibold mb-2 text-gray-500 dark:text-gray-400">
                  Assistant
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="animate-pulse">Thinking...</div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
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

      {/* Creating Workspace Loading Modal */}
      {isCreatingWorkspace && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-gray-900 dark:text-white font-medium">
              Creating agent workspace...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
