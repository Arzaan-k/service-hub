-- Migration: Add immutable remarks and recordings tables for service requests

-- Service Request Remarks (immutable)
CREATE TABLE IF NOT EXISTS service_request_remarks (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  service_request_id VARCHAR NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  user_id VARCHAR REFERENCES users(id),
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  remark_text TEXT NOT NULL,
  is_system_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Service Request Recordings
CREATE TABLE IF NOT EXISTS service_request_recordings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  service_request_id VARCHAR NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  remark_id VARCHAR REFERENCES service_request_remarks(id),
  uploaded_by VARCHAR REFERENCES users(id),
  uploaded_by_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  original_file_size INTEGER,
  duration_seconds INTEGER,
  mime_type TEXT,
  is_compressed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_remarks_service_request ON service_request_remarks(service_request_id);
CREATE INDEX IF NOT EXISTS idx_recordings_service_request ON service_request_recordings(service_request_id);
CREATE INDEX IF NOT EXISTS idx_remarks_created_at ON service_request_remarks(created_at);
CREATE INDEX IF NOT EXISTS idx_recordings_created_at ON service_request_recordings(created_at);

-- Immutability triggers - prevent updates and deletes on remarks
CREATE OR REPLACE FUNCTION prevent_remark_modification() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Remarks are immutable and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS immutable_remarks_update ON service_request_remarks;
DROP TRIGGER IF EXISTS immutable_remarks_delete ON service_request_remarks;

-- Create triggers
CREATE TRIGGER immutable_remarks_update
BEFORE UPDATE ON service_request_remarks
FOR EACH ROW EXECUTE FUNCTION prevent_remark_modification();

CREATE TRIGGER immutable_remarks_delete
BEFORE DELETE ON service_request_remarks
FOR EACH ROW EXECUTE FUNCTION prevent_remark_modification();

-- Add coordinator_remarks column to service_requests if it doesn't exist (for backward compatibility)
-- This will be deprecated in favor of the new remarks table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'service_requests' AND column_name = 'coordinator_remarks') THEN
    ALTER TABLE service_requests ADD COLUMN coordinator_remarks TEXT;
  END IF;
END $$;
