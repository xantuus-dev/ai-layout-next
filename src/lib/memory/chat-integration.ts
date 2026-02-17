/**
 * Memory System - Chat Integration Helpers
 *
 * Functions to integrate memory search and auto-indexing into chat
 */

import { getMemoryService, getConversationIndexer, initializeUserMemory } from './client';

/**
 * Search memory for relevant context before chat
 */
export async function getMemoryContext(
  userId: string,
  userMessage: string,
  options: {
    maxResults?: number;
    minScore?: number;
  } = {}
): Promise<string | null> {
  try {
    // Convert string userId to number for memory system
    const userIdNum = parseInt(userId.replace(/\D/g, '').slice(0, 9)) || 1;

    const memoryService = getMemoryService();

    // Initialize user memory if not already done
    try {
      await initializeUserMemory(userId);
    } catch (error) {
      // Ignore if already initialized
    }

    // Search memory
    const results = await memoryService.searchMemory(userIdNum, userMessage, {
      maxResults: options.maxResults || 3,
      minScore: options.minScore || 0.4,
    });

    if (results.length === 0) {
      return null;
    }

    // Format memory context for AI
    const contextParts = ['**Relevant Context from Memory:**\n'];

    results.forEach((result, idx) => {
      contextParts.push(`${idx + 1}. ${result.snippet.substring(0, 200)}...`);
      contextParts.push(`   Source: ${result.citation}\n`);
    });

    return contextParts.join('\n');

  } catch (error) {
    console.error('Error getting memory context:', error);
    return null;
  }
}

/**
 * Index a chat message into memory
 */
export async function indexChatMessage(
  userId: string,
  sessionId: string,
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: Date;
  }>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Only index if we have at least 3 messages (conversation started)
    if (messages.length < 3) {
      return { success: false, error: 'Not enough messages to index' };
    }

    // Convert string userId to number for memory system
    const userIdNum = parseInt(userId.replace(/\D/g, '').slice(0, 9)) || 1;

    const conversationIndexer = getConversationIndexer();

    // Index conversation
    await conversationIndexer.indexConversation({
      sessionId,
      userId: userIdNum,
      messages: messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp || new Date(),
      })),
      endedAt: new Date(),
      metadata: {
        indexed_at: new Date().toISOString(),
        message_count: messages.length,
      },
    });

    return { success: true };

  } catch (error) {
    console.error('Error indexing chat message:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Enhanced chat handler with memory integration
 *
 * This can be used to wrap the existing chat functionality
 */
export async function enhanceChatWithMemory(params: {
  userId: string;
  userMessage: string;
  sessionId: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: Date;
  }>;
  enableMemorySearch?: boolean;
  enableAutoIndex?: boolean;
}): Promise<{
  memoryContext: string | null;
  shouldIndex: boolean;
}> {
  const {
    userId,
    userMessage,
    sessionId,
    conversationHistory = [],
    enableMemorySearch = true,
    enableAutoIndex = true,
  } = params;

  let memoryContext: string | null = null;

  // 1. Search memory for context (before AI call)
  if (enableMemorySearch) {
    memoryContext = await getMemoryContext(userId, userMessage);
  }

  // 2. Determine if we should index after response
  const shouldIndex = enableAutoIndex && conversationHistory.length >= 2;

  return {
    memoryContext,
    shouldIndex,
  };
}
