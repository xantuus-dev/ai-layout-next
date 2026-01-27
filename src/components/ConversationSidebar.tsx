'use client';

import { useState, useEffect } from 'react';
import {
  MessageSquare,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Search,
  Clock,
  Archive,
  Star
} from 'lucide-react';

interface Conversation {
  id: string;
  title: string;
  lastMessageAt: string;
  messageCount: number;
  model?: string;
  isFavorite?: boolean;
  isArchived?: boolean;
}

interface ConversationSidebarProps {
  currentConversationId?: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (conversationId: string) => void;
}

export function ConversationSidebar({
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}: ConversationSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Load conversations from API
  useEffect(() => {
    loadConversations();
  }, [showArchived]);

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '50',
        offset: '0',
        sortBy: 'lastMessageAt',
        sortOrder: 'desc',
      });

      if (!showArchived) {
        params.append('isArchived', 'false');
      }

      const response = await fetch(`/api/workspace/conversations?${params}`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation?')) {
      return;
    }

    try {
      const response = await fetch(`/api/workspace/conversations/${conversationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onDeleteConversation(conversationId);
        loadConversations();
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const toggleFavorite = async (conversationId: string, isFavorite: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/workspace/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: !isFavorite }),
      });
      loadConversations();
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (isCollapsed) {
    return (
      <div className="w-12 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col items-center py-4 gap-2">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Expand sidebar"
        >
          <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
        <button
          onClick={onNewConversation}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="New conversation"
        >
          <Plus className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div className="flex-1" />
        <button
          onClick={loadConversations}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Refresh"
        >
          <MessageSquare className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Conversations
          </h2>
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Collapse sidebar"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* New Conversation Button */}
        <button
          onClick={onNewConversation}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span className="font-medium">New Chat</span>
        </button>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filter Toggles */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded text-xs transition-colors ${
              showArchived
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            <Archive className="h-3 w-3" />
            <span>Archived</span>
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            Loading...
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400 space-y-2">
            <MessageSquare className="h-8 w-8 mx-auto opacity-50" />
            <p className="text-sm">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`w-full text-left p-3 rounded-lg transition-all group ${
                  currentConversationId === conv.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1 flex-1">
                    {conv.title}
                  </h3>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => toggleFavorite(conv.id, conv.isFavorite || false, e)}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                      title={conv.isFavorite ? 'Unfavorite' : 'Favorite'}
                    >
                      <Star
                        className={`h-3 w-3 ${
                          conv.isFavorite
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-400'
                        }`}
                      />
                    </button>
                    <button
                      onClick={(e) => handleDelete(conv.id, e)}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3 text-gray-400 hover:text-red-600 dark:hover:text-red-400" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Clock className="h-3 w-3" />
                  <span>{formatDate(conv.lastMessageAt)}</span>
                  <span className="text-gray-400">•</span>
                  <span>{conv.messageCount} messages</span>
                  {conv.model && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="truncate">{conv.model}</span>
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
