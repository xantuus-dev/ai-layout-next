'use client';

import { Sparkles, FileText, Lightbulb, ListChecks, RefreshCw } from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
}

const quickActions: QuickAction[] = [
  {
    id: 'refine',
    label: 'Refine this',
    icon: <Sparkles className="w-3.5 h-3.5" />,
    prompt: 'Please refine and improve your previous response.',
  },
  {
    id: 'details',
    label: 'Add more details',
    icon: <FileText className="w-3.5 h-3.5" />,
    prompt: 'Please add more details and expand on your previous response.',
  },
  {
    id: 'simplify',
    label: 'Make it simpler',
    icon: <Lightbulb className="w-3.5 h-3.5" />,
    prompt: 'Please simplify your previous response and make it easier to understand.',
  },
  {
    id: 'summarize',
    label: 'Summarize',
    icon: <ListChecks className="w-3.5 h-3.5" />,
    prompt: 'Please create a concise summary of your previous response.',
  },
  {
    id: 'different',
    label: 'Try different approach',
    icon: <RefreshCw className="w-3.5 h-3.5" />,
    prompt: 'Please try a different approach to answering this question.',
  },
];

interface InlineQuickActionButtonsProps {
  onSelectAction: (prompt: string) => void;
  isLoading?: boolean;
}

export function InlineQuickActionButtons({ onSelectAction, isLoading }: InlineQuickActionButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
      <div className="text-xs text-gray-500 dark:text-gray-400 w-full mb-1">
        Quick actions:
      </div>
      {quickActions.map((action) => (
        <button
          key={action.id}
          onClick={() => onSelectAction(action.prompt)}
          disabled={isLoading}
          className={`
            inline-flex items-center gap-1.5 px-3 py-1.5
            rounded-lg text-xs font-medium
            transition-all duration-200
            ${
              isLoading
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 hover:shadow-sm active:scale-95'
            }
          `}
          title={action.prompt}
        >
          {action.icon}
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}
