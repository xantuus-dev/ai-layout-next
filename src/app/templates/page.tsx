'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Sparkles, TrendingUp, Loader2, X } from 'lucide-react';
import ClaudeChatInput from '@/components/ui/claude-style-chat-input';
import { TemplateVariableHighlighter } from '@/components/ui/TemplateVariableHighlighter';
import { EditableTemplateVariableHighlighter } from '@/components/ui/EditableTemplateVariableHighlighter';
import Sidebar from '@/components/Sidebar';

interface TemplateVariable {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea';
  placeholder?: string;
  options?: string[];
  required?: boolean;
}

interface Template {
  id: string;
  title: string;
  description?: string;
  template: string;
  category?: {
    name: string;
    icon?: string;
  };
  tags: string[];
  variables: TemplateVariable[];
  isFeatured: boolean;
  usageCount: number;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  _count: {
    templates: number;
  };
}

export default function TemplatesGalleryPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templatePrompt, setTemplatePrompt] = useState<string>('');
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const chatInputRef = useRef<{ setMessage: (msg: string) => void; focusAndHighlight?: () => void }>(null);

  useEffect(() => {
    fetchCategories();
    fetchTemplates();
  }, [selectedCategory]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/templates/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      let url = '/api/templates';
      const params = new URLSearchParams();

      if (selectedCategory) {
        params.append('categoryId', selectedCategory);
      }

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateSelect = async (template: Template) => {
    // Set the selected template and show the centered chatbox
    setSelectedTemplate(template);

    // Initialize variable values as empty
    const initialValues: Record<string, string> = {};
    template.variables.forEach((v) => {
      initialValues[v.name] = '';
    });
    setVariableValues(initialValues);

    // Replace all variables with empty strings for initial prompt
    let initialPrompt = template.template;
    template.variables.forEach((v) => {
      initialPrompt = initialPrompt.replace(new RegExp(`\\{\\{${v.name}\\}\\}`, 'g'), '');
    });
    setTemplatePrompt(initialPrompt);

    // Populate the chat input with empty variables and focus it after a short delay to ensure it's rendered
    setTimeout(() => {
      if (chatInputRef.current) {
        chatInputRef.current.setMessage(initialPrompt);
        chatInputRef.current.focusAndHighlight?.();
      }
    }, 150);
  };

  const handleCloseChatbox = () => {
    setSelectedTemplate(null);
    setTemplatePrompt('');
    setVariableValues({});
  };

  const handleVariableChange = (variableName: string, value: string) => {
    const updatedValues = { ...variableValues, [variableName]: value };
    setVariableValues(updatedValues);

    // Update the template prompt with all variable values (replace {{variable}} with actual values)
    let updatedPrompt = selectedTemplate?.template || '';
    Object.entries(updatedValues).forEach(([name, val]) => {
      updatedPrompt = updatedPrompt.replace(new RegExp(`\\{\\{${name}\\}\\}`, 'g'), val);
    });
    setTemplatePrompt(updatedPrompt);

    // Update chat input with the final text (variables replaced)
    if (chatInputRef.current) {
      chatInputRef.current.setMessage(updatedPrompt);
    }
  };

  const handleSendMessage = async (data: {
    message: string;
    files: any[];
    pastedContent: any[];
    model: string;
    isThinkingEnabled: boolean;
  }) => {
    try {
      // Create workspace with template
      const res = await fetch('/api/workspace/create-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedTemplate?.title || 'New Conversation',
          description: selectedTemplate?.description,
          initialPrompt: data.message,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create workspace');
      }

      const workspaceData = await res.json();

      // Store pending execution with template prompt
      sessionStorage.setItem(
        'pendingExecution',
        JSON.stringify({
          conversationId: workspaceData.conversationId,
          message: data.message,
          files: data.files,
          pastedContent: data.pastedContent,
          model: data.model,
          isThinkingEnabled: data.isThinkingEnabled,
        })
      );

      // Navigate to workspace
      router.push(`/workspace/${workspaceData.workspaceId}`);
    } catch (error) {
      console.error('Failed to start from template:', error);
      alert('Failed to create workspace. Please try again.');
    }
  };

  const filteredTemplates = templates.filter((template) =>
    searchQuery
      ? template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description?.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  const featuredTemplates = filteredTemplates.filter(t => t.isFeatured);
  const regularTemplates = filteredTemplates.filter(t => !t.isFeatured);

  return (
    <div className="relative">
      <Sidebar />
      <div className="lg:ml-64 transition-all duration-300">
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative">
      {/* Centered Chatbox Overlay */}
      {selectedTemplate && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            // Close when clicking the backdrop
            if (e.target === e.currentTarget) {
              handleCloseChatbox();
            }
          }}
        >
          <div className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transform transition-all">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedTemplate.title}
                  </h2>
                  {selectedTemplate.isFeatured && (
                    <Badge className="bg-yellow-500 text-white">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Featured
                    </Badge>
                  )}
                </div>
                {selectedTemplate.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedTemplate.description}
                  </p>
                )}
              </div>
              <button
                onClick={handleCloseChatbox}
                className="ml-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Chat Input - Centered */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-12 overflow-y-auto bg-gradient-to-b from-gray-50/50 to-white dark:from-gray-900 dark:to-gray-900">
              <div className="w-full max-w-3xl space-y-4">
                {/* Preview with editable variables */}
                {selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
                      Template Preview - Click variables to edit
                    </p>
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      <EditableTemplateVariableHighlighter
                        text={selectedTemplate.template}
                        variables={selectedTemplate.variables}
                        variableValues={variableValues}
                        onVariableChange={handleVariableChange}
                      />
                    </div>
                  </div>
                )}
                
                <ClaudeChatInput
                  ref={chatInputRef}
                  onSendMessage={handleSendMessage}
                  initialMessage={templatePrompt}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Prompt Template Gallery
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Browse our collection of ready-to-use prompt templates
          </p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && fetchTemplates()}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Categories */}
        {categories.length > 0 && (
          <div className="mb-8">
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedCategory === null
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                All
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    selectedCategory === category.id
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {category.icon} {category.name} ({category._count.templates})
                </button>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <>
            {/* Featured Templates */}
            {featuredTemplates.length > 0 && (
              <div className="mb-12">
                <div className="flex items-center gap-2 mb-6">
                  <Sparkles className="w-6 h-6 text-yellow-500" />
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Featured Templates
                  </h2>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {featuredTemplates.map((template) => (
                    <Card
                      key={template.id}
                      className="border-2 border-yellow-200 dark:border-yellow-800 hover:border-yellow-400 dark:hover:border-yellow-600 transition-all cursor-pointer group"
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between mb-2">
                          <Badge className="bg-yellow-500 text-white">
                            <Sparkles className="w-3 h-3 mr-1" />
                            Featured
                          </Badge>
                          <TrendingUp className="w-4 h-4 text-gray-400" />
                        </div>
                        <CardTitle className="group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {template.title}
                        </CardTitle>
                        {template.description && (
                          <CardDescription className="line-clamp-2">
                            {template.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {template.category && (
                            <Badge variant="outline">
                              {template.category.icon} {template.category.name}
                            </Badge>
                          )}
                          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                            <span>{template.variables.length} variables</span>
                            <span>{template.usageCount} uses</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Regular Templates */}
            {regularTemplates.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                  All Templates
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {regularTemplates.map((template) => (
                    <Card
                      key={template.id}
                      className="hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer group"
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <CardHeader>
                        <CardTitle className="group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {template.title}
                        </CardTitle>
                        {template.description && (
                          <CardDescription className="line-clamp-2">
                            {template.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {template.category && (
                            <Badge variant="outline">
                              {template.category.icon} {template.category.name}
                            </Badge>
                          )}
                          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                            <span>{template.variables.length} variables</span>
                            <span>{template.usageCount} uses</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {filteredTemplates.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <p className="text-gray-600 dark:text-gray-400">
                    No templates found. Try adjusting your search or filters.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
        </div>
      </div>
    </div>
  );
}
