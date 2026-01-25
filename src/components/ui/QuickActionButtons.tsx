'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  icon: string | null;
  _count?: {
    templates: number;
  };
}

interface QuickActionButtonsProps {
  onCategorySelect: (categoryId: string | null, categoryName?: string) => void;
}

export function QuickActionButtons({ onCategorySelect }: QuickActionButtonsProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/templates/categories');
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get top 5 categories by template count for quick actions
  const topCategories = categories
    .sort((a, b) => (b._count?.templates || 0) - (a._count?.templates || 0))
    .slice(0, 5);

  const remainingCategories = categories
    .filter((cat) => !topCategories.find((top) => top.id === cat.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (loading || categories.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
        Quick actions:
      </span>

      {/* Top 5 Category Buttons */}
      {topCategories.map((category) => (
        <Button
          key={category.id}
          variant="outline"
          size="sm"
          onClick={() => onCategorySelect(category.id, category.name)}
          className="gap-1.5 h-8 px-2.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          {category.icon && <span className="text-sm">{category.icon}</span>}
          <span className="font-medium">{category.name}</span>
        </Button>
      ))}

      {/* More Dropdown - 6th Button */}
      {remainingCategories.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              aria-label="More categories"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {remainingCategories.map((category) => (
              <DropdownMenuItem
                key={category.id}
                onClick={() => onCategorySelect(category.id, category.name)}
                className="cursor-pointer"
              >
                {category.icon && <span className="mr-2 text-base">{category.icon}</span>}
                <span className="font-medium">{category.name}</span>
                {category._count && category._count.templates > 0 && (
                  <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                    {category._count.templates}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
