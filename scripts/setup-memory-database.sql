-- Memory System Database Setup
-- Run this script to enable pgvector and create optimized indices

-- ============================================
-- 1. Enable pgvector Extension
-- ============================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- 2. Convert JSON Embedding Fields to Vector Type
-- ============================================

-- Note: Prisma doesn't support vector types yet, so we store embeddings as JSON
-- For optimal performance, we need to add vector columns and indices via raw SQL

-- Add vector column to MemoryChunk (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'MemoryChunk'
        AND column_name = 'embedding_vector'
    ) THEN
        ALTER TABLE "MemoryChunk"
        ADD COLUMN embedding_vector vector(1536);

        COMMENT ON COLUMN "MemoryChunk".embedding_vector IS
        'Vector representation of text for semantic search';
    END IF;
END $$;

-- Add vector column to EmbeddingCache (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'EmbeddingCache'
        AND column_name = 'embedding_vector'
    ) THEN
        ALTER TABLE "EmbeddingCache"
        ADD COLUMN embedding_vector vector(1536);

        COMMENT ON COLUMN "EmbeddingCache".embedding_vector IS
        'Cached vector embedding for reuse';
    END IF;
END $$;

-- Add vector column to MemoryFact (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'MemoryFact'
        AND column_name = 'embedding_vector'
    ) THEN
        ALTER TABLE "MemoryFact"
        ADD COLUMN embedding_vector vector(1536);

        COMMENT ON COLUMN "MemoryFact".embedding_vector IS
        'Vector representation of extracted fact';
    END IF;
END $$;

-- ============================================
-- 3. Create Vector Indices (HNSW for ANN Search)
-- ============================================

