-- Migration: Update technician documents to store file data in database
-- Date: 2025-12-11
-- Description: Adds file_data bytea column and makes file_url optional

-- Add file_data column for binary storage
ALTER TABLE technician_documents
ADD COLUMN IF NOT EXISTS file_data BYTEA,
ADD COLUMN IF NOT EXISTS content_type VARCHAR(100);

-- Make file_url optional since we're storing data in DB now
ALTER TABLE technician_documents
ALTER COLUMN file_url DROP NOT NULL;

-- Update comment
COMMENT ON COLUMN technician_documents.file_data IS 'Binary file data stored directly in database';
COMMENT ON COLUMN technician_documents.content_type IS 'MIME type of the stored file';
