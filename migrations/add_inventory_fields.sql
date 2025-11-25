-- Migration: Add Inventory Integration Fields to service_requests table
-- Run this migration when ready to enable full inventory integration

-- Add inventory order tracking fields
ALTER TABLE service_requests 
ADD COLUMN IF NOT EXISTS inventory_order_id TEXT,
ADD COLUMN IF NOT EXISTS inventory_order_number TEXT,
ADD COLUMN IF NOT EXISTS inventory_order_created_at TIMESTAMP;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_service_requests_inventory_order_id 
ON service_requests(inventory_order_id);

-- Add comment
COMMENT ON COLUMN service_requests.inventory_order_id IS 'Order ID from external Inventory Management System';
COMMENT ON COLUMN service_requests.inventory_order_number IS 'Human-readable order number from Inventory System';
COMMENT ON COLUMN service_requests.inventory_order_created_at IS 'Timestamp when order was created in Inventory System';
