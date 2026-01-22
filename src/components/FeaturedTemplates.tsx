'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, FileText, Mail, Code, Briefcase, PenTool } from 'lucide-react';

interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  template: string;
  variables: Array<{
    name: string;
    label: string;
    type: string;
    placeholder?: string;
  }>;
  categoryId?: string;
  isFeatured: boolean;
  tier: string;
}

interface FeaturedTemplatesProps {
  onSelectTemplate: (template: PromptTemplate) => void;
}

const CATEGORY_ICONS: Record<string, any> = {
  'writing': PenTool,
  'coding': Code,
  'business': Briefcase,
  'email': Mail,
  'content': FileText,
  'default': Sparkles,
};

export function FeaturedTemplates({ onSelectTemplate }: FeaturedTemplatesProps) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchFeaturedTemplates();
  }, []);

  const fetchFeaturedTemplates = async () => {
    try {
      const response = await fetch('/api/templates?featured=true&limit=6');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Error fetching featured templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full mt-2"></div>
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-blue-500" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Featured Templates
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => {
          const IconComponent = CATEGORY_ICONS['default'];

          return (
            <Card
              key={template.id}
              className="cursor-pointer hover:shadow-lg hover:border-blue-500 transition-all group"
              onClick={() => onSelectTemplate(template)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                      <IconComponent className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    {template.tier !== 'free' && (
                      <Badge variant="secondary" className="text-xs">
                        {template.tier}
                      </Badge>
                    )}
                  </div>
                </div>
                <CardTitle className="text-base mt-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {template.title}
                </CardTitle>
                <CardDescription className="text-sm line-clamp-2">
                  {template.description}
                </CardDescription>
              </CardHeader>

              {template.variables && template.variables.length > 0 && (
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-1.5">
                    {template.variables.slice(0, 3).map((variable) => (
                      <Badge
                        key={variable.name}
                        variant="outline"
                        className="text-xs bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                      >
                        {variable.label}
                      </Badge>
                    ))}
                    {template.variables.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{template.variables.length - 3}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
