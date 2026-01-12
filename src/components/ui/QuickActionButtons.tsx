'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';

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
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
        Quick actions:
      </span>

      {/* Top Category Buttons */}
      {topCategories.map((category) => (
        <Button
          key={category.id}
          variant="outline"
          size="sm"
          onClick={() => onCategorySelect(category.id, category.name)}
          className="gap-2"
        >
          {category.icon && <span>{category.icon}</span>}
          {category.name}
        </Button>
      ))}

      {/* More Dropdown */}
      {remainingCategories.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              More
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {remainingCategories.map((category) => (
              <DropdownMenuItem
                key={category.id}
                onClick={() => onCategorySelect(category.id, category.name)}
              >
                {category.icon && <span className="mr-2">{category.icon}</span>}
                {category.name}
                {category._count && category._count.templates > 0 && (
                  <span className="ml-auto text-xs text-gray-500">
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
