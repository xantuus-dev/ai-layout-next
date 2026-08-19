'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, Trash2, Lock } from 'lucide-react';
import { format } from 'date-fns';

interface MemoryFact {
  id: string;
  factType: string;
  content: string;
  importanceScore: number;
  createdAt: string;
  lastAccessed: string;
}

export default function MemorySettingsPage() {
  const { data: session } = useSession();
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const plan = (session?.user?.plan || 'free').toLowerCase();
  const isProOrHigher = plan === 'pro' || plan === 'enterprise';

  useEffect(() => {
    if (!session || !isProOrHigher) {
      setIsLoading(false);
      return;
    }

    const fetchFacts = async () => {
      try {
        const response = await fetch('/api/memory/facts');
        const data = await response.json();
        setFacts(data.facts || []);
      } catch (error) {
        console.error('Error fetching memory facts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFacts();
  }, [session, isProOrHigher]);

  const handleDelete = async (factId: string) => {
    try {
      await fetch(`/api/memory/facts?id=${factId}`, { method: 'DELETE' });
      setFacts((prev) => prev.filter((f) => f.id !== factId));
    } catch (error) {
      console.error('Error deleting memory fact:', error);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Delete everything Xantuus has remembered about you? This cannot be undone.')) {
      return;
    }
    try {
      await fetch('/api/memory/facts?all=true', { method: 'DELETE' });
      setFacts([]);
    } catch (error) {
      console.error('Error clearing memory:', error);
    }
  };

  if (!session) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-gray-600 dark:text-gray-400">
            Please sign in to manage your memory.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!isProOrHigher) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Lock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Memory is a Pro feature
          </h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-4">
            Upgrade to Pro or Enterprise so the assistant remembers your preferences, decisions,
            and context across conversations.
          </p>
          <a
            href="/pricing"
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            View plans
          </a>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Memory</CardTitle>
              <CardDescription>
                What the assistant has learned about you from past conversations
              </CardDescription>
            </div>
            {facts.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Clear all
              </button>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-4">
        {isLoading ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-gray-600 dark:text-gray-400">Loading...</p>
            </CardContent>
          </Card>
        ) : facts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Brain className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">
                Nothing remembered yet. As you chat, the assistant learns durable facts —
                preferences, goals, decisions — and shows them here.
              </p>
            </CardContent>
          </Card>
        ) : (
          facts.map((fact) => (
            <Card key={fact.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <span className="inline-block text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-1">
                      {fact.factType}
                    </span>
                    <p className="text-gray-900 dark:text-white">{fact.content}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      Learned {format(new Date(fact.createdAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(fact.id)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
