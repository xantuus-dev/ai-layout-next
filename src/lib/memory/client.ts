/**
 * Memory System Client
 *
 * Singleton client for memory system services
 */

import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { Pool } from 'pg';
import { MemoryService } from './MemoryService';
import { ConversationIndexer } from './ConversationIndexer';
import { FactExtractor } from './FactExtractor';
import { MemoryConsolidator } from './MemoryConsolidator';
import { MemoryScheduler } from './MemoryScheduler';
import { loadMemoryConfig } from './config';

// Singleton instances
let memoryService: MemoryService | null = null;
let conversationIndexer: ConversationIndexer | null = null;
let factExtractor: FactExtractor | null = null;
let memoryConsolidator: MemoryConsolidator | null = null;
let memoryScheduler: MemoryScheduler | null = null;
let pgPool: Pool | null = null;

/**
 * Get PostgreSQL pool for raw SQL queries
 * (Required for vector operations with pgvector)
 */
function getPgPool(): Pool {
  if (!pgPool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    pgPool = new Pool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pgPool;
}

/**
 * Initialize MemoryService
 */
export function getMemoryService(): MemoryService {
  if (!memoryService) {
    const config = loadMemoryConfig(process.env.NODE_ENV as any || 'development');

    const openai = new OpenAI({
      apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY,
    });

    memoryService = new MemoryService({
      db: getPgPool(),
      openai,
      chunkSize: config.chunking.tokens,
      chunkOverlap: config.chunking.overlap,
    });
  }
  return memoryService;
}

/**
 * Initialize ConversationIndexer
 */
export function getConversationIndexer(): ConversationIndexer {
  if (!conversationIndexer) {
    conversationIndexer = new ConversationIndexer(
      getPgPool(),
      getMemoryService()
    );
  }
  return conversationIndexer;
}

/**
 * Initialize FactExtractor
 */
export function getFactExtractor(): FactExtractor {
  if (!factExtractor) {
    const openai = new OpenAI({
      apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY,
    });

    factExtractor = new FactExtractor(openai, 'gpt-4o-mini');
  }
  return factExtractor;
}

/**
 * Initialize MemoryConsolidator
 */
export function getMemoryConsolidator(): MemoryConsolidator {
  if (!memoryConsolidator) {
    memoryConsolidator = new MemoryConsolidator(
      getPgPool(),
      getMemoryService(),
      getFactExtractor()
    );
  }
  return memoryConsolidator;
}

/**
 * Initialize MemoryScheduler
 */
export function getMemoryScheduler(): MemoryScheduler {
  if (!memoryScheduler) {
    const config = loadMemoryConfig(process.env.NODE_ENV as any || 'development');

    memoryScheduler = new MemoryScheduler(
      getPgPool(),
      getMemoryService(),
      getMemoryConsolidator(),
      {
        enabled: process.env.MEMORY_SCHEDULER_ENABLED !== 'false',
        consolidationIntervalMs: 6 * 60 * 60 * 1000, // 6 hours
        cacheCleanupIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
      }
    );
  }
  return memoryScheduler;
}

/**
 * Initialize memory system for a user
 */
export async function initializeUserMemory(userId: string): Promise<void> {
  // Convert string userId to number for memory system (temporary adapter)
  // TODO: Update memory system to use string IDs
  const userIdNum = parseInt(userId.replace(/\D/g, '').slice(0, 9)) || 1;

  const memoryService = getMemoryService();
  const conversationIndexer = getConversationIndexer();

  await memoryService.initializeUser(userIdNum);
  await conversationIndexer.initializeUserConfig(userIdNum, {
    autoIndexEnabled: true,
    minMessagesToIndex: 5,
    indexOnSessionEnd: true,
    consolidateOnIndex: true,
    consolidationIntervalHours: 6,
  });
}

/**
 * Cleanup connections
 */
export async function cleanup(): Promise<void> {
  if (memoryScheduler) {
    memoryScheduler.stop();
  }
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
  // Reset singletons
  memoryService = null;
  conversationIndexer = null;
  factExtractor = null;
  memoryConsolidator = null;
  memoryScheduler = null;
}
