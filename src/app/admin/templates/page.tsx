'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react';

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
  };
  tags: string[];
  variables: TemplateVariable[];
  isPublic: boolean;
  isActive: boolean;
  isFeatured: boolean;
  usageCount: number;
  createdAt: string;
}

export default function AdminTemplatesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/?auth=signin');
      return;
    }

    if (status === 'authenticated') {
      fetchTemplates();
    }
  }, [status, router]);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/admin/templates');
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

  const deleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const response = await fetch(`/api/admin/templates/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchTemplates();
      }
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Prompt Templates
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage your prompt template library
            </p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        </div>

        <div className="grid gap-4">
          {templates.map((template) => (
            <Card key={template.id} className="border border-gray-200 dark:border-gray-700">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-xl">{template.title}</CardTitle>
                      {!template.isActive && (
                        <Badge variant="outline" className="text-red-500 border-red-500">
                          Inactive
                        </Badge>
                      )}
                      {!template.isPublic && (
                        <Badge variant="outline" className="text-orange-500 border-orange-500">
                          Private
                        </Badge>
                      )}
                      {template.isFeatured && (
                        <Badge className="bg-blue-500 text-white">Featured</Badge>
                      )}
                    </div>
                    {template.description && (
                      <CardDescription>{template.description}</CardDescription>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      {template.category && (
                        <Badge variant="outline">{template.category.name}</Badge>
                      )}
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Used {template.usageCount} times
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/admin/templates/${template.id}`)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteTemplate(template.id)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Template:
                    </p>
                    <pre className="text-sm bg-gray-100 dark:bg-gray-800 p-3 rounded-lg overflow-x-auto">
                      {template.template}
                    </pre>
                  </div>
                  {template.variables && template.variables.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Variables:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(template.variables as TemplateVariable[]).map((variable, index) => (
                          <Badge key={index} variant="outline">
                            {variable.label} ({variable.type})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {templates.length === 0 && (
          <Card className="border border-dashed border-gray-300 dark:border-gray-700">
            <CardContent className="py-12 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                No templates yet. Click "New Template" to create one.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