-- HNSW index on MemoryChunk for fast similarity search
CREATE INDEX IF NOT EXISTS idx_memory_chunks_embedding_hnsw
ON "MemoryChunk"
USING hnsw (embedding_vector vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- HNSW index on MemoryFact for fact search
CREATE INDEX IF NOT EXISTS idx_memory_facts_embedding_hnsw
ON "MemoryFact"
USING hnsw (embedding_vector vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ============================================
-- 4. Create Full-Text Search Indices
-- ============================================

-- GIN index for full-text search on chunk text
CREATE INDEX IF NOT EXISTS idx_memory_chunks_text_search
ON "MemoryChunk"
USING gin(to_tsvector('english', text));

-- GIN index for full-text search on fact content
CREATE INDEX IF NOT EXISTS idx_memory_facts_text_search
ON "MemoryFact"
USING gin(to_tsvector('english', content));

-- ============================================
-- 5. Create Helper Functions
-- ============================================

-- Function: Search memory with hybrid scoring
CREATE OR REPLACE FUNCTION search_memory_hybrid(
    p_user_id TEXT,
    p_query TEXT,
    p_query_embedding vector(1536),
    p_max_results INTEGER DEFAULT 6,
    p_min_score REAL DEFAULT 0.35,
    p_vector_weight REAL DEFAULT 0.7,
    p_text_weight REAL DEFAULT 0.3
) RETURNS TABLE (
    chunk_id TEXT,
    file_path TEXT,
    text TEXT,
    start_line INTEGER,
    end_line INTEGER,
    vector_score REAL,
    text_score REAL,
    final_score REAL,
    citation TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        mc."chunkId" as chunk_id,
        mf."filePath" as file_path,
        mc.text,
        mc."startLine" as start_line,
        mc."endLine" as end_line,
        (1 - (mc.embedding_vector <=> p_query_embedding))::REAL as vector_score,
        ts_rank_cd(to_tsvector('english', mc.text), plainto_tsquery('english', p_query))::REAL as text_score,
        (
            p_vector_weight * (1 - (mc.embedding_vector <=> p_query_embedding)) +
            p_text_weight * ts_rank_cd(to_tsvector('english', mc.text), plainto_tsquery('english', p_query))
        )::REAL as final_score,
        (mf."filePath" || ':' || mc."startLine" || '-' || mc."endLine")::TEXT as citation
    FROM "MemoryChunk" mc
    JOIN "MemoryFile" mf ON mc."fileId" = mf.id
    WHERE mf."userId" = p_user_id
      AND mc.embedding_vector IS NOT NULL
    ORDER BY final_score DESC
    LIMIT p_max_results;
END;
$$ LANGUAGE plpgsql;

-- Function: Find similar facts
CREATE OR REPLACE FUNCTION find_similar_facts(
    p_user_id TEXT,
    p_embedding vector(1536),
    p_similarity_threshold REAL DEFAULT 0.9,
    p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
    fact_id TEXT,
    content TEXT,
    fact_type TEXT,
    similarity REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        mf.id as fact_id,
        mf.content,
        mf."factType" as fact_type,
        (1 - (mf.embedding_vector <=> p_embedding))::REAL as similarity
    FROM "MemoryFact" mf
    WHERE mf."userId" = p_user_id
      AND mf.embedding_vector IS NOT NULL
      AND (1 - (mf.embedding_vector <=> p_embedding)) >= p_similarity_threshold
    ORDER BY similarity DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate fact importance score
CREATE OR REPLACE FUNCTION calculate_fact_importance(
    p_confidence_score REAL,
    p_created_at TIMESTAMP,
    p_access_count INTEGER DEFAULT 0
) RETURNS REAL AS $$
DECLARE
    recency_factor REAL;
    access_factor REAL;
    importance REAL;
BEGIN
    -- Recency factor: exponential decay with 30-day half-life
    recency_factor := EXP(-LN(2) * EXTRACT(EPOCH FROM (NOW() - p_created_at)) / (30 * 24 * 3600));

    -- Access factor: logarithmic scaling
    access_factor := CASE
        WHEN p_access_count > 0 THEN LN(1 + p_access_count) / 5.0
        ELSE 0
    END;

    -- Clamp access factor to [0, 1]
    access_factor := LEAST(access_factor, 1.0);

    -- Calculate weighted importance
    importance := 0.5 * p_confidence_score +
                  0.3 * recency_factor +
                  0.2 * access_factor;

    RETURN importance;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Update importance scores for all facts
CREATE OR REPLACE FUNCTION update_fact_importance_scores(p_user_id TEXT)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE "MemoryFact"
    SET "importanceScore" = calculate_fact_importance(
        "confidenceScore",
        "createdAt",
        "accessCount"
    )
    WHERE "userId" = p_user_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Clean up expired facts
CREATE OR REPLACE FUNCTION cleanup_expired_facts()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM "MemoryFact"
    WHERE "expiresAt" IS NOT NULL
      AND "expiresAt" < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. Create Views for Analytics
-- ============================================

-- View: Memory facts by type
CREATE OR REPLACE VIEW memory_facts_by_type AS
SELECT
    "userId",
    "factType",
    COUNT(*) as fact_count,
    AVG("confidenceScore") as avg_confidence,
    AVG("importanceScore") as avg_importance
FROM "MemoryFact"
GROUP BY "userId", "factType";

-- View: Consolidation statistics
CREATE OR REPLACE VIEW consolidation_stats AS
SELECT
    "userId",
    COUNT(*) as total_jobs,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
    SUM("factsExtracted") as total_facts_extracted,
    SUM("factsStored") as total_facts_stored,
    MAX("completedAt") as last_consolidation
FROM "ConsolidationJob"
GROUP BY "userId";

-- View: Memory usage statistics
CREATE OR REPLACE VIEW memory_usage_stats AS
SELECT
    u.id as user_id,
    u.email,
    umm."totalFiles" as total_files,
    umm."totalChunks" as total_chunks,
    umm."lastIndexed" as last_indexed,
    COUNT(DISTINCT mf.id) as memory_files,
    COUNT(DISTINCT mc.id) as memory_chunks,
    COUNT(DISTINCT mfa.id) as memory_facts
FROM "User" u
LEFT JOIN "UserMemoryMeta" umm ON u.id = umm."userId"
LEFT JOIN "MemoryFile" mf ON u.id = mf."userId"
LEFT JOIN "MemoryChunk" mc ON mf.id = mc."fileId"
LEFT JOIN "MemoryFact" mfa ON u.id = mfa."userId"
GROUP BY u.id, u.email, umm."totalFiles", umm."totalChunks", umm."lastIndexed";

-- ============================================
-- Done!
-- ============================================

-- Verify setup
SELECT
    'pgvector extension' as component,
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
    ) THEN '✓ Enabled' ELSE '✗ Not Found' END as status
UNION ALL
SELECT
    'Memory indices',
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_memory_chunks_embedding_hnsw'
    ) THEN '✓ Created' ELSE '✗ Missing' END
UNION ALL
SELECT
    'Helper functions',
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'search_memory_hybrid'
    ) THEN '✓ Created' ELSE '✗ Missing' END;

-- Output success message
SELECT '✅ Memory system database setup complete!' as message;
