-- Add pgvector support for storing embeddings directly in PostgreSQL
-- Migration: Add Vector Support to Neon DB

-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add vector column to manual_chunks table for storing embeddings
ALTER TABLE manual_chunks
ADD COLUMN IF NOT EXISTS embedding vector(384);  -- 384 dimensions for all-MiniLM-L6-v2

-- Create an index for efficient vector similarity search
CREATE INDEX IF NOT EXISTS manual_chunks_embedding_idx
ON manual_chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);  -- Adjust based on data size

-- Add a comment for documentation
COMMENT ON COLUMN manual_chunks.embedding IS 'Vector embedding for semantic search (384 dimensions)';
COMMENT ON INDEX manual_chunks_embedding_idx IS 'IVFFlat index for cosine similarity search on embeddings';




