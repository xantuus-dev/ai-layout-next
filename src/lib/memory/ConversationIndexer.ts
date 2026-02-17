/**
 * ConversationIndexer - Phase 2
 *
 * Automatically indexes conversations when they end or reach a certain size.
 * Integrates with MemoryService to create searchable memory from conversations.
 *
 * Features:
 * - Auto-index on session end
 * - Configurable minimum message threshold
 * - Duplicate detection (skip already indexed sessions)
 * - Format conversations as markdown for better retrieval
 * - Track indexing status and statistics
 *
 * @author Xantuus AI Team
 * @date 2026-02-17
 */

import { Pool } from 'pg';
import { MemoryService } from './MemoryService';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

export interface ConversationSession {
  sessionId: string;
  userId: number;
  messages: Message[];
  startedAt?: Date;
  endedAt?: Date;
  metadata?: Record<string, any>;
}

export interface IndexingOptions {
  source?: 'session' | 'conversation';
  consolidate?: boolean;
  forceReindex?: boolean;
}

export interface IndexingResult {
  sessionId: string;
  fileId: number;
  filePath: string;
  messageCount: number;
  chunksCreated: number;
  alreadyIndexed: boolean;
  consolidationTriggered: boolean;
}

export interface IndexingConfig {
  autoIndexEnabled: boolean;
  minMessagesToIndex: number;
  indexOnSessionEnd: boolean;
  consolidateOnIndex: boolean;
  consolidationIntervalHours: number;
  lastConsolidationAt?: Date;
}

// ============================================================================
// ConversationIndexer Class
// ============================================================================

export class ConversationIndexer {
  private db: Pool;
  private memoryService: MemoryService;

  constructor(db: Pool, memoryService: MemoryService) {
    this.db = db;
    this.memoryService = memoryService;
  }

  // ==========================================================================
  // Public API Methods
  // ==========================================================================

  /**
   * Initialize indexing configuration for a user
   */
  async initializeUserConfig(
    userId: number,
    config?: Partial<IndexingConfig>
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO user_indexing_config (
        user_id,
        auto_index_enabled,
        min_messages_to_index,
        index_on_session_end,
        consolidate_on_index,
        consolidation_interval_hours
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id) DO UPDATE SET
        auto_index_enabled = EXCLUDED.auto_index_enabled,
        min_messages_to_index = EXCLUDED.min_messages_to_index,
        index_on_session_end = EXCLUDED.index_on_session_end,
        consolidate_on_index = EXCLUDED.consolidate_on_index,
        consolidation_interval_hours = EXCLUDED.consolidation_interval_hours`,
      [
        userId,
        config?.autoIndexEnabled ?? true,
        config?.minMessagesToIndex ?? 5,
        config?.indexOnSessionEnd ?? true,
        config?.consolidateOnIndex ?? true,
        config?.consolidationIntervalHours ?? 6,
      ]
    );

    console.log(`[ConversationIndexer] Initialized config for user ${userId}`);
  }

  /**
   * Get user's indexing configuration
   */
  async getUserConfig(userId: number): Promise<IndexingConfig> {
    const result = await this.db.query(
      `SELECT * FROM user_indexing_config WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Create default config
      await this.initializeUserConfig(userId);
      return this.getUserConfig(userId);
    }

