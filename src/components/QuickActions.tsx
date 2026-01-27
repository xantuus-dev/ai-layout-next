'use client';

import { useState } from 'react';
import {
  Sparkles,
  FileText,
  Code,
  Lightbulb,
  Calendar,
  MessageSquare,
  Languages,
  Bug,
  BookOpen,
  PenTool,
  Zap,
  Search
} from 'lucide-react';

interface QuickAction {
  id: string;
  title: string;
  prompt: string;
  icon: React.ReactNode;
  category: 'common' | 'code' | 'creative' | 'productivity';
  color: string;
}

const quickActions: QuickAction[] = [
  // Common Tasks
  {
    id: 'summarize',
    title: 'Summarize Text',
    prompt: 'Please summarize the following text in a clear and concise way:',
    icon: <FileText className="h-5 w-5" />,
    category: 'common',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20'
  },
  {
    id: 'explain',
    title: 'Explain Simply',
    prompt: 'Please explain this concept in simple terms that anyone can understand:',
    icon: <MessageSquare className="h-5 w-5" />,
    category: 'common',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20'
  },
  {
    id: 'translate',
    title: 'Translate',
    prompt: 'Please translate the following text to [specify language]:',
    icon: <Languages className="h-5 w-5" />,
    category: 'common',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20'
  },

  // Code-related
  {
    id: 'debug',
    title: 'Debug Code',
    prompt: 'Please help me debug this code and identify any issues:',
    icon: <Bug className="h-5 w-5" />,
    category: 'code',
    color: 'bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20'
  },
  {
    id: 'review',
    title: 'Code Review',
    prompt: 'Please review this code for best practices, performance, and potential improvements:',
    icon: <Code className="h-5 w-5" />,
    category: 'code',
    color: 'bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20'
  },
  {
    id: 'document',
    title: 'Add Documentation',
    prompt: 'Please add comprehensive documentation and comments to this code:',
    icon: <BookOpen className="h-5 w-5" />,
    category: 'code',
    color: 'bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20'
  },

  // Creative Writing
  {
    id: 'brainstorm',
    title: 'Brainstorm Ideas',
    prompt: 'Please help me brainstorm creative ideas for:',
    icon: <Lightbulb className="h-5 w-5" />,
    category: 'creative',
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20'
  },
  {
    id: 'improve',
    title: 'Improve Writing',
    prompt: 'Please improve this text to make it more engaging and clear:',
    icon: <PenTool className="h-5 w-5" />,
    category: 'creative',
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20'
  },
  {
    id: 'rewrite',
    title: 'Rewrite Professionally',
    prompt: 'Please rewrite this in a professional and polished tone:',
    icon: <Sparkles className="h-5 w-5" />,
    category: 'creative',
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20'
  },

  // Productivity
  {
    id: 'plan',
    title: 'Create a Plan',
    prompt: 'Please help me create a detailed action plan for:',
    icon: <Calendar className="h-5 w-5" />,
    category: 'productivity',
    color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20'
  },
  {
    id: 'organize',
    title: 'Organize Information',
    prompt: 'Please organize and structure this information in a clear way:',
    icon: <Zap className="h-5 w-5" />,
    category: 'productivity',
    color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20'
  },
  {
    id: 'research',
    title: 'Research Topic',
    prompt: 'Please provide a comprehensive overview and key insights about:',
    icon: <Search className="h-5 w-5" />,
    category: 'productivity',
    color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20'
  },
];

const categoryInfo = {
  common: { name: 'Common Tasks', color: 'text-blue-600 dark:text-blue-400' },
  code: { name: 'Code & Development', color: 'text-green-600 dark:text-green-400' },
  creative: { name: 'Creative Writing', color: 'text-purple-600 dark:text-purple-400' },
  productivity: { name: 'Productivity', color: 'text-orange-600 dark:text-orange-400' },
};

interface QuickActionsProps {
  onSelectAction: (prompt: string) => void;
}

export function QuickActions({ onSelectAction }: QuickActionsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredActions = selectedCategory
    ? quickActions.filter(action => action.category === selectedCategory)
    : quickActions;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Quick Actions
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Get started quickly with these common prompts
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap justify-center gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedCategory === null
              ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          All
        </button>
        {Object.entries(categoryInfo).map(([key, info]) => (
          <button
            key={key}
            onClick={() => setSelectedCategory(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === key
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {info.name}
          </button>
        ))}
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredActions.map((action) => (
          <button
            key={action.id}
            onClick={() => onSelectAction(action.prompt)}
            className={`p-4 rounded-lg border border-gray-200 dark:border-gray-700 transition-all hover:shadow-md text-left ${action.color}`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-1">
                {action.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm mb-1">
                  {action.title}
                </h3>
                <p className="text-xs opacity-80 line-clamp-2">
                  {action.prompt}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Helper Text */}
      <div className="text-center text-sm text-gray-500 dark:text-gray-400">
        Click any action to start a conversation with that prompt
      </div>
    </div>
  );
}
