-- Technician WhatsApp Flow Database Migration
-- Run this SQL script in your PostgreSQL database

-- Add new columns to service_requests table
ALTER TABLE service_requests 
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
ADD COLUMN IF NOT EXISTS signed_document_url TEXT,
ADD COLUMN IF NOT EXISTS vendor_invoice_url TEXT,
ADD COLUMN IF NOT EXISTS technician_notes TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_service_requests_technician_status 
ON service_requests(assigned_technician_id, status);

CREATE INDEX IF NOT EXISTS idx_service_requests_start_time 
ON service_requests(start_time DESC);

CREATE INDEX IF NOT EXISTS idx_service_requests_end_time 
ON service_requests(end_time DESC);

-- Add comments to document the schema
COMMENT ON COLUMN service_requests.start_time IS 'Actual time when technician started the service via WhatsApp';
COMMENT ON COLUMN service_requests.end_time IS 'Actual time when technician completed the service via WhatsApp';
COMMENT ON COLUMN service_requests.duration_minutes IS 'Total service duration in minutes (calculated)';
COMMENT ON COLUMN service_requests.signed_document_url IS 'URL of client signature document uploaded by technician';
COMMENT ON COLUMN service_requests.vendor_invoice_url IS 'URL of third-party vendor invoice (if applicable)';
COMMENT ON COLUMN service_requests.technician_notes IS 'Additional notes from technician during service';

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'service_requests'
AND column_name IN ('start_time', 'end_time', 'duration_minutes', 'signed_document_url', 'vendor_invoice_url', 'technician_notes');
