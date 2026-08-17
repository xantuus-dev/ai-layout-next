'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect, useRouter } from 'next/navigation';
import { Sparkles, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FormatPicker, type DocumentFormat } from '@/components/documents/FormatPicker';
import { cn } from '@/lib/utils';

const THEMES: { value: 'default' | 'investor' | 'minimal'; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'investor', label: 'Investor' },
  { value: 'minimal', label: 'Minimal' },
];

export default function NewDocumentPage() {
  const { status } = useSession();
  const router = useRouter();

  const [goal, setGoal] = useState('');
  const [formats, setFormats] = useState<DocumentFormat[]>(['pdf']);
  const [theme, setTheme] = useState<'default' | 'investor' | 'minimal'>('default');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'unauthenticated') {
    redirect('/api/auth/signin');
  }
  if (status === 'loading') {
    return null;
  }

  const canSubmit = goal.trim().length >= 10 && formats.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/documents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goal.trim(), formats, theme }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to start document generation');
        setSubmitting(false);
        return;
      }

      router.push(`/documents/${data.taskId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start document generation');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Document Studio</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Describe what you need — a multi-agent pipeline researches, drafts, charts, and
            assembles a professional Word, PDF, PowerPoint, or Excel document in minutes.
          </p>
        </div>

        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle>Generate a document</CardTitle>
            <CardDescription>Be specific — mention what data, charts, or comparisons you want included.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="goal">What do you need?</Label>
              <Textarea
                id="goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Create an investor report on our Q3 performance, including a revenue chart and a quarterly comparison table."
                rows={5}
                className="resize-none"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">{goal.trim().length}/4000 characters</p>
            </div>

            <div className="space-y-2">
              <Label>Output formats</Label>
              <FormatPicker value={formats} onChange={setFormats} />
            </div>

            <div className="space-y-2">
              <Label>Theme</Label>
              <div className="flex gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTheme(t.value)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                      theme === t.value
                        ? 'border-teal-600 bg-teal-50 text-teal-900 dark:border-teal-500 dark:bg-teal-950/40 dark:text-teal-100'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full" size="lg">
              <Sparkles className="mr-2 h-4 w-4" />
              {submitting ? 'Starting…' : 'Generate'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
