ALTER TABLE service_requests 
ADD COLUMN IF NOT EXISTS inventory_order_id text,
ADD COLUMN IF NOT EXISTS inventory_order_number text,
ADD COLUMN IF NOT EXISTS inventory_order_created_at timestamp;