    const row = result.rows[0];
    return {
      autoIndexEnabled: row.auto_index_enabled,
      minMessagesToIndex: row.min_messages_to_index,
      indexOnSessionEnd: row.index_on_session_end,
      consolidateOnIndex: row.consolidate_on_index,
      consolidationIntervalHours: row.consolidation_interval_hours,
      lastConsolidationAt: row.last_consolidation_at,
    };
  }

  /**
   * Index a conversation session
   *
   * @param session - Conversation session to index
   * @param options - Indexing options
   */
  async indexConversation(
    session: ConversationSession,
    options: IndexingOptions = {}
  ): Promise<IndexingResult> {
    const { sessionId, userId, messages } = session;
    const startTime = Date.now();

    // Get user config
    const config = await this.getUserConfig(userId);

    // Check if auto-indexing is enabled
    if (!config.autoIndexEnabled && !options.forceReindex) {
      console.log(`[ConversationIndexer] Auto-indexing disabled for user ${userId}`);
      return {
        sessionId,
        fileId: -1,
        filePath: '',
        messageCount: messages.length,
        chunksCreated: 0,
        alreadyIndexed: false,
        consolidationTriggered: false,
      };
    }

    // Check minimum message threshold
    if (messages.length < config.minMessagesToIndex && !options.forceReindex) {
      console.log(
        `[ConversationIndexer] Session ${sessionId} has ${messages.length} messages (min: ${config.minMessagesToIndex})`
      );
      return {
        sessionId,
        fileId: -1,
        filePath: '',
        messageCount: messages.length,
        chunksCreated: 0,
        alreadyIndexed: false,
        consolidationTriggered: false,
      };
    }

    // Check if already indexed
    const alreadyIndexed = await this.isSessionIndexed(userId, sessionId);
    if (alreadyIndexed && !options.forceReindex) {
      console.log(`[ConversationIndexer] Session ${sessionId} already indexed`);
      return {
        sessionId,
        fileId: -1,
        filePath: '',
        messageCount: messages.length,
        chunksCreated: 0,
        alreadyIndexed: true,
        consolidationTriggered: false,
      };
    }

    // Format conversation as markdown
    const conversationText = this.formatConversationAsMarkdown(session);

    // Determine file path
    const filePath = this.generateFilePath(sessionId, session.endedAt);

    // Index the conversation
    const { chunksCreated, fileId } = await this.memoryService.indexMemoryContent(
      userId,
      filePath,
      conversationText,
      options.source || 'conversation'
    );

    // Record indexing in database
    await this.recordIndexedSession(userId, sessionId, fileId, messages.length);

    const duration = Date.now() - startTime;
    console.log(
      `[ConversationIndexer] Indexed session ${sessionId}: ${chunksCreated} chunks (${duration}ms)`
    );

    // Trigger consolidation if configured
    let consolidationTriggered = false;
    if (config.consolidateOnIndex || options.consolidate) {
      consolidationTriggered = await this.shouldTriggerConsolidation(userId, config);
      if (consolidationTriggered) {
        console.log(`[ConversationIndexer] Consolidation triggered for user ${userId}`);
        // Note: Actual consolidation will be handled by MemoryConsolidator
      }
    }

    return {
      sessionId,
      fileId,
      filePath,
      messageCount: messages.length,
      chunksCreated,
      alreadyIndexed: false,
      consolidationTriggered,
    };
  }

  /**
   * Batch index multiple conversations
   */
  async batchIndexConversations(
    sessions: ConversationSession[],
    options: IndexingOptions = {}
  ): Promise<IndexingResult[]> {
    const results: IndexingResult[] = [];

    for (const session of sessions) {
      try {
        const result = await this.indexConversation(session, options);
        results.push(result);

        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(
          `[ConversationIndexer] Error indexing session ${session.sessionId}:`,
          error
        );
        // Continue with other sessions
      }
    }

    return results;
  }

  /**
   * Check if a session has been indexed
   */
  async isSessionIndexed(userId: number, sessionId: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT id FROM indexed_sessions
       WHERE user_id = $1 AND session_id = $2`,
      [userId, sessionId]
    );

    return result.rows.length > 0;
  }

  /**
   * Get indexing statistics for a user
   */
  async getIndexingStats(userId: number): Promise<{
    totalSessions: number;
    totalMessages: number;
    totalFacts: number;
    lastIndexedAt?: Date;
  }> {
    const result = await this.db.query(
      `SELECT
        COUNT(*) as total_sessions,
        SUM(message_count) as total_messages,
        SUM(facts_extracted) as total_facts,
        MAX(indexed_at) as last_indexed_at
       FROM indexed_sessions
       WHERE user_id = $1`,
      [userId]
    );

    const row = result.rows[0];
    return {
      totalSessions: parseInt(row.total_sessions) || 0,
      totalMessages: parseInt(row.total_messages) || 0,
      totalFacts: parseInt(row.total_facts) || 0,
      lastIndexedAt: row.last_indexed_at,
    };
  }

  /**
   * Get list of indexed sessions for a user
   */
  async getIndexedSessions(
    userId: number,
    limit: number = 50
  ): Promise<Array<{
    sessionId: string;
    messageCount: number;
    indexedAt: Date;
    consolidationStatus: string;
    factsExtracted: number;
  }>> {
    const result = await this.db.query(
      `SELECT
        session_id,
        message_count,
        indexed_at,
        consolidation_status,
        facts_extracted
       FROM indexed_sessions
       WHERE user_id = $1
       ORDER BY indexed_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map(row => ({
      sessionId: row.session_id,
      messageCount: row.message_count,
      indexedAt: row.indexed_at,
      consolidationStatus: row.consolidation_status,
      factsExtracted: row.facts_extracted,
    }));
  }

  /**
   * Delete indexed session (also deletes the memory file)
   */
  async deleteIndexedSession(userId: number, sessionId: string): Promise<void> {
    // Get file ID
    const result = await this.db.query(
      `SELECT file_id FROM indexed_sessions
       WHERE user_id = $1 AND session_id = $2`,
      [userId, sessionId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const fileId = result.rows[0].file_id;

    // Delete the memory file (cascades to chunks)
    const filePath = await this.getFilePathForSession(userId, sessionId);
    if (filePath) {
      await this.memoryService.deleteMemoryFile(userId, filePath);
    }

    // Delete the indexed session record
    await this.db.query(
      `DELETE FROM indexed_sessions WHERE user_id = $1 AND session_id = $2`,
      [userId, sessionId]
    );

    console.log(`[ConversationIndexer] Deleted session ${sessionId} for user ${userId}`);
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Format conversation as markdown for better retrieval
   */
  private formatConversationAsMarkdown(session: ConversationSession): string {
    const { sessionId, messages, startedAt, endedAt, metadata } = session;

    const lines: string[] = [];

    // Header
    lines.push(`# Conversation - ${sessionId}`);
    lines.push('');

    // Metadata
    if (startedAt) {
      lines.push(`**Started**: ${startedAt.toISOString()}`);
    }
    if (endedAt) {
      lines.push(`**Ended**: ${endedAt.toISOString()}`);
    }
    if (metadata) {
      lines.push(`**Metadata**: ${JSON.stringify(metadata)}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    // Messages
    messages.forEach((msg, idx) => {
      const timestamp = msg.timestamp ? ` (${msg.timestamp.toISOString()})` : '';
      const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);

      lines.push(`## Message ${idx + 1} - ${role}${timestamp}`);
      lines.push('');
      lines.push(msg.content);
      lines.push('');

      if (msg.metadata) {
        lines.push(`*Metadata: ${JSON.stringify(msg.metadata)}*`);
        lines.push('');
      }
    });

    // Summary
    lines.push('---');
    lines.push('');
    lines.push(`**Total Messages**: ${messages.length}`);

    return lines.join('\n');
  }

  /**
   * Generate file path for a conversation
   */
  private generateFilePath(sessionId: string, endedAt?: Date): string {
    const date = endedAt || new Date();
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

    // Store in conversations directory organized by date
    return `conversations/${dateStr}/${sessionId}.md`;
  }

  /**
   * Record indexed session in database
   */
  private async recordIndexedSession(
    userId: number,
    sessionId: string,
    fileId: number,
    messageCount: number
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO indexed_sessions (
        user_id, session_id, message_count, file_id, consolidation_status
      ) VALUES ($1, $2, $3, $4, 'pending')
      ON CONFLICT (user_id, session_id) DO UPDATE SET
        message_count = EXCLUDED.message_count,
        file_id = EXCLUDED.file_id,
        indexed_at = NOW()`,
      [userId, sessionId, messageCount, fileId]
    );
  }

  /**
   * Check if consolidation should be triggered
   */
  private async shouldTriggerConsolidation(
    userId: number,
    config: IndexingConfig
  ): Promise<boolean> {
    if (!config.consolidateOnIndex) {
      return false;
    }

    if (!config.lastConsolidationAt) {
      // Never consolidated before - trigger now
      return true;
    }

    const hoursSinceLastConsolidation =
      (Date.now() - config.lastConsolidationAt.getTime()) / (1000 * 60 * 60);

    return hoursSinceLastConsolidation >= config.consolidationIntervalHours;
  }

  /**
   * Get file path for an indexed session
   */
  private async getFilePathForSession(
    userId: number,
    sessionId: string
  ): Promise<string | null> {
    const result = await this.db.query(
      `SELECT mf.file_path
       FROM indexed_sessions is
       JOIN memory_files mf ON is.file_id = mf.id
       WHERE is.user_id = $1 AND is.session_id = $2`,
      [userId, sessionId]
    );

    return result.rows.length > 0 ? result.rows[0].file_path : null;
  }
}
