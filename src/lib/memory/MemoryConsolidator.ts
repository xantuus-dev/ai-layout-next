/**
 * MemoryConsolidator - Phase 2
 *
 * Consolidates conversations into durable facts using LLM extraction.
 * Periodically processes indexed conversations and extracts important information.
 *
 * Features:
 * - Extract facts from indexed conversations
 * - Deduplicate similar facts across sessions
 * - Update MEMORY.md with consolidated facts
 * - Track consolidation jobs and statistics
 * - Intelligent fact merging and ranking
 *
 * @author Xantuus AI Team
 * @date 2026-02-17
 */

import { Pool, PoolClient } from 'pg';
import { MemoryService } from './MemoryService';
import { FactExtractor, ExtractedFact } from './FactExtractor';
import crypto from 'crypto';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ConsolidationOptions {
  userId: number;
  sessionIds?: string[];  // Specific sessions, or all pending if not provided
  updateMemoryFile?: boolean;  // Update MEMORY.md with facts
  minConfidence?: number;
  deduplicateFacts?: boolean;
}

export interface ConsolidationResult {
  jobId: number;
  factsExtracted: number;
  factsStored: number;
  factsMerged: number;
  chunksProcessed: number;
  totalChunks: number;
  duration: number;
  memoryFileUpdated: boolean;
}

export interface StoredFact {
  id: number;
  userId: number;
  type: string;
  content: string;
  confidenceScore: number;
  importanceScore: number;
  sourceFileId?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// MemoryConsolidator Class
// ============================================================================

export class MemoryConsolidator {
  private db: Pool;
  private memoryService: MemoryService;
  private factExtractor: FactExtractor;

  constructor(db: Pool, memoryService: MemoryService, factExtractor: FactExtractor) {
    this.db = db;
    this.memoryService = memoryService;
    this.factExtractor = factExtractor;
  }

  // ==========================================================================
  // Public API Methods
  // ==========================================================================

