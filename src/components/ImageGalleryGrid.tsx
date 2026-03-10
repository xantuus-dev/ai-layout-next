'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { ImagePreviewCard } from './ImagePreviewCard';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Image as ImageIcon, Search, X } from 'lucide-react';

interface GeneratedImage {
  id: string;
  imageUrl: string;
  prompt: string;
  width: number;
  height: number;
  creditsUsed: number;
  createdAt: string;
  model: string;
}

interface ImageGalleryGridProps {
  images: GeneratedImage[];
  isLoading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  onImageDeleted?: (id: string) => void;
  onSearch?: (query: string) => void;
  onFilterChange?: (filters: { minWidth?: number; minHeight?: number }) => void;
}

export function ImageGalleryGrid({
  images,
  isLoading = false,
  onLoadMore,
  hasMore = false,
  onImageDeleted,
  onSearch,
  onFilterChange,
}: ImageGalleryGridProps) {
  const observerTarget = useRef<HTMLDivElement>(null);
  const [isObserving, setIsObserving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sizeFilter, setSizeFilter] = useState('all');

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!observerTarget.current || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          onLoadMore?.();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(observerTarget.current);
    setIsObserving(true);

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [hasMore, isLoading, onLoadMore]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    onSearch?.(query);
  };

  const handleSizeFilter = (value: string) => {
    setSizeFilter(value);
    if (value === 'all') {
      onFilterChange?.({});
    } else if (value === 'small') {
      onFilterChange?.({ minWidth: 512, minHeight: 512 });
    } else if (value === 'medium') {
      onFilterChange?.({ minWidth: 1024, minHeight: 1024 });
    } else if (value === 'large') {
      onFilterChange?.({ minWidth: 1536, minHeight: 1536 });
    }
  };

  // Empty state
  if (images.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-4 mb-4">
          <ImageIcon className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          No images yet
        </h3>
        <p className="text-gray-600 dark:text-gray-400 max-w-sm">
          Start generating images by entering a prompt above. Your generated images will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter Controls */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search images by prompt..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 pr-8"
          />
          {searchQuery && (
            <button
              onClick={() => handleSearch('')}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Size Filter */}
        <div>
          <Select value={sizeFilter} onValueChange={handleSizeFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filter by size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sizes</SelectItem>
              <SelectItem value="small">Small (512×512)</SelectItem>
              <SelectItem value="medium">Medium (1024×1024)</SelectItem>
              <SelectItem value="large">Large (1536×1536)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {/* Gallery Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {images.map((image) => (
          <ImagePreviewCard
            key={image.id}
            {...image}
            onDelete={onImageDeleted}
          />
        ))}
      </div>

      {/* Loading More Indicator */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Loading more images...
            </p>
          </div>
        </div>
      )}

      {/* Intersection Observer Target */}
      <div ref={observerTarget} className="h-4" />

      {/* End of List Message */}
      {!hasMore && images.length > 0 && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No more images to load
          </p>
        </div>
      )}
    </div>
  );
}
