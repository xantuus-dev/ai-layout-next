'use client';

import React, { useState } from 'react';
import BuilderSelector from '@/components/ui/BuilderSelector';
import {
  Sparkles,
  Zap,
  Rocket,
  Code,
  Palette,
  Layout,
} from 'lucide-react';

export default function AIBuilderPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showReferenceModal, setShowReferenceModal] = useState(false);
  const [showFigmaModal, setShowFigmaModal] = useState(false);

  const features = [
    {
      icon: Sparkles,
      title: 'AI-Powered',
      description: 'Generate beautiful websites with artificial intelligence',
    },
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Create production-ready sites in minutes, not hours',
    },
    {
      icon: Rocket,
      title: 'Deploy Instantly',
      description: 'One-click deployment to your favorite hosting platform',
    },
    {
      icon: Code,
      title: 'Clean Code',
      description: 'Export semantic, accessible, and optimized code',
    },
    {
      icon: Palette,
      title: 'Customizable',
      description: 'Full control over design, colors, and components',
    },
    {
      icon: Layout,
      title: 'Responsive',
      description: 'Mobile-first design that looks great on all devices',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-8 py-12 sm:py-20">
          {/* Header */}
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-full mb-6">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-300 font-medium">
                AI Website Builder
              </span>
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              Build stunning websites
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                in minutes with AI
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto mb-8">
              Choose a template, customize with AI, and deploy instantly. No coding required.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <button className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-purple-600/30 hover:shadow-purple-600/50 hover:scale-105">
                Get Started Free
              </button>
              <button className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-all duration-200 backdrop-blur-sm border border-white/10">
                Watch Demo
              </button>
            </div>
          </div>

          {/* Builder Selector */}
          <div className="mb-16">
            <BuilderSelector
              onCategorySelect={(categoryId) => {
                setSelectedCategory(categoryId);
                console.log('Category selected:', categoryId);
              }}
              onAddReference={() => {
                setShowReferenceModal(true);
                console.log('Add reference clicked');
              }}
              onImportFigma={() => {
                setShowFigmaModal(true);
                console.log('Import Figma clicked');
              }}
            />
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 hover:border-purple-500/50 transition-all duration-200 group"
                >
                  <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-colors">
                    <Icon className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400">{feature.description}</p>
                </div>
              );
            })}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 bg-[#1a1a1a] border border-gray-800 rounded-xl p-8">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-white mb-2">
                10K+
              </div>
              <div className="text-gray-400">Websites Created</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-white mb-2">
                5K+
              </div>
              <div className="text-gray-400">Happy Users</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-white mb-2">
                99.9%
              </div>
              <div className="text-gray-400">Uptime</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-white mb-2">
                24/7
              </div>
              <div className="text-gray-400">Support</div>
            </div>
          </div>
        </div>
      </div>

      {/* Reference Modal */}
      {showReferenceModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-8 max-w-md w-full">
            <h3 className="text-2xl font-bold text-white mb-4">
              Add Website Reference
            </h3>
            <p className="text-gray-400 mb-6">
              Paste a URL to use as inspiration for your website design.
            </p>
            <input
              type="url"
              placeholder="https://example.com"
              className="w-full px-4 py-3 bg-[#2a2a2a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowReferenceModal(false)}
                className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
                Add Reference
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Figma Modal */}
      {showFigmaModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-8 max-w-md w-full">
            <h3 className="text-2xl font-bold text-white mb-4">
              Import from Figma
            </h3>
            <p className="text-gray-400 mb-6">
              Paste your Figma file URL to import your design.
            </p>
            <input
              type="url"
              placeholder="https://figma.com/file/..."
              className="w-full px-4 py-3 bg-[#2a2a2a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowFigmaModal(false)}
                className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
                Import Design
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
