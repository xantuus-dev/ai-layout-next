'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Copy, Check, Sparkles, Loader2 } from 'lucide-react';
import { TemplateVariableHighlighter } from '@/components/ui/TemplateVariableHighlighter';

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

export default function TemplateDetailPage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;

  const [template, setTemplate] = useState<Template | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (templateId) {
      fetchTemplate();
    }
  }, [templateId]);

  useEffect(() => {
    if (template) {
      generatePrompt();
    }
  }, [variableValues, template]);

  const fetchTemplate = async () => {
    try {
      const response = await fetch(`/api/templates/${templateId}`);
      if (response.ok) {
        const data = await response.json();
        setTemplate(data);

        // Initialize variable values
        const initialValues: Record<string, string> = {};
        (data.variables as TemplateVariable[]).forEach((variable) => {
          initialValues[variable.name] = '';
        });
        setVariableValues(initialValues);
      }
    } catch (error) {
      console.error('Error fetching template:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePrompt = () => {
    if (!template) return;

    let prompt = template.template;

    // Replace all {{variable}} placeholders with actual values
    Object.keys(variableValues).forEach((varName) => {
      const regex = new RegExp(`{{${varName}}}`, 'g');
      const value = variableValues[varName] || `[${varName}]`;
      prompt = prompt.replace(regex, value);
    });

    setGeneratedPrompt(prompt);
  };

  const handleVariableChange = (variableName: string, value: string) => {
    setVariableValues({
      ...variableValues,
      [variableName]: value,
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const handleUseTemplate = async () => {
    // Increment usage count
    await fetch(`/api/templates/${templateId}`, {
      method: 'POST',
    });

    // Copy to clipboard
    await handleCopy();

    // Could also redirect to chat with pre-filled prompt
    // router.push(`/?prompt=${encodeURIComponent(generatedPrompt)}`);
  };

  const renderVariableInput = (variable: TemplateVariable) => {
    const value = variableValues[variable.name] || '';

    switch (variable.type) {
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleVariableChange(variable.name, e.target.value)}
            placeholder={variable.placeholder}
            required={variable.required}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={4}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleVariableChange(variable.name, e.target.value)}
            placeholder={variable.placeholder}
            required={variable.required}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleVariableChange(variable.name, e.target.value)}
            required={variable.required}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select an option</option>
            {variable.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'text':
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleVariableChange(variable.name, e.target.value)}
            placeholder={variable.placeholder}
            required={variable.required}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="py-12">
            <p className="text-gray-600 dark:text-gray-400">Template not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Back Button */}
        <Button
          variant="outline"
          onClick={() => router.push('/templates')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Gallery
        </Button>

        {/* Template Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CardTitle className="text-3xl">{template.title}</CardTitle>
                  {template.isFeatured && (
                    <Badge className="bg-yellow-500 text-white">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Featured
                    </Badge>
                  )}
                </div>
                {template.description && (
                  <CardDescription className="text-base">
                    {template.description}
                  </CardDescription>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              {template.category && (
                <Badge variant="outline">
                  {template.category.icon} {template.category.name}
                </Badge>
              )}
              {template.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
              <span className="text-sm text-gray-600 dark:text-gray-400 ml-auto">
                Used {template.usageCount} times
              </span>
            </div>
          </CardHeader>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Variable Inputs */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Configure Variables</CardTitle>
                <CardDescription>
                  Fill in the values for each variable below
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(template.variables as TemplateVariable[]).map((variable, index) => (
                  <div key={index}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {variable.label}
                      {variable.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {renderVariableInput(variable)}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Variable: {'{{'}{variable.name}{'}}'} {variable.placeholder && `• ${variable.placeholder}`}
                    </p>
                  </div>
                ))}

                {template.variables.length === 0 && (
                  <p className="text-gray-600 dark:text-gray-400 text-center py-4">
                    This template has no variables
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Generated Prompt Preview */}
          <div>
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle>Generated Prompt</CardTitle>
                <CardDescription>
                  Preview of your customized prompt
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <div className="text-sm bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
                    <TemplateVariableHighlighter
                      text={generatedPrompt}
                      variables={template.variables as TemplateVariable[]}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleCopy}
                    variant="outline"
                    className="flex-1"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleUseTemplate}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    Use Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
