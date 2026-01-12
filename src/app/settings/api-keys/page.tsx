'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Copy, Eye, EyeOff, Key, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  lastUsed: string | null;
  createdAt: string;
}

export default function ApiKeysPage() {
  const { data: session } = useSession();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchApiKeys = async () => {
      try {
        const response = await fetch('/api/api-keys');
        const data = await response.json();
        setApiKeys(data.apiKeys || []);
      } catch (error) {
        console.error('Error fetching API keys:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (session) {
      fetchApiKeys();
    }
  }, [session]);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;

    setIsCreating(true);

    try {
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName }),
      });

      const data = await response.json();

      if (data.apiKey) {
        setApiKeys([...apiKeys, data.apiKey]);
        setNewKey(data.apiKey.key);
        setNewKeyName('');
      }
    } catch (error) {
      console.error('Error creating API key:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return;
    }

    try {
      await fetch(`/api/api-keys?id=${keyId}`, {
        method: 'DELETE',
      });

      setApiKeys(apiKeys.filter((key) => key.id !== keyId));
    } catch (error) {
      console.error('Error deleting API key:', error);
    }
  };

  const toggleKeyVisibility = (keyId: string) => {
    const newVisible = new Set(visibleKeys);
    if (newVisible.has(keyId)) {
      newVisible.delete(keyId);
    } else {
      newVisible.add(keyId);
    }
    setVisibleKeys(newVisible);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const maskKey = (key: string) => {
    return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
  };

  if (!session) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-gray-600 dark:text-gray-400">
            Please sign in to manage API keys.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Create and manage API keys for programmatic access
              </CardDescription>
            </div>
            <button
              onClick={() => setShowCreateDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Key
            </button>
          </div>
        </CardHeader>
      </Card>

      {/* API Keys List */}
      <div className="space-y-4">
        {isLoading ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-gray-600 dark:text-gray-400">
                Loading API keys...
              </p>
            </CardContent>
          </Card>
        ) : apiKeys.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Key className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">
                No API keys yet. Create one to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          apiKeys.map((apiKey) => (
            <Card key={apiKey.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {apiKey.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-2">
                      <code className="text-sm bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded">
                        {visibleKeys.has(apiKey.id) ? apiKey.key : maskKey(apiKey.key)}
                      </code>
                      <button
                        onClick={() => toggleKeyVisibility(apiKey.id)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      >
                        {visibleKeys.has(apiKey.id) ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => copyToClipboard(apiKey.key)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      Created {format(new Date(apiKey.createdAt), 'MMM d, yyyy')}
                      {apiKey.lastUsed && (
                        <> • Last used {format(new Date(apiKey.lastUsed), 'MMM d, yyyy')}</>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteKey(apiKey.id)}
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

      {/* Create Key Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              {newKey
                ? 'Save your API key now. You won\'t be able to see it again!'
                : 'Give your API key a descriptive name'}
            </DialogDescription>
          </DialogHeader>

          {newKey ? (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-sm text-green-800 dark:text-green-200 mb-2">
                  API key created successfully!
                </p>
                <code className="text-sm bg-white dark:bg-gray-800 px-3 py-2 rounded block break-all">
                  {newKey}
                </code>
              </div>
              <button
                onClick={() => {
                  copyToClipboard(newKey);
                }}
                className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy to Clipboard
              </button>
              <button
                onClick={() => {
                  setNewKey(null);
                  setShowCreateDialog(false);
                }}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="keyName">Key Name</Label>
                <Input
                  id="keyName"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., Production API Key"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateKey();
                    }
                  }}
                />
              </div>
              <button
                onClick={handleCreateKey}
                disabled={isCreating || !newKeyName.trim()}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? 'Creating...' : 'Create Key'}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
