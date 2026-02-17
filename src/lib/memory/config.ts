/**
 * Memory System Configuration
 *
 * Configuration for the Xantuus AI memory system.
 * Based on OpenClaw's memory architecture with adaptations for multi-tenant SaaS.
 */

export interface MemoryConfig {
  // Database configuration
  database: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean;
    max?: number;  // Max pool connections
  };

  // Embedding provider configuration
  embeddings: {
    provider: 'openai' | 'gemini' | 'voyage' | 'local';
    model: string;
    dimensions: number;
    apiKey?: string;
    baseUrl?: string;  // For custom OpenAI-compatible endpoints
  };

  // Chunking configuration (OpenClaw defaults)
  chunking: {
    tokens: number;      // Target chunk size in tokens (default: 400)
    overlap: number;     // Overlap in tokens (default: 80)
  };

  // Search configuration
  search: {
    maxResults: number;       // Default max results (default: 6)
    minScore: number;         // Minimum relevance score (default: 0.35)
    vectorWeight: number;     // Weight for vector search (default: 0.7)
    textWeight: number;       // Weight for text search (default: 0.3)
  };

  // Cache configuration
  cache: {
    enabled: boolean;
    maxEntries: number;       // LRU cache size (default: 50000)
    ttlDays: number;          // TTL for cache entries (default: 90)
    cleanupIntervalHours: number;  // Cleanup interval (default: 24)
  };

  // Indexing configuration
  indexing: {
    autoIndex: boolean;       // Auto-index conversations (default: true)
    onSessionEnd: boolean;    // Index when session ends (default: true)
    minMessagesForIndex: number;  // Min messages to trigger indexing (default: 5)
  };
}

// ============================================================================
// Default Configuration
// ============================================================================

export const defaultMemoryConfig: MemoryConfig = {
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'xantuus',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
    max: 20,
  },

  embeddings: {
    provider: (process.env.EMBEDDING_PROVIDER as any) || 'openai',
    model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    dimensions: parseInt(process.env.EMBEDDING_DIMS || '1536'),
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_BASE_URL,
  },

  chunking: {
    tokens: parseInt(process.env.CHUNK_SIZE || '400'),
    overlap: parseInt(process.env.CHUNK_OVERLAP || '80'),
  },

  search: {
    maxResults: parseInt(process.env.SEARCH_MAX_RESULTS || '6'),
    minScore: parseFloat(process.env.SEARCH_MIN_SCORE || '0.35'),
    vectorWeight: parseFloat(process.env.SEARCH_VECTOR_WEIGHT || '0.7'),
    textWeight: parseFloat(process.env.SEARCH_TEXT_WEIGHT || '0.3'),
  },

  cache: {
    enabled: process.env.CACHE_ENABLED !== 'false',
    maxEntries: parseInt(process.env.CACHE_MAX_ENTRIES || '50000'),
    ttlDays: parseInt(process.env.CACHE_TTL_DAYS || '90'),
    cleanupIntervalHours: parseInt(process.env.CACHE_CLEANUP_INTERVAL || '24'),
  },

  indexing: {
    autoIndex: process.env.AUTO_INDEX !== 'false',
    onSessionEnd: process.env.INDEX_ON_SESSION_END !== 'false',
    minMessagesForIndex: parseInt(process.env.MIN_MESSAGES_FOR_INDEX || '5'),
  },
};

// ============================================================================
// Environment-Specific Configurations
// ============================================================================

export const developmentConfig: Partial<MemoryConfig> = {
  database: {
    ...defaultMemoryConfig.database,
    max: 5,  // Fewer connections in dev
  },
  cache: {
    ...defaultMemoryConfig.cache,
    maxEntries: 10000,  // Smaller cache in dev
  },
};

export const productionConfig: Partial<MemoryConfig> = {
  database: {
    ...defaultMemoryConfig.database,
    ssl: true,
    max: 50,  // More connections in prod
  },
  cache: {
    ...defaultMemoryConfig.cache,
    maxEntries: 100000,  // Larger cache in prod
  },
};

export const testConfig: Partial<MemoryConfig> = {
  database: {
    ...defaultMemoryConfig.database,
    database: 'xantuus_test',
    max: 2,
  },
  cache: {
    ...defaultMemoryConfig.cache,
    enabled: false,  // Disable cache in tests for consistency
  },
};

// ============================================================================
// Configuration Loader
// ============================================================================

export function loadMemoryConfig(env: 'development' | 'production' | 'test' = 'development'): MemoryConfig {
  const envConfig = {
    development: developmentConfig,
    production: productionConfig,
    test: testConfig,
  }[env];

  return {
    ...defaultMemoryConfig,
    ...envConfig,
  };
}

// ============================================================================
// Validation
// ============================================================================

export function validateMemoryConfig(config: MemoryConfig): void {
  // Database validation
  if (!config.database.host) {
    throw new Error('Database host is required');
  }
  if (!config.database.database) {
    throw new Error('Database name is required');
  }

  // Embeddings validation
  if (!config.embeddings.apiKey && config.embeddings.provider !== 'local') {
    throw new Error(`API key required for ${config.embeddings.provider} embeddings`);
  }
  if (config.embeddings.dimensions <= 0) {
    throw new Error('Embedding dimensions must be positive');
  }

  // Chunking validation
  if (config.chunking.tokens <= config.chunking.overlap) {
    throw new Error('Chunk size must be greater than overlap');
  }
  if (config.chunking.overlap < 0) {
    throw new Error('Chunk overlap must be non-negative');
  }

  // Search validation
  if (config.search.vectorWeight + config.search.textWeight !== 1.0) {
    console.warn('Vector weight + text weight should equal 1.0, normalizing...');
    const sum = config.search.vectorWeight + config.search.textWeight;
    config.search.vectorWeight /= sum;
    config.search.textWeight /= sum;
  }
  if (config.search.minScore < 0 || config.search.minScore > 1) {
    throw new Error('Min score must be between 0 and 1');
  }

  // Cache validation
  if (config.cache.maxEntries <= 0) {
    throw new Error('Cache max entries must be positive');
  }
}
