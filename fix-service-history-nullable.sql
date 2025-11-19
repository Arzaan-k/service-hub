-- Fix service_history table to allow NULL for complaint_attended_date
-- This allows importing of pending/incomplete service records

ALTER TABLE service_history
ALTER COLUMN complaint_attended_date DROP NOT NULL;

-- Also update the WHERE clause indices to handle NULL dates
DROP INDEX IF EXISTS idx_service_history_service_date;
CREATE INDEX idx_service_history_service_date ON service_history(complaint_attended_date) WHERE complaint_attended_date IS NOT NULL;

-- Add index for pending services (where date is NULL)
CREATE INDEX idx_service_history_pending ON service_history(complaint_registration_time) WHERE complaint_attended_date IS NULL;
