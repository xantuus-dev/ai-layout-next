/**
 * MemoryService - Phase 1 Implementation
 *
 * Core memory system for Xantuus AI, inspired by OpenClaw's memory architecture.
 * Provides semantic search over user conversations and curated memory files.
 *
 * Features:
 * - Text chunking with configurable overlap (OpenClaw-style: 400 tokens, 80 overlap)
 * - Embedding generation with persistent caching
 * - Hybrid search (vector + full-text)
 * - PostgreSQL + pgvector for storage
 *
 * @author Xantuus AI Team
 * @date 2026-02-17
 */

import { Pool, PoolClient } from 'pg';
import OpenAI from 'openai';
import crypto from 'crypto';
import { encode } from 'gpt-tokenizer';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface MemoryServiceConfig {
  db: Pool;
  openai: OpenAI;
  chunkSize?: number;           // Default: 400 tokens
  chunkOverlap?: number;        // Default: 80 tokens
  defaultProvider?: string;     // Default: 'openai'
  defaultModel?: string;        // Default: 'text-embedding-3-small'
  embeddingDims?: number;       // Default: 1536
  cacheTTLDays?: number;        // Default: 90 days
}

export interface MemoryChunk {
  text: string;
  startLine: number;
  endLine: number;
  chunkId: string;
  tokenCount: number;
}

export interface MemorySearchOptions {
  maxResults?: number;          // Default: 6
  minScore?: number;            // Default: 0.35
  sources?: Array<'memory' | 'session' | 'conversation'>;
  vectorWeight?: number;        // Default: 0.7
  textWeight?: number;          // Default: 0.3
}

export interface MemorySearchResult {
  id: number;
  text: string;
  snippet: string;
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  source: string;
  citation: string;
  vectorScore?: number;
  textScore?: number;
}

export interface MemoryFileInfo {
  path: string;
  text: string;
  totalLines: number;
  chunkCount: number;
  lastModified: Date;
}

export interface EmbeddingCacheStats {
  totalEntries: number;
  hitRate: number;
  oldestEntry: Date;
  newestEntry: Date;
}

// ============================================================================
// MemoryService Class
// ============================================================================

export class MemoryService {
  private db: Pool;
  private openai: OpenAI;
  private config: Required<Omit<MemoryServiceConfig, 'db' | 'openai'>>;

  // Performance tracking
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(config: MemoryServiceConfig) {
    this.db = config.db;
    this.openai = config.openai;
    this.config = {
      chunkSize: config.chunkSize ?? 400,
      chunkOverlap: config.chunkOverlap ?? 80,
      defaultProvider: config.defaultProvider ?? 'openai',
      defaultModel: config.defaultModel ?? 'text-embedding-3-small',
      embeddingDims: config.embeddingDims ?? 1536,
      cacheTTLDays: config.cacheTTLDays ?? 90,
    };

    this.validateConfig();
  }

  // ==========================================================================
  // Public API Methods
  // ==========================================================================

  /**
   * Initialize memory system for a user
   */
  async initializeUser(userId: number): Promise<void> {
    await this.db.query(
      `INSERT INTO user_memory_meta (user_id, provider, model, embedding_dims)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, this.config.defaultProvider, this.config.defaultModel, this.config.embeddingDims]
    );
  }

  /**
   * Index memory content for a user
   *
   * @param userId - User ID
   * @param filePath - Virtual file path (e.g., 'MEMORY.md', 'memory/2026-02-17.md')
   * @param content - File content to index
   * @param source - Content source: 'memory' (curated), 'session' (daily logs), 'conversation' (auto-indexed)
   */
  async indexMemoryContent(
    userId: number,
    filePath: string,
    content: string,
    source: 'memory' | 'session' | 'conversation' = 'memory'
  ): Promise<{ chunksCreated: number; fileId: number }> {
    const startTime = Date.now();
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Calculate content hash for change detection
      const contentHash = this.hashContent(content);

      // Check if file content has changed
      const existingFile = await client.query(
        `SELECT id, content_hash FROM memory_files
         WHERE user_id = $1 AND file_path = $2`,
        [userId, filePath]
      );

      if (existingFile.rows.length > 0 && existingFile.rows[0].content_hash === contentHash) {
        await client.query('COMMIT');
        console.log(`[Memory] File ${filePath} unchanged, skipping reindex`);
        return { chunksCreated: 0, fileId: existingFile.rows[0].id };
      }

      // Upsert file record
      const fileResult = await client.query(
        `INSERT INTO memory_files (user_id, file_path, source, content_hash, last_modified, file_size)
         VALUES ($1, $2, $3, $4, NOW(), $5)
         ON CONFLICT (user_id, file_path)
         DO UPDATE SET
           content_hash = EXCLUDED.content_hash,
           last_modified = NOW(),
           file_size = EXCLUDED.file_size,
           source = EXCLUDED.source
         RETURNING id`,
        [userId, filePath, source, contentHash, content.length]
      );

      const fileId = fileResult.rows[0].id;

      // Delete old chunks for this file
      await client.query(`DELETE FROM memory_chunks WHERE file_id = $1`, [fileId]);

      // Chunk the content
      const chunks = this.chunkText(content, filePath);
      console.log(`[Memory] Generated ${chunks.length} chunks for ${filePath}`);

      // Generate embeddings and insert chunks (with batching)
      let chunksCreated = 0;
      for (const chunk of chunks) {
        const embedding = await this.getEmbedding(chunk.text, client);
        const chunkHash = this.hashContent(chunk.text);

        await client.query(
          `INSERT INTO memory_chunks (
            user_id, file_id, chunk_id, source,
            start_line, end_line, content_hash, model,
            text, embedding, token_count
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            userId,
            fileId,
            chunk.chunkId,
            source,
            chunk.startLine,
            chunk.endLine,
            chunkHash,
            this.config.defaultModel,
            chunk.text,
            `[${embedding.join(',')}]`,
            chunk.tokenCount,
          ]
        );

        chunksCreated++;
      }

