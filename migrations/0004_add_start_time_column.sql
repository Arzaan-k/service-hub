-- Migration: Add start_time column to service_requests table
-- This column tracks when a technician actually starts a service (via WhatsApp flow)

ALTER TABLE service_requests 
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP;

-- Add comment for documentation
COMMENT ON COLUMN service_requests.start_time IS 'Actual service start time when technician clicks Start Service in WhatsApp';
