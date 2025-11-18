-- Migration: Add columns for technician service tracking and photo uploads
-- Created: 2025-11-10
-- Purpose: Support multi-service tracking, photo uploads, and document management

-- Add new columns to service_requests table
ALTER TABLE service_requests 
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
ADD COLUMN IF NOT EXISTS before_photos JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS after_photos JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS signed_document_url TEXT,
ADD COLUMN IF NOT EXISTS vendor_invoice_url TEXT,
ADD COLUMN IF NOT EXISTS technician_notes TEXT;

-- Create index for faster queries on technician services
CREATE INDEX IF NOT EXISTS idx_service_requests_technician_status 
ON service_requests(technician_id, status);

CREATE INDEX IF NOT EXISTS idx_service_requests_start_time 
ON service_requests(start_time DESC);

CREATE INDEX IF NOT EXISTS idx_service_requests_end_time 
ON service_requests(end_time DESC);

-- Add comment to document the schema
COMMENT ON COLUMN service_requests.start_time IS 'Actual time when technician started the service';
COMMENT ON COLUMN service_requests.end_time IS 'Actual time when technician completed the service';
COMMENT ON COLUMN service_requests.duration_minutes IS 'Total service duration in minutes';
COMMENT ON COLUMN service_requests.before_photos IS 'Array of URLs for before photos uploaded by technician';
COMMENT ON COLUMN service_requests.after_photos IS 'Array of URLs for after photos uploaded by technician';
COMMENT ON COLUMN service_requests.signed_document_url IS 'URL of client signature document';
COMMENT ON COLUMN service_requests.vendor_invoice_url IS 'URL of third-party vendor invoice (if applicable)';
COMMENT ON COLUMN service_requests.technician_notes IS 'Additional notes from technician during service';
