'use client';

import { FileText, Presentation, Sheet, File } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DocumentFormat = 'docx' | 'pdf' | 'pptx' | 'xlsx';

const FORMATS: { value: DocumentFormat; label: string; icon: React.ElementType }[] = [
  { value: 'docx', label: 'Word', icon: FileText },
  { value: 'pdf', label: 'PDF', icon: File },
  { value: 'pptx', label: 'PowerPoint', icon: Presentation },
  { value: 'xlsx', label: 'Excel', icon: Sheet },
];

export function FormatPicker({
  value,
  onChange,
}: {
  value: DocumentFormat[];
  onChange: (formats: DocumentFormat[]) => void;
}) {
  const toggle = (format: DocumentFormat) => {
    onChange(value.includes(format) ? value.filter((f) => f !== format) : [...value, format]);
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {FORMATS.map(({ value: format, label, icon: Icon }) => {
        const selected = value.includes(format);
        return (
          <button
            key={format}
            type="button"
            onClick={() => toggle(format)}
            aria-pressed={selected}
            className={cn(
              'flex items-center gap-2.5 rounded-lg border px-4 py-3 text-sm font-medium transition-colors',
              selected
                ? 'border-teal-600 bg-teal-50 text-teal-900 dark:border-teal-500 dark:bg-teal-950/40 dark:text-teal-100'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-700'
            )}
          >
            <Icon className={cn('h-4 w-4', selected ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400')} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
