-- Fix WhatsApp Errors Migration
-- Fixes: 
-- 1. Invalid enum value "image" for whatsapp_message_type
-- 2. Missing columns in service_requests table

-- ============================================================================
-- FIX 1: Update whatsapp_message_type enum to include image, video, document, audio
-- ============================================================================

-- Add new values to the enum
ALTER TYPE whatsapp_message_type ADD VALUE IF NOT EXISTS 'image';
ALTER TYPE whatsapp_message_type ADD VALUE IF NOT EXISTS 'video';
ALTER TYPE whatsapp_message_type ADD VALUE IF NOT EXISTS 'document';
ALTER TYPE whatsapp_message_type ADD VALUE IF NOT EXISTS 'audio';

-- ============================================================================
-- FIX 2: Add missing columns to service_requests table
-- ============================================================================

-- Add new columns for technician WhatsApp flow
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

-- ============================================================================
-- Verification
-- ============================================================================

-- Verify enum values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'whatsapp_message_type'::regtype
ORDER BY enumsortorder;

-- Verify new columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'service_requests'
AND column_name IN ('start_time', 'end_time', 'duration_minutes', 'signed_document_url', 'vendor_invoice_url', 'technician_notes');
