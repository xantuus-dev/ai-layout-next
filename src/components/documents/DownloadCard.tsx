'use client';

import { Download, FileText, Presentation, Sheet, File } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const FORMAT_META: Record<string, { label: string; icon: React.ElementType }> = {
  docx: { label: 'Word Document', icon: FileText },
  pdf: { label: 'PDF', icon: File },
  pptx: { label: 'PowerPoint', icon: Presentation },
  xlsx: { label: 'Excel Spreadsheet', icon: Sheet },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DownloadCard({
  format,
  url,
  filename,
  bytes,
}: {
  format: string;
  url: string;
  filename: string;
  bytes: number;
}) {
  const meta = FORMAT_META[format] || { label: format.toUpperCase(), icon: File };
  const Icon = meta.icon;

  return (
    <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/40">
          <Icon className="h-5 w-5 text-teal-600 dark:text-teal-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{filename}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {meta.label} · {formatBytes(bytes)}
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <a href={url} download={filename} target="_blank" rel="noopener noreferrer">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
