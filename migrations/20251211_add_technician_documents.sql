-- Migration: Add technician document submission system
-- Date: 2025-12-11
-- Description: Adds password setup tokens and document submission tables for technicians

-- Add password setup and document submission fields to technicians table
ALTER TABLE technicians 
ADD COLUMN IF NOT EXISTS password_setup_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS password_setup_token_expiry TIMESTAMP,
ADD COLUMN IF NOT EXISTS documents_submitted BOOLEAN DEFAULT false;

-- Create technician_documents table
CREATE TABLE IF NOT EXISTS technician_documents (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  technician_id VARCHAR(255) NOT NULL,
  document_type VARCHAR(100) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_technician_documents_technician 
    FOREIGN KEY (technician_id) 
    REFERENCES technicians(id) 
    ON DELETE CASCADE,
  
  -- Ensure only one document per type per technician
  CONSTRAINT unique_technician_document_type 
    UNIQUE (technician_id, document_type)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tech_docs_technician_id 
  ON technician_documents(technician_id);

CREATE INDEX IF NOT EXISTS idx_tech_docs_document_type 
  ON technician_documents(document_type);

CREATE INDEX IF NOT EXISTS idx_technicians_password_token 
  ON technicians(password_setup_token);

CREATE INDEX IF NOT EXISTS idx_technicians_documents_submitted 
  ON technicians(documents_submitted);

-- Add comments for documentation
COMMENT ON TABLE technician_documents IS 'Stores documents submitted by technicians (Aadhar, Health Report, CBC Report, Insurance Report)';
COMMENT ON COLUMN technicians.password_setup_token IS 'Token for first-time password setup, expires in 24 hours';
COMMENT ON COLUMN technicians.password_setup_token_expiry IS 'Expiry timestamp for password setup token';
COMMENT ON COLUMN technicians.documents_submitted IS 'Whether technician has submitted all required documents';
