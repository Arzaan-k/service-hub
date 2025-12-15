-- Migration: Add password escalation tracking field
-- This field tracks when an escalation email was sent to the expert technician
-- for technicians who haven't set their password after the reminder

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_escalation_sent_at TIMESTAMP;

-- Add comment for documentation
COMMENT ON COLUMN users.password_escalation_sent_at IS 'Tracks when escalation email was sent to expert technician for password setup';

