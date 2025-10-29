-- Add RAG (Retrieval-Augmented Generation) tables for Reefer Diagnostic Chatbot
-- Migration: Add RAG Tables

-- Manuals table for storing uploaded service manuals
CREATE TABLE IF NOT EXISTS manuals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_url text,
  uploaded_by uuid REFERENCES users(id),
  uploaded_on timestamptz DEFAULT now() NOT NULL,
  version text,
  meta jsonb, -- Additional metadata like brand, model, etc.
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Manual chunks table for storing text chunks and embeddings
CREATE TABLE IF NOT EXISTS manual_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manual_id uuid REFERENCES manuals(id) NOT NULL,
  chunk_text text NOT NULL,
  chunk_embedding_id text, -- ID/key in vector database
  page_num integer,
  start_offset integer,
  end_offset integer,
  metadata jsonb, -- Additional chunk metadata (headings, alarm codes, etc.)
  created_at timestamptz DEFAULT now() NOT NULL
);

-- RAG queries table for storing chat history and responses
CREATE TABLE IF NOT EXISTS rag_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  unit_id uuid REFERENCES containers(id),
  query_text text NOT NULL,
  response_text text NOT NULL,
  sources jsonb, -- Array of source citations
  confidence text NOT NULL, -- 'high', 'medium', 'low'
  suggested_parts jsonb, -- Array of suggested spare parts
  context jsonb, -- Additional context (telemetry, alarm data, etc.)
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_manual_chunks_manual_id ON manual_chunks(manual_id);
CREATE INDEX IF NOT EXISTS idx_manual_chunks_page_num ON manual_chunks(page_num);
CREATE INDEX IF NOT EXISTS idx_rag_queries_user_id ON rag_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_rag_queries_unit_id ON rag_queries(unit_id);
CREATE INDEX IF NOT EXISTS idx_rag_queries_created_at ON rag_queries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_queries_confidence ON rag_queries(confidence);

-- Add some sample data for testing (optional)
-- INSERT INTO manuals (name, version, meta) VALUES
-- ('Thermo King SL-500 Service Manual', 'v2.1', '{"brand": "Thermo King", "model": "SL-500", "alarms": ["Alarm 17", "Alarm 23"]}'),
-- ('Carrier Transicold Manual', 'v1.8', '{"brand": "Carrier", "model": "Transicold", "alarms": ["Alarm 12", "Alarm 45"]}');

-- Add comment for documentation
COMMENT ON TABLE manuals IS 'Stores uploaded service manuals for RAG system';
COMMENT ON TABLE manual_chunks IS 'Stores text chunks and embeddings from manuals';
COMMENT ON TABLE rag_queries IS 'Stores RAG chat queries and responses for audit and analytics';

