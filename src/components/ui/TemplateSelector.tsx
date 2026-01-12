'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Sparkles, Lock } from 'lucide-react';

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

interface TemplateSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (template: Template) => void | Promise<void>;
  initialCategory?: string | null;
}

export function TemplateSelector({
  open,
  onClose,
  onSelectTemplate,
  initialCategory,
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadTemplates();
      loadCategories();
    }
  }, [open, selectedCategory]);

  useEffect(() => {
    if (initialCategory) {
      setSelectedCategory(initialCategory);
    }
  }, [initialCategory]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('categoryId', selectedCategory);

      const response = await fetch(`/api/templates?${params.toString()}`);
      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/templates/categories');
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const filteredTemplates = templates.filter((template) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      template.title.toLowerCase().includes(query) ||
      template.description?.toLowerCase().includes(query) ||
      template.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  const featuredTemplates = filteredTemplates.filter((t) => t.isFeatured);
  const regularTemplates = filteredTemplates.filter((t) => !t.isFeatured);

  const getTierBadge = (tier: string) => {
    const tierColors = {
      free: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      pro: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      enterprise: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    };

    return (
      <Badge variant="secondary" className={tierColors[tier as keyof typeof tierColors] || tierColors.free}>
        {tier.toUpperCase()}
      </Badge>
    );
  };

  const getIntegrationBadges = (template: Template) => {
    const integrations = [];
    if (template.requiresGoogleDrive) integrations.push('Drive');
    if (template.requiresGmail) integrations.push('Gmail');
    if (template.requiresCalendar) integrations.push('Calendar');
    return integrations;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Select a Template</DialogTitle>
        </DialogHeader>

        {/* Search and Categories */}
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === null
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {category.icon && <span className="mr-1">{category.icon}</span>}
                {category.name} ({category._count?.templates || 0})
              </button>
            ))}
          </div>
        </div>

        {/* Template List */}
        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">Loading templates...</div>
            </div>
          ) : (
            <>
              {/* Featured Templates */}
              {featuredTemplates.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-yellow-500" />
                    Featured Templates
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {featuredTemplates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onSelect={onSelectTemplate}
                        getTierBadge={getTierBadge}
                        getIntegrationBadges={getIntegrationBadges}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Regular Templates */}
              {regularTemplates.length > 0 && (
                <div>
                  {featuredTemplates.length > 0 && (
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
                      All Templates
                    </h3>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {regularTemplates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onSelect={onSelectTemplate}
                        getTierBadge={getTierBadge}
                        getIntegrationBadges={getIntegrationBadges}
                      />
                    ))}
                  </div>
                </div>
              )}

              {filteredTemplates.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <p className="text-lg font-medium">No templates found</p>
                  <p className="text-sm">Try adjusting your search or filters</p>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({
  template,
  onSelect,
  getTierBadge,
  getIntegrationBadges,
}: {
  template: Template;
  onSelect: (template: Template) => void;
  getTierBadge: (tier: string) => JSX.Element;
  getIntegrationBadges: (template: Template) => string[];
}) {
  const integrations = getIntegrationBadges(template);
  const isPremium = template.tier !== 'free';

  return (
    <button
      onClick={() => onSelect(template)}
      className="group relative p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 transition-all text-left bg-white dark:bg-gray-800 hover:shadow-md"
    >
      {/* Premium Lock Overlay */}
      {isPremium && (
        <div className="absolute top-2 right-2">
          <Lock className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
        </div>
      )}

      {/* Category Badge */}
      {template.category && (
        <div className="mb-2">
          <Badge variant="outline" className="text-xs">
            {template.category.icon} {template.category.name}
          </Badge>
        </div>
      )}

      {/* Title and Tier */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-1">
          {template.title}
        </h4>
        {getTierBadge(template.tier)}
      </div>

      {/* Description */}
      {template.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
          {template.description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-2">
          {integrations.length > 0 && (
            <div className="flex gap-1">
              {integrations.map((integration) => (
                <Badge key={integration} variant="secondary" className="text-xs">
                  {integration}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <span>{template.usageCount} uses</span>
      </div>
    </button>
  );
}
