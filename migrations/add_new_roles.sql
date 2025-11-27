-- Migration to add senior_technician and amc roles to user_role enum
-- Date: 2025-11-26

-- Step 1: Add new values to the user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'senior_technician';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'amc';

-- Note: The changes are non-destructive and backward compatible
-- Existing users will retain their current roles