  /**
   * Consolidate conversations for a user
   *
   * @param options - Consolidation options
   */
  async consolidate(options: ConsolidationOptions): Promise<ConsolidationResult> {
    const startTime = Date.now();
    const { userId, sessionIds, updateMemoryFile = true, minConfidence = 0.6, deduplicateFacts = true } = options;

    // Create consolidation job
    const jobId = await this.createConsolidationJob(userId, sessionIds ? 'manual' : 'scheduled');

    try {
      await this.updateJobStatus(jobId, 'running');

      // Get sessions to consolidate
      const sessions = await this.getSessionsToConsolidate(userId, sessionIds);
      console.log(`[MemoryConsolidator] Consolidating ${sessions.length} sessions for user ${userId}`);

      if (sessions.length === 0) {
        await this.updateJobStatus(jobId, 'completed');
        return {
          jobId,
          factsExtracted: 0,
          factsStored: 0,
          factsMerged: 0,
          chunksProcessed: 0,
          totalChunks: 0,
          duration: Date.now() - startTime,
          memoryFileUpdated: false,
        };
      }

      // Extract facts from each session
      let totalFactsExtracted = 0;
      let totalChunksProcessed = 0;
      let totalChunks = 0;
      const allExtractedFacts: Array<ExtractedFact & { sessionId: string }> = [];

      for (const session of sessions) {
        try {
          const { facts, chunksProcessed } = await this.extractFactsFromSession(
            userId,
            session.session_id,
            session.file_id,
            minConfidence
          );

          allExtractedFacts.push(...facts.map(f => ({ ...f, sessionId: session.session_id })));
          totalFactsExtracted += facts.length;
          totalChunksProcessed += chunksProcessed;
          totalChunks += chunksProcessed;

          console.log(
            `[MemoryConsolidator] Session ${session.session_id}: ${facts.length} facts from ${chunksProcessed} chunks`
          );
        } catch (error) {
          console.error(
            `[MemoryConsolidator] Error processing session ${session.session_id}:`,
            error
          );
          // Continue with other sessions
        }
      }

      // Deduplicate facts
      let factsToStore = allExtractedFacts;
      let factsMerged = 0;

      if (deduplicateFacts) {
        const deduplicationResult = await this.deduplicateAgainstExisting(userId, allExtractedFacts);
        factsToStore = deduplicationResult.newFacts;
        factsMerged = deduplicationResult.mergedCount;

        console.log(
          `[MemoryConsolidator] Deduplication: ${allExtractedFacts.length} -> ${factsToStore.length} facts (${factsMerged} merged)`
        );
      }

      // Store facts
      const factsStored = await this.storeFacts(userId, factsToStore);

      // Update session consolidation status
      for (const session of sessions) {
        const sessionFacts = factsToStore.filter(f => f.sessionId === session.session_id).length;
        await this.updateSessionConsolidationStatus(userId, session.session_id, 'completed', sessionFacts);
      }

      // Update MEMORY.md if requested
      let memoryFileUpdated = false;
      if (updateMemoryFile && factsStored > 0) {
        await this.updateMemoryFile(userId);
        memoryFileUpdated = true;
      }

      // Update consolidation timestamp
      await this.updateLastConsolidationTime(userId);

      // Complete job
      await this.completeJob(jobId, totalFactsExtracted, totalChunksProcessed, totalChunks);

      const duration = Date.now() - startTime;
      console.log(
        `[MemoryConsolidator] Consolidation complete: ${factsStored} facts stored (${duration}ms)`
      );

      return {
        jobId,
        factsExtracted: totalFactsExtracted,
        factsStored,
        factsMerged,
        chunksProcessed: totalChunksProcessed,
        totalChunks,
        duration,
        memoryFileUpdated,
      };
    } catch (error) {
      console.error('[MemoryConsolidator] Consolidation error:', error);
      await this.failJob(jobId, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Get all stored facts for a user
   */
  async getFacts(
    userId: number,
    options: { type?: string; limit?: number; minImportance?: number } = {}
  ): Promise<StoredFact[]> {
    const { type, limit = 100, minImportance = 0.0 } = options;

    let query = `
      SELECT id, user_id, fact_type, content, confidence_score, importance_score,
             source_file_id, created_at, updated_at
      FROM memory_facts
      WHERE user_id = $1 AND importance_score >= $2
    `;
    const params: any[] = [userId, minImportance];

    if (type) {
      query += ` AND fact_type = $3`;
      params.push(type);
    }

    query += ` ORDER BY importance_score DESC, created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await this.db.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      type: row.fact_type,
      content: row.content,
      confidenceScore: row.confidence_score,
      importanceScore: row.importance_score,
      sourceFileId: row.source_file_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Search facts semantically
   */
  async searchFacts(
    userId: number,
    query: string,
    options: { limit?: number; minScore?: number } = {}
  ): Promise<Array<StoredFact & { score: number }>> {
    const { limit = 10, minScore = 0.5 } = options;

    // Generate query embedding
    const embedding = await (this.memoryService as any).getEmbedding(query);

    // Search facts using vector similarity
    const result = await this.db.query(
      `SELECT
        id, user_id, fact_type, content, confidence_score, importance_score,
        source_file_id, created_at, updated_at,
        (1 - (embedding <=> $1::vector)) as score
       FROM memory_facts
       WHERE user_id = $2
         AND embedding IS NOT NULL
         AND (1 - (embedding <=> $1::vector)) >= $3
       ORDER BY embedding <=> $1::vector
       LIMIT $4`,
      [`[${embedding.join(',')}]`, userId, minScore, limit]
    );

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      type: row.fact_type,
      content: row.content,
      confidenceScore: row.confidence_score,
      importanceScore: row.importance_score,
      sourceFileId: row.source_file_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      score: row.score,
    }));
  }

  /**
   * Delete a fact
   */
  async deleteFact(userId: number, factId: number): Promise<void> {
    await this.db.query(
      `DELETE FROM memory_facts WHERE id = $1 AND user_id = $2`,
      [factId, userId]
    );
  }

  /**
   * Update fact importance scores for a user
   */
  async updateImportanceScores(userId: number): Promise<number> {
    const result = await this.db.query(
      `UPDATE memory_facts
       SET importance_score = calculate_fact_importance(
         confidence_score,
         0,
         EXTRACT(DAY FROM NOW() - created_at)::INTEGER
       )
       WHERE user_id = $1`,
      [userId]
    );

    return result.rowCount || 0;
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Extract facts from a single session
   */
  private async extractFactsFromSession(
    userId: number,
    sessionId: string,
    fileId: number,
    minConfidence: number
  ): Promise<{ facts: ExtractedFact[]; chunksProcessed: number }> {
    // Get chunks for this session's file
    const result = await this.db.query(
      `SELECT id, text
       FROM memory_chunks
       WHERE file_id = $1 AND user_id = $2
       ORDER BY start_line ASC`,
      [fileId, userId]
    );

    const chunks = result.rows;
    if (chunks.length === 0) {
      return { facts: [], chunksProcessed: 0 };
    }

    // Combine chunks into full text
    const fullText = chunks.map(c => c.text).join('\n\n');

    // Extract facts using LLM
    const extractionResult = await this.factExtractor.extractFacts(fullText, {
      minConfidence,
    });

    return {
      facts: extractionResult.facts,
      chunksProcessed: chunks.length,
    };
  }

  /**
   * Deduplicate extracted facts against existing stored facts
   */
  private async deduplicateAgainstExisting(
    userId: number,
    extractedFacts: ExtractedFact[]
  ): Promise<{ newFacts: ExtractedFact[]; mergedCount: number }> {
    const newFacts: ExtractedFact[] = [];
    let mergedCount = 0;

    for (const fact of extractedFacts) {
      // Generate embedding for fact
      const embedding = await (this.memoryService as any).getEmbedding(fact.content);

      // Find similar existing facts
      const similar = await this.db.query(
        `SELECT * FROM find_similar_facts($1, $2, 0.9, 3)`,
        [userId, `[${embedding.join(',')}]`]
      );

      if (similar.rows.length > 0) {
        // Fact already exists - update confidence if higher
        const existing = similar.rows[0];
        if (fact.confidence > parseFloat(existing.confidence_score)) {
          await this.db.query(
            `UPDATE memory_facts
             SET confidence_score = $1,
                 last_accessed_at = NOW()
             WHERE id = $2`,
            [fact.confidence, existing.id]
          );
        }
        mergedCount++;
      } else {
        // New fact
        newFacts.push(fact);
      }
    }

    return { newFacts, mergedCount };
  }

  /**
   * Store extracted facts in database
   */
  private async storeFacts(userId: number, facts: ExtractedFact[]): Promise<number> {
    let stored = 0;

    for (const fact of facts) {
      try {
        // Generate embedding
        const embedding = await (this.memoryService as any).getEmbedding(fact.content);

        // Calculate importance score
        const importanceScore = fact.confidence * 0.8 + 0.2; // New facts get slight boost

        // Insert fact
        await this.db.query(
          `INSERT INTO memory_facts (
            user_id, fact_type, content, embedding,
            confidence_score, importance_score, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            userId,
            fact.type,
            fact.content,
            `[${embedding.join(',')}]`,
            fact.confidence,
            importanceScore,
            JSON.stringify(fact.metadata || {}),
          ]
        );

        stored++;
      } catch (error) {
        console.error('[MemoryConsolidator] Error storing fact:', error);
        // Continue with other facts
      }
    }

    return stored;
  }

