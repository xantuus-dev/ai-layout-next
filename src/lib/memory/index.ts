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

export type {
  MemoryConfig,
  MemorySearchOptions,
  MemorySearchResult,
} from './config';

export type {
  Message,
  ConversationSession,
  IndexingConfig,
  IndexingResult,
  IndexingStats,
} from './ConversationIndexer';

export type {
  ExtractedFact,
  FactExtractionOptions,
  FactExtractionResult,
} from './FactExtractor';

export type {
  ConsolidationOptions,
  ConsolidationResult,
  MemoryFact,
} from './MemoryConsolidator';

export type {
  SchedulerConfig,
  ScheduledTask,
  SchedulerStats,
} from './MemoryScheduler';
