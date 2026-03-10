'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description?: string;
  category: string;
  prompt: string;
  defaultWidth: number;
  defaultHeight: number;
  icon?: string;
}

interface ImageTemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (template: Template) => void;
}

export function ImageTemplateSelector({
  isOpen,
  onClose,
  onSelect,
}: ImageTemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Fetch templates
  useEffect(() => {
    if (!isOpen) return;

    const fetchTemplates = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/image-templates');
        const data = await response.json();
        if (data.success) {
          setTemplates(data.templates);
          setCategories(data.categories);
          if (data.categories.length > 0) {
            setSelectedCategory(data.categories[0]);
          }
        }
      } catch (error) {
        console.error('Error fetching templates:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplates();
  }, [isOpen]);

  // Filter templates
  const filteredTemplates = templates.filter((template) => {
    const matchesCategory = !selectedCategory || template.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleSelectTemplate = (template: Template) => {
    onSelect?.(template);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Image Template</DialogTitle>
          <DialogDescription>
            Choose a template to jumpstart your image generation with pre-configured settings
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={!selectedCategory ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('')}
              >
                All
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className="capitalize"
                >
                  {category.replace('-', ' ')}
                </Button>
              ))}
            </div>

            {/* Templates Grid */}
            {filteredTemplates.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-4">
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className="p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-2">
                        {template.icon && <span className="text-2xl">{template.icon}</span>}
                        <div>
                          <p className="font-semibold text-sm text-gray-900 dark:text-white">
                            {template.name}
                          </p>
                          {template.description && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {template.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs capitalize">
                        {template.category.replace('-', ' ')}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {template.defaultWidth}×{template.defaultHeight}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">No templates found</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
