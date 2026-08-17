'use client';

import { Check, Loader2, RotateCcw, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DocumentPhaseName = 'research' | 'drafting' | 'data_chart' | 'images' | 'qa' | 'assembly';

interface PhaseLogEntry {
  phase: DocumentPhaseName;
  status: 'running' | 'completed' | 'failed' | 'skipped';
  revisionOf?: DocumentPhaseName;
  error?: string;
}

const PHASE_ORDER: { key: DocumentPhaseName; label: string }[] = [
  { key: 'research', label: 'Researching' },
  { key: 'drafting', label: 'Drafting' },
  { key: 'data_chart', label: 'Charts & Data' },
  { key: 'images', label: 'Images' },
  { key: 'qa', label: 'Review' },
  { key: 'assembly', label: 'Assembling' },
];

export function PhaseProgress({
  currentPhase,
  phaseLog,
  taskStatus,
}: {
  currentPhase: DocumentPhaseName | null;
  phaseLog: PhaseLogEntry[];
  taskStatus: string;
}) {
  const currentIndex = currentPhase ? PHASE_ORDER.findIndex((p) => p.key === currentPhase) : -1;
  const revisionCount = phaseLog.filter((e) => e.revisionOf).length;

  const stateFor = (index: number): 'done' | 'active' | 'pending' | 'failed' => {
    if (taskStatus === 'failed' && index === currentIndex) return 'failed';
    if (index < currentIndex) return 'done';
    if (index === currentIndex) return taskStatus === 'completed' ? 'done' : 'active';
    return 'pending';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {PHASE_ORDER.map((phase, i) => {
          const state = stateFor(i);
          return (
            <div key={phase.key} className="flex items-center gap-2">
              <div
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium',
                  state === 'done' && 'border-teal-600 bg-teal-50 text-teal-800 dark:border-teal-500 dark:bg-teal-950/40 dark:text-teal-200',
                  state === 'active' && 'border-blue-600 bg-blue-50 text-blue-800 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-200',
                  state === 'failed' && 'border-red-600 bg-red-50 text-red-800 dark:border-red-500 dark:bg-red-950/40 dark:text-red-200',
                  state === 'pending' && 'border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-600'
                )}
              >
                {state === 'done' && <Check className="h-3.5 w-3.5" />}
                {state === 'active' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {state === 'failed' && <XCircle className="h-3.5 w-3.5" />}
                {phase.label}
              </div>
              {i < PHASE_ORDER.length - 1 && <div className="h-px w-4 bg-gray-200 dark:bg-gray-800" />}
            </div>
          );
        })}
      </div>

      {revisionCount > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <RotateCcw className="h-3.5 w-3.5 flex-shrink-0" />
          Review found an issue and sent the pipeline back to revise{' '}
          {revisionCount === 1 ? 'once' : `${revisionCount} times`} before continuing.
        </div>
      )}

      {phaseLog.length > 0 && (
        <ul className="space-y-1.5 text-xs text-gray-500 dark:text-gray-500">
          {phaseLog.map((entry, i) => (
            <li key={i} className="flex items-center gap-2">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  entry.status === 'completed' && 'bg-teal-500',
                  entry.status === 'failed' && 'bg-red-500',
                  entry.status === 'running' && 'bg-blue-500'
                )}
              />
              {PHASE_ORDER.find((p) => p.key === entry.phase)?.label || entry.phase}
              {entry.revisionOf && <span className="text-amber-600 dark:text-amber-400">(revision)</span>}
              {entry.error && <span className="text-red-500">— {entry.error}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