      await client.query('COMMIT');

      const duration = Date.now() - startTime;
      console.log(
        `[Memory] Indexed ${chunksCreated} chunks for user ${userId}, file ${filePath} (${duration}ms)`
      );

      return { chunksCreated, fileId };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[Memory] Index error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Search memory using hybrid vector + full-text search
   *
   * @param userId - User ID
   * @param query - Search query
   * @param options - Search options (maxResults, minScore, sources, weights)
   */
  async searchMemory(
    userId: number,
    query: string,
    options: MemorySearchOptions = {}
  ): Promise<MemorySearchResult[]> {
    const startTime = Date.now();

    const maxResults = options.maxResults ?? 6;
    const minScore = options.minScore ?? 0.35;
    const sources = options.sources ?? ['memory'];
    const vectorWeight = options.vectorWeight ?? 0.7;
    const textWeight = options.textWeight ?? 0.3;

    try {
      // Generate query embedding
      const queryEmbedding = await this.getEmbedding(query);

      // Use the database function for hybrid search
      const result = await this.db.query(
        `SELECT * FROM search_memory_hybrid($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          query,
          `[${queryEmbedding.join(',')}]`,
          maxResults,
          minScore,
          vectorWeight,
          textWeight,
          sources,
        ]
      );

      // Format results
      const results: MemorySearchResult[] = result.rows.map((row) => ({
        id: row.id,
        text: row.text,
        snippet: this.createSnippet(row.text, query, 700),
        path: row.file_path,
        startLine: row.start_line,
        endLine: row.end_line,
        score: parseFloat(row.combined_score),
        source: row.source,
        citation: this.formatCitation(row.file_path, row.start_line, row.end_line),
        vectorScore: parseFloat(row.vector_score),
        textScore: parseFloat(row.text_score),
      }));

      const duration = Date.now() - startTime;

      // Log the search
      await this.logSearch(
        userId,
        query,
        results.length,
        duration,
        maxResults,
        minScore,
        vectorWeight,
        textWeight
      );

      console.log(
        `[Memory] Search completed: ${results.length} results for "${query}" (${duration}ms)`
      );

      return results;
    } catch (error) {
      console.error('[Memory] Search error:', error);
      throw error;
    }
  }

  /**
   * Get memory file content
   *
   * @param userId - User ID
   * @param filePath - Virtual file path
   * @param options - Optional line range (from, lines)
   */
  async getMemoryFile(
    userId: number,
    filePath: string,
    options: { from?: number; lines?: number } = {}
  ): Promise<MemoryFileInfo> {
    const fileResult = await this.db.query(
      `SELECT id, last_modified, chunk_count FROM memory_files
       WHERE user_id = $1 AND file_path = $2`,
      [userId, filePath]
    );

    if (fileResult.rows.length === 0) {
      throw new Error(`File not found: ${filePath}`);
    }

    const file = fileResult.rows[0];

    // Get chunks for this file, ordered by line number
    const chunksResult = await this.db.query(
      `SELECT text, start_line, end_line
       FROM memory_chunks
       WHERE file_id = $1
       ORDER BY start_line ASC`,
      [file.id]
    );

    // Reconstruct file content from chunks
    const fullText = chunksResult.rows.map((c) => c.text).join('\n');
    const lines = fullText.split('\n');

    // Apply line range if specified
    const from = options.from ? Math.max(1, options.from) : 1;
    const lineCount = options.lines ?? lines.length;
    const selectedLines = lines.slice(from - 1, from - 1 + lineCount);

    return {
      path: filePath,
      text: selectedLines.join('\n'),
      totalLines: lines.length,
      chunkCount: file.chunk_count,
      lastModified: file.last_modified,
    };
  }

  /**
   * Delete memory file
   */
  async deleteMemoryFile(userId: number, filePath: string): Promise<void> {
    const result = await this.db.query(
      `DELETE FROM memory_files WHERE user_id = $1 AND file_path = $2 RETURNING id`,
      [userId, filePath]
    );

    if (result.rowCount === 0) {
      throw new Error(`File not found: ${filePath}`);
    }

    console.log(`[Memory] Deleted file ${filePath} for user ${userId}`);
  }

  /**
   * List all memory files for a user
   */
  async listMemoryFiles(
    userId: number,
    source?: 'memory' | 'session' | 'conversation'
  ): Promise<Array<{ path: string; source: string; size: number; chunkCount: number; lastModified: Date }>> {
    const query = source
      ? `SELECT file_path, source, file_size, chunk_count, last_modified
         FROM memory_files WHERE user_id = $1 AND source = $2 ORDER BY last_modified DESC`
      : `SELECT file_path, source, file_size, chunk_count, last_modified
         FROM memory_files WHERE user_id = $1 ORDER BY last_modified DESC`;

    const params = source ? [userId, source] : [userId];
    const result = await this.db.query(query, params);

    return result.rows.map((row) => ({
      path: row.file_path,
      source: row.source,
      size: row.file_size,
      chunkCount: row.chunk_count,
      lastModified: row.last_modified,
    }));
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<EmbeddingCacheStats> {
    const result = await this.db.query(`
      SELECT
        COUNT(*) as total,
        MIN(created_at) as oldest,
        MAX(created_at) as newest
      FROM embedding_cache
    `);

    const row = result.rows[0];
    const totalRequests = this.cacheHits + this.cacheMisses;
    const hitRate = totalRequests > 0 ? this.cacheHits / totalRequests : 0;

    return {
      totalEntries: parseInt(row.total),
      hitRate,
      oldestEntry: row.oldest,
      newestEntry: row.newest,
    };
  }

  /**
   * Clean up old cache entries (LRU eviction)
   */
  async cleanupCache(maxEntries: number = 50000): Promise<number> {
    const result = await this.db.query(`SELECT cleanup_embedding_cache($1)`, [maxEntries]);
    const deletedCount = result.rows[0].cleanup_embedding_cache;
    console.log(`[Memory] Cleaned up ${deletedCount} old cache entries`);
    return deletedCount;
  }

  // ==========================================================================
  // Private Methods - Embedding Generation
  // ==========================================================================

  /**
   * Generate embedding with caching
   */
  private async getEmbedding(
    text: string,
    client?: PoolClient
  ): Promise<number[]> {
    const hash = this.hashContent(text);
    const db = client || this.db;

    // Check cache first
    const cached = await db.query(
      `SELECT embedding::text as embedding
       FROM embedding_cache
       WHERE provider = $1 AND model = $2 AND content_hash = $3`,
      [this.config.defaultProvider, this.config.defaultModel, hash]
    );

    if (cached.rows.length > 0) {
      this.cacheHits++;

      // Update access stats
      await db.query(
        `UPDATE embedding_cache
         SET access_count = access_count + 1, last_accessed_at = NOW()
         WHERE provider = $1 AND model = $2 AND content_hash = $3`,
        [this.config.defaultProvider, this.config.defaultModel, hash]
      );

      // Parse the vector (format: [1.0,2.0,3.0])
      const vectorStr = cached.rows[0].embedding;
      return JSON.parse(vectorStr.replace(/^\[|\]$/g, '').split(',').map((v: string) => v.trim()).join(','));
    }

    this.cacheMisses++;

    // Generate new embedding via OpenAI
    const response = await this.openai.embeddings.create({
      model: this.config.defaultModel,
      input: text,
      dimensions: this.config.embeddingDims,
    });

    const embedding = response.data[0].embedding;
    const tokenCount = encode(text).length;

    // Cache the embedding
    await db.query(
      `INSERT INTO embedding_cache (provider, model, content_hash, embedding, dims, token_count)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (provider, model, content_hash) DO UPDATE
       SET access_count = embedding_cache.access_count + 1,
           last_accessed_at = NOW()`,
      [
        this.config.defaultProvider,
        this.config.defaultModel,
        hash,
        `[${embedding.join(',')}]`,
        this.config.embeddingDims,
        tokenCount,
      ]
    );

    return embedding;
  }

  // ==========================================================================
  // Private Methods - Text Chunking (OpenClaw-inspired)
  // ==========================================================================

  /**
   * Chunk text into overlapping segments
   *
   * Based on OpenClaw's chunking strategy:
   * - Target chunk size: 400 tokens (configurable)
   * - Overlap: 80 tokens (configurable)
   * - Chunk on line boundaries for better readability
   */
  private chunkText(text: string, filePath: string): MemoryChunk[] {
    const lines = text.split('\n');
    const chunks: MemoryChunk[] = [];

    let currentChunk: string[] = [];
    let currentTokens = 0;
    let startLine = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineTokens = encode(line).length;

      // If adding this line exceeds chunk size, save current chunk
      if (currentTokens + lineTokens > this.config.chunkSize && currentChunk.length > 0) {
        const chunkText = currentChunk.join('\n');
        const endLine = startLine + currentChunk.length - 1;

        chunks.push({
          text: chunkText,
          startLine,
          endLine,
          chunkId: `${filePath}:${startLine}-${endLine}`,
          tokenCount: currentTokens,
        });

        // Start new chunk with overlap
        const overlapLines = this.calculateOverlapLines(currentChunk, this.config.chunkOverlap);
        currentChunk = currentChunk.slice(-overlapLines);
        currentTokens = encode(currentChunk.join('\n')).length;
        startLine = i - overlapLines + 1;
      }

      currentChunk.push(line);
      currentTokens += lineTokens;
    }

    // Save final chunk
    if (currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.join('\n'),
        startLine,
        endLine: lines.length,
        chunkId: `${filePath}:${startLine}-${lines.length}`,
        tokenCount: currentTokens,
      });
    }

    return chunks;
  }

  /**
   * Calculate number of lines needed for specified token overlap
   */
  private calculateOverlapLines(lines: string[], overlapTokens: number): number {
    let tokens = 0;
    let lineCount = 0;

    for (let i = lines.length - 1; i >= 0; i--) {
      const lineTokens = encode(lines[i]).length;
      if (tokens + lineTokens > overlapTokens) break;
      tokens += lineTokens;
      lineCount++;
    }

    return lineCount;
  }

  // ==========================================================================
  // Private Methods - Utilities
  // ==========================================================================

  /**
   * Create snippet with context around query terms
   */
  private createSnippet(text: string, query: string, maxChars: number = 700): string {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const textLower = text.toLowerCase();

    let bestStart = 0;
    let maxMatches = 0;

    // Find window with most query term matches
    const windowSize = Math.min(maxChars, text.length);
    for (let i = 0; i <= text.length - windowSize; i += 50) {
      const window = text.substr(i, windowSize).toLowerCase();
      const matches = queryTerms.filter((term) => window.includes(term)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        bestStart = i;
      }
    }

    const snippet = text.substr(bestStart, maxChars);
    const prefix = bestStart > 0 ? '...' : '';
    const suffix = bestStart + maxChars < text.length ? '...' : '';

    return prefix + snippet + suffix;
  }

  /**
   * Format citation (OpenClaw-style)
   */
  private formatCitation(filePath: string, startLine: number, endLine: number): string {
    if (startLine === endLine) {
      return `${filePath}#L${startLine}`;
    }
    return `${filePath}#L${startLine}-L${endLine}`;
  }

  /**
   * Hash content for change detection and cache keys
   */
  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Log search for analytics
   */
  private async logSearch(
    userId: number,
    query: string,
    resultsCount: number,
    searchTimeMs: number,
    maxResults: number,
    minScore: number,
    vectorWeight: number,
    textWeight: number
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO memory_search_log (
          user_id, query, results_count, provider, model, search_time_ms,
          max_results, min_score, hybrid_enabled, vector_weight, text_weight
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          userId,
          query,
          resultsCount,
          this.config.defaultProvider,
          this.config.defaultModel,
          searchTimeMs,
          maxResults,
          minScore,
          true,
          vectorWeight,
          textWeight,
        ]
      );
    } catch (error) {
      console.error('[Memory] Failed to log search:', error);
      // Don't throw - logging failure shouldn't break search
    }
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    if (this.config.chunkSize <= this.config.chunkOverlap) {
      throw new Error('Chunk size must be greater than chunk overlap');
    }
    if (this.config.chunkOverlap < 0) {
      throw new Error('Chunk overlap must be non-negative');
    }
    if (this.config.embeddingDims <= 0) {
      throw new Error('Embedding dimensions must be positive');
    }
  }
}