  /**
   * Update MEMORY.md with consolidated facts
   */
  private async updateMemoryFile(userId: number): Promise<void> {
    // Get top facts by importance
    const facts = await this.getFacts(userId, { limit: 100, minImportance: 0.5 });

    if (facts.length === 0) {
      return;
    }

    // Group facts by type
    const factsByType: Record<string, StoredFact[]> = {};
    for (const fact of facts) {
      if (!factsByType[fact.type]) {
        factsByType[fact.type] = [];
      }
      factsByType[fact.type].push(fact);
    }

    // Generate MEMORY.md content
    const lines: string[] = [];
    lines.push('# User Memory');
    lines.push('');
    lines.push('*Auto-generated from conversation consolidation*');
    lines.push('');
    lines.push(`**Last Updated**: ${new Date().toISOString()}`);
    lines.push(`**Total Facts**: ${facts.length}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Add facts by type
    const typeLabels: Record<string, string> = {
      preference: 'Preferences',
      fact: 'Facts',
      decision: 'Decisions',
      context: 'Context',
      goal: 'Goals',
      skill: 'Skills',
    };

    for (const [type, typeFacts] of Object.entries(factsByType)) {
      lines.push(`## ${typeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1)}`);
      lines.push('');

      typeFacts
        .sort((a, b) => b.importanceScore - a.importanceScore)
        .forEach((fact, idx) => {
          lines.push(`${idx + 1}. ${fact.content}`);
          lines.push(`   *Confidence: ${(fact.confidenceScore * 100).toFixed(0)}%, Importance: ${(fact.importanceScore * 100).toFixed(0)}%*`);
          lines.push('');
        });
    }

    const content = lines.join('\n');

    // Index as memory file
    await this.memoryService.indexMemoryContent(userId, 'MEMORY.md', content, 'memory');

    console.log(`[MemoryConsolidator] Updated MEMORY.md for user ${userId} with ${facts.length} facts`);
  }

