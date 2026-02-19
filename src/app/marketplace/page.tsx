'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Download,
  Star,
  Search,
  Filter,
  TrendingUp,
  Clock,
  DollarSign,
  Check,
  Loader2,
  Sparkles,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';

interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  pricingModel: 'free' | 'one-time' | 'subscription';
  price: number;
  downloads: number;
  rating: number;
  reviewCount: number;
  featured: boolean;
  tags: string[];
  isInstalled: boolean;
  installCount: number;
  creator: {
    id: string;
    name: string;
    image?: string;
  };
}

const CATEGORIES = [
  { id: 'all', name: 'All Skills', icon: '📦' },
  { id: 'productivity', name: 'Productivity', icon: '⚡' },
  { id: 'data', name: 'Data & Analytics', icon: '📊' },
  { id: 'communication', name: 'Communication', icon: '💬' },
  { id: 'integration', name: 'Integrations', icon: '🔗' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎮' },
];

const SORT_OPTIONS = [
  { value: 'popular', label: 'Most Popular', icon: TrendingUp },
  { value: 'newest', label: 'Newest', icon: Clock },
  { value: 'rating', label: 'Highest Rated', icon: Star },
  { value: 'price', label: 'Price: Low to High', icon: DollarSign },
];

export default function MarketplacePage() {
  const { data: session } = useSession();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSort, setSelectedSort] = useState('popular');
  const [pricingFilter, setPricingFilter] = useState<string | null>(null);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);

  useEffect(() => {
    loadSkills();
  }, [selectedCategory, selectedSort, pricingFilter, featuredOnly]);

  const loadSkills = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);
      if (pricingFilter) params.append('pricing', pricingFilter);
      if (featuredOnly) params.append('featured', 'true');
      params.append('sort', selectedSort);

      const response = await fetch(`/api/marketplace/skills?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setSkills(data.skills);
      }
    } catch (error) {
      console.error('Error loading skills:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadSkills();
  };

  const handleInstall = async (skillId: string) => {
    if (!session) {
      alert('Please sign in to install skills');
      return;
    }

    setInstalling(skillId);
    try {
      const response = await fetch('/api/marketplace/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId }),
      });

      const data = await response.json();

      if (response.ok) {
        // Update skill in list
        setSkills((prev) =>
          prev.map((s) => (s.id === skillId ? { ...s, isInstalled: true } : s))
        );
        alert('Skill installed successfully!');
      } else {
        alert(data.error || 'Failed to install skill');
      }
    } catch (error) {
      console.error('Error installing skill:', error);
      alert('Failed to install skill');
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div className="relative">
      <Sidebar />
      <div className="lg:ml-64 transition-all duration-300">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <Sparkles className="w-8 h-8 text-purple-500" />
                Skill Marketplace
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Discover and install AI skills created by the community
              </p>
            </div>
            <Link href="/marketplace/create">
              <Button className="gradient-primary hover:gradient-primary-hover">
                Create Skill
              </Button>
            </Link>
          </div>

          {/* Search and Filters */}
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search skills..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <Button onClick={handleSearch} className="px-6">
                Search
              </Button>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap gap-3">
              {/* Category Filter */}
              <div className="flex gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="mr-2">{cat.icon}</span>
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Pricing Filter */}
              <select
                value={pricingFilter || ''}
                onChange={(e) => setPricingFilter(e.target.value || null)}
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">All Pricing</option>
                <option value="free">Free</option>
                <option value="one-time">One-time Purchase</option>
                <option value="subscription">Subscription</option>
              </select>

              {/* Sort */}
              <select
                value={selectedSort}
                onChange={(e) => setSelectedSort(e.target.value)}
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Featured Toggle */}
              <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={featuredOnly}
                  onChange={(e) => setFeaturedOnly(e.target.checked)}
                  className="w-4 h-4 text-purple-500 rounded focus:ring-2 focus:ring-purple-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Featured Only
                </span>
              </label>
            </div>
          </div>

          {/* Skills Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
          ) : skills.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                No skills found. Try adjusting your filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {skills.map((skill) => (
                <Card
                  key={skill.id}
                  className="p-6 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-purple-300 dark:hover:border-purple-700 transition-all hover:shadow-lg"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="text-4xl">{skill.icon}</div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {skill.name}
                        </h3>
                        {skill.featured && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 dark:text-purple-400">
                            <Sparkles className="w-3 h-3" />
                            Featured
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                    {skill.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {skill.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 mb-4 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <Download className="w-4 h-4" />
                      {skill.downloads.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      {skill.rating.toFixed(1)} ({skill.reviewCount})
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-4">
                    {skill.pricingModel === 'free' ? (
                      <span className="text-lg font-semibold text-green-600 dark:text-green-400">
                        Free
                      </span>
                    ) : (
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">
                        ${(skill.price / 100).toFixed(2)}
                        {skill.pricingModel === 'subscription' && ' /month'}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {skill.isInstalled ? (
                      <Button disabled className="flex-1" variant="outline">
                        <Check className="w-4 h-4 mr-2" />
                        Installed
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleInstall(skill.id)}
                        disabled={installing === skill.id}
                        className="flex-1 gradient-primary hover:gradient-primary-hover"
                      >
                        {installing === skill.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Installing...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-2" />
                            Install
                          </>
                        )}
                      </Button>
                    )}
                    <Link href={`/marketplace/skills/${skill.id}`}>
                      <Button variant="outline">Details</Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
