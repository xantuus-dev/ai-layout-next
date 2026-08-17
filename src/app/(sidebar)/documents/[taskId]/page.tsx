'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PhaseProgress, type DocumentPhaseName } from '@/components/documents/PhaseProgress';
import { DownloadCard } from '@/components/documents/DownloadCard';

const POLL_INTERVAL_MS = 2500;
const IN_PROGRESS_STATUSES = new Set(['pending', 'planning', 'executing']);

interface StatusResponse {
  taskId: string;
  status: string;
  error?: string;
  documentPhase: DocumentPhaseName | null;
  documentSpec: {
    goal: string;
    title?: string;
    phaseLog: {
      phase: DocumentPhaseName;
      status: 'running' | 'completed' | 'failed' | 'skipped';
      revisionOf?: DocumentPhaseName;
      error?: string;
    }[];
    outputs: { format: string; url: string; filename: string; bytes: number }[];
    qaIssues?: { severity: string; message: string }[];
  } | null;
}

export default function DocumentTaskPage() {
  const { status: sessionStatus } = useSession();
  const params = useParams<{ taskId: string }>();
  const [data, setData] = useState<StatusResponse | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus !== 'authenticated') return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const res = await fetch(`/api/agent/status/${params.taskId}`);
        const json = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          setPollError(json.error || 'Failed to load status');
          return;
        }
        setPollError(null);
        setData(json);

        if (IN_PROGRESS_STATUSES.has(json.status)) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (e) {
        if (!cancelled) setPollError(e instanceof Error ? e.message : 'Failed to load status');
      }
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // params.taskId is stable for the life of this page; re-running the
    // effect on every poll's state change would restart the interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, params.taskId]);

  if (sessionStatus === 'unauthenticated') {
    redirect('/api/auth/signin');
  }
  if (sessionStatus === 'loading') {
    return null;
  }

  const spec = data?.documentSpec;
  const inProgress = data ? IN_PROGRESS_STATUSES.has(data.status) : true;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link
          href="/documents/new"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          New document
        </Link>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {spec?.title || spec?.goal || 'Generating document…'}
          </h1>
          {spec?.title && <p className="text-sm text-gray-500 dark:text-gray-400">{spec.goal}</p>}
        </div>

        {pollError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{pollError}</AlertDescription>
          </Alert>
        )}

        {data?.status === 'failed' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{data.error || 'Document generation failed.'}</AlertDescription>
          </Alert>
        )}

        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-base">
              {inProgress ? 'Generating…' : data?.status === 'completed' ? 'Complete' : 'Status'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PhaseProgress
              currentPhase={data?.documentPhase ?? null}
              phaseLog={spec?.phaseLog || []}
              taskStatus={data?.status || 'pending'}
            />
          </CardContent>
        </Card>

        {spec?.qaIssues && spec.qaIssues.length > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Review flagged {spec.qaIssues.length} item{spec.qaIssues.length === 1 ? '' : 's'} worth a look:{' '}
              {spec.qaIssues.map((i) => i.message).join(' ')}
            </AlertDescription>
          </Alert>
        )}

        {spec && spec.outputs.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Downloads</h2>
            {spec.outputs.map((output) => (
              <DownloadCard
                key={output.format}
                format={output.format}
                url={output.url}
                filename={output.filename}
                bytes={output.bytes}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
