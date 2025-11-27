-- Add requires_password_reset column to users table
ALTER TABLE users ADD COLUMN requires_password_reset BOOLEAN DEFAULT false NOT NULL;

-- Update comment for clarity
COMMENT ON COLUMN users.requires_password_reset IS 'Flag indicating if user must reset password on next login';