  /**
   * Get sessions to consolidate
   */
  private async getSessionsToConsolidate(
    userId: number,
    sessionIds?: string[]
  ): Promise<Array<{ session_id: string; file_id: number }>> {
    let query = `
      SELECT session_id, file_id
      FROM indexed_sessions
      WHERE user_id = $1
    `;
    const params: any[] = [userId];

    if (sessionIds && sessionIds.length > 0) {
      query += ` AND session_id = ANY($2)`;
      params.push(sessionIds);
    } else {
      query += ` AND consolidation_status = 'pending'`;
    }

    query += ` ORDER BY indexed_at ASC`;

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Create consolidation job
   */
  private async createConsolidationJob(
    userId: number,
    jobType: 'scheduled' | 'manual' | 'on_demand'
  ): Promise<number> {
    const result = await this.db.query(
      `INSERT INTO consolidation_jobs (user_id, job_type, status, started_at)
       VALUES ($1, $2, 'pending', NOW())
       RETURNING id`,
      [userId, jobType]
    );

    return result.rows[0].id;
  }

  /**
   * Update job status
   */
  private async updateJobStatus(jobId: number, status: string): Promise<void> {
    await this.db.query(
      `UPDATE consolidation_jobs SET status = $1 WHERE id = $2`,
      [status, jobId]
    );
  }

  /**
   * Complete job with stats
   */
  private async completeJob(
    jobId: number,
    factsExtracted: number,
    chunksProcessed: number,
    totalChunks: number
  ): Promise<void> {
    await this.db.query(
      `UPDATE consolidation_jobs
       SET status = 'completed',
           facts_extracted = $2,
           chunks_processed = $3,
           total_chunks = $4,
           completed_at = NOW()
       WHERE id = $1`,
      [jobId, factsExtracted, chunksProcessed, totalChunks]
    );
  }

  /**
   * Fail job with error message
   */
  private async failJob(jobId: number, errorMessage: string): Promise<void> {
    await this.db.query(
      `UPDATE consolidation_jobs
       SET status = 'failed',
           error_message = $2,
           completed_at = NOW()
       WHERE id = $1`,
      [jobId, errorMessage]
    );
  }

  /**
   * Update session consolidation status
   */
  private async updateSessionConsolidationStatus(
    userId: number,
    sessionId: string,
    status: string,
    factsExtracted: number
  ): Promise<void> {
    await this.db.query(
      `UPDATE indexed_sessions
       SET consolidation_status = $1,
           facts_extracted = $2
       WHERE user_id = $3 AND session_id = $4`,
      [status, factsExtracted, userId, sessionId]
    );
  }

  /**
   * Update last consolidation time
   */
  private async updateLastConsolidationTime(userId: number): Promise<void> {
    await this.db.query(
      `UPDATE user_indexing_config
       SET last_consolidation_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );
  }
}
