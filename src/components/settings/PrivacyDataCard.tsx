'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, ShieldCheck, Trash2 } from 'lucide-react';

/**
 * Privacy & Data controls (GDPR self-serve): export your data, set a retention
 * window, and permanently delete your account. Backed by /api/account/*.
 */
export function PrivacyDataCard() {
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [savingRetention, setSavingRetention] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch('/api/account/retention')
      .then((r) => r.json())
      .then((d) => setRetentionDays(d.dataRetentionDays ?? null))
      .catch(() => {});
  }, []);

  const saveRetention = async (value: number | null) => {
    setSavingRetention(true);
    try {
      const res = await fetch('/api/account/retention', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataRetentionDays: value }),
      });
      const data = await res.json();
      if (res.ok) setRetentionDays(data.dataRetentionDays ?? null);
    } finally {
      setSavingRetention(false);
    }
  };

  const deleteAccount = async () => {
    if (
      !confirm(
        'Permanently delete your account and ALL your data? This cannot be undone.'
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      });
      if (res.ok) {
        window.location.href = '/';
      } else {
        setDeleting(false);
        alert('Could not delete account. Please try again.');
      }
    } catch {
      setDeleting(false);
    }
  };

  const retentionOptions: Array<{ label: string; value: number | null }> = [
    { label: 'Keep forever', value: null },
    { label: '30 days', value: 30 },
    { label: '90 days', value: 90 },
    { label: '1 year', value: 365 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" />
          Privacy &amp; Data
        </CardTitle>
        <CardDescription>
          Export your data, control how long it&apos;s kept, or delete your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Export */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">Export my data</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Download a JSON copy of your profile, conversations, and activity.
            </p>
          </div>
          <a
            href="/api/account/export"
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Export
          </a>
        </div>

        {/* Retention */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="font-medium text-gray-900 dark:text-white">Auto-delete old conversations</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Conversations older than this are automatically deleted.
          </p>
          <div className="flex flex-wrap gap-2">
            {retentionOptions.map((opt) => {
              const active = retentionDays === opt.value;
              return (
                <button
                  key={opt.label}
                  disabled={savingRetention}
                  onClick={() => saveRetention(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Delete */}
        <div className="pt-4 border-t border-red-200 dark:border-red-900/40">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-red-700 dark:text-red-400">Delete account</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Permanently remove your account and all associated data.
              </p>
            </div>
            <button
              onClick={deleteAccount}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
