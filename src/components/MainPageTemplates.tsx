'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2 } from 'lucide-react';

interface TemplateVariable {
  name: string;
  label: string;
  type: string;
  placeholder?: string;
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
  tier: string;
}

interface MainPageTemplatesProps {
  onTemplateSelect: (templateText: string) => void;
}

export function MainPageTemplates({ onTemplateSelect }: MainPageTemplatesProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/templates?featured=true&limit=12');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || data);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateClick = (template: Template) => {
    // Replace variables with placeholder text
    let populatedTemplate = template.template;

    template.variables.forEach((variable) => {
      const placeholder = variable.placeholder || variable.label;
      const regex = new RegExp(`\\{\\{${variable.name}\\}\\}`, 'g');
      populatedTemplate = populatedTemplate.replace(regex, `[${placeholder}]`);
    });

    onTemplateSelect(populatedTemplate);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (templates.length === 0) {
    return null;
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-blue-500" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Or try a template
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((template) => (
          <Card
            key={template.id}
            className="cursor-pointer hover:shadow-md hover:border-blue-400 dark:hover:border-blue-600 transition-all group bg-white dark:bg-gray-800"
            onClick={() => handleTemplateClick(template)}
          >
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-start justify-between mb-1">
                <div className="flex-1">
                  <CardTitle className="text-sm font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                    {template.title}
                  </CardTitle>
                </div>
                {template.tier !== 'free' && (
                  <Badge variant="secondary" className="text-xs ml-2 flex-shrink-0">
                    {template.tier}
                  </Badge>
                )}
              </div>
              {template.description && (
                <CardDescription className="text-xs line-clamp-2">
                  {template.description}
                </CardDescription>
              )}
            </CardHeader>

            <CardContent className="px-4 pb-3 pt-2">
              <div className="flex items-center gap-2">
                {template.category && (
                  <Badge variant="outline" className="text-xs">
                    {template.category.icon} {template.category.name}
                  </Badge>
                )}
                {template.variables.length > 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {template.variables.length} field{template.variables.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center pt-2">
        <a
          href="/templates"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
        >
          View all templates →
        </a>
      </div>
    </div>
  );
}
