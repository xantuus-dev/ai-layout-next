/**
 * Memory System - Exports
 *
 * OpenClaw-inspired memory system with auto-indexing and consolidation
 */

export { MemoryService } from './MemoryService';
export { ConversationIndexer } from './ConversationIndexer';
export { FactExtractor } from './FactExtractor';
export { MemoryConsolidator } from './MemoryConsolidator';
export { MemoryScheduler } from './MemoryScheduler';
export { loadMemoryConfig, validateMemoryConfig } from './config';

export type { MemoryConfig } from './config';
export type { MemorySearchOptions, MemorySearchResult } from './MemoryService';

export type {
  Message,
  ConversationSession,
  IndexingConfig,
  IndexingResult,
} from './ConversationIndexer';

export type {
  ExtractedFact,
  ExtractionOptions,
  ExtractionResult,
  FactType,
} from './FactExtractor';

export type {
  ConsolidationOptions,
  ConsolidationResult,
  StoredFact,
} from './MemoryConsolidator';

export type {
  SchedulerConfig,
  ScheduledTask,
  SchedulerStats,
} from './MemoryScheduler';
