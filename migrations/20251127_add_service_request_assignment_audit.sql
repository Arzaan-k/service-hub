-- Ensure assignment audit columns exist on service_requests.
-- Older databases might be missing these even though the application expects them.

ALTER TABLE service_requests
    ADD COLUMN IF NOT EXISTS assigned_by text,
    ADD COLUMN IF NOT EXISTS assigned_at timestamptz;


