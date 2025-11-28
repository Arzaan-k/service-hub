-- Add pdf_data column to service_report_pdfs table for storing PDF as binary
-- This replaces file-based storage with database storage

ALTER TABLE service_report_pdfs 
ADD COLUMN IF NOT EXISTS pdf_data BYTEA;

-- Make file_url optional (nullable) since we're now storing in database
ALTER TABLE service_report_pdfs 
ALTER COLUMN file_url DROP NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN service_report_pdfs.pdf_data IS 'PDF file stored as binary data directly in database';
