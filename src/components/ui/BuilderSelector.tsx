'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutTemplate,
  Gauge,
  Briefcase,
  Building2,
  Cloud,
  User,
  Smartphone,
  ShoppingCart,
  GraduationCap,
  Newspaper,
  Calendar,
  Mail,
  ChevronLeft,
  ChevronRight,
  Link as LinkIcon,
  Figma,
} from 'lucide-react';

// Types
interface Category {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface BuilderSelectorProps {
  onCategorySelect?: (categoryId: string) => void;
  onAddReference?: () => void;
  onImportFigma?: () => void;
}

const categories: Category[] = [
  { id: 'landing-page', label: 'Landing page', icon: LayoutTemplate },
  { id: 'dashboard', label: 'Dashboard', icon: Gauge },
  { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
  { id: 'corporate', label: 'Corporate', icon: Building2 },
  { id: 'saas', label: 'SaaS', icon: Cloud },
  { id: 'link-in-bio', label: 'Link in bio', icon: User },
  { id: 'mobile-app', label: 'Mobile app', icon: Smartphone },
  { id: 'e-commerce', label: 'E-commerce', icon: ShoppingCart },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'blog', label: 'Blog', icon: Newspaper },
  { id: 'booking', label: 'Booking', icon: Calendar },
  { id: 'newsletter', label: 'Newsletter', icon: Mail },
];

export default function BuilderSelector({
  onCategorySelect,
  onAddReference,
  onImportFigma,
}: BuilderSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Check scroll position to show/hide arrows
  const checkScroll = () => {
    if (!scrollContainerRef.current) return;

    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setShowLeftArrow(scrollLeft > 0);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  // Scroll functions
  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;

    const scrollAmount = 300;
    const newScrollLeft =
      scrollContainerRef.current.scrollLeft +
      (direction === 'left' ? -scrollAmount : scrollAmount);

    scrollContainerRef.current.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth',
    });
  };

  // Handle category selection
  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
    onCategorySelect?.(categoryId);
    console.log('Category selected:', categoryId);
  };

  // Handle action buttons
  const handleAddReference = () => {
    onAddReference?.();
    console.log('Add website reference clicked');
  };

  const handleImportFigma = () => {
    onImportFigma?.();
    console.log('Import from Figma clicked');
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        scroll('left');
      } else if (e.key === 'ArrowRight') {
        scroll('right');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="w-full bg-[#1a1a1a] rounded-xl p-6 sm:p-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-white">
          What would you like to build?
        </h2>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleAddReference}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2a2a2a] hover:bg-[#353535] text-white rounded-lg transition-colors duration-200 text-sm font-medium"
            aria-label="Add website reference"
          >
            <LinkIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Add website reference</span>
            <span className="sm:hidden">Add ref</span>
          </button>

          <button
            onClick={handleImportFigma}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2a2a2a] hover:bg-[#353535] text-white rounded-lg transition-colors duration-200 text-sm font-medium"
            aria-label="Import from Figma"
          >
            <Figma className="w-4 h-4" />
            <span className="hidden sm:inline">Import from Figma</span>
            <span className="sm:hidden">Figma</span>
          </button>
        </div>
      </div>

      {/* Scrollable Button Grid */}
      <div className="relative group">
        {/* Left Arrow */}
        {showLeftArrow && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-[#2a2a2a] hover:bg-[#353535] rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Right Arrow */}
        {showRightArrow && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-[#2a2a2a] hover:bg-[#353535] rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* Fade Effect - Left */}
        {showLeftArrow && (
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#1a1a1a] to-transparent z-[5] pointer-events-none" />
        )}

        {/* Fade Effect - Right */}
        {showRightArrow && (
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#1a1a1a] to-transparent z-[5] pointer-events-none" />
        )}

        {/* Scrollable Container */}
        <div
          ref={scrollContainerRef}
          onScroll={checkScroll}
          className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
          role="tablist"
          aria-label="Builder categories"
        >
          {categories.map((category) => {
            const Icon = category.icon;
            const isSelected = selectedCategory === category.id;

            return (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category.id)}
                className={`
                  inline-flex items-center gap-3 px-5 py-3 rounded-xl
                  font-medium text-sm whitespace-nowrap
                  transition-all duration-200
                  flex-shrink-0
                  ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'bg-[#2a2a2a] text-white hover:bg-[#353535] hover:brightness-110'
                  }
                `}
                role="tab"
                aria-selected={isSelected}
                aria-label={`Select ${category.label}`}
              >
                <Icon className="w-5 h-5" />
                <span>{category.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Category Display (Optional) */}
      {selectedCategory && (
        <div className="mt-6 p-4 bg-[#2a2a2a] rounded-lg">
          <p className="text-sm text-gray-400">
            Selected:{' '}
            <span className="text-white font-medium">
              {categories.find((c) => c.id === selectedCategory)?.label}
            </span>
          </p>
        </div>
      )}

      {/* Hide scrollbar */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
