-- Migration: Add Courier Shipments for Service Request Tracking
-- Description: Track spare parts shipments for service requests using any courier service
-- Date: 2025-11-27

-- Create enum for courier shipment status
CREATE TYPE courier_shipment_status AS ENUM (
  'pending',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'failed',
  'cancelled',
  'returned'
);

-- Create courier_shipments table
CREATE TABLE IF NOT EXISTS courier_shipments (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id VARCHAR NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  awb_number TEXT NOT NULL UNIQUE,
  courier_name TEXT NOT NULL,
  courier_code TEXT,
  shipment_description TEXT,
  origin TEXT,
  destination TEXT,
  estimated_delivery_date TIMESTAMP,
  actual_delivery_date TIMESTAMP,
  status courier_shipment_status DEFAULT 'pending' NOT NULL,
  current_location TEXT,
  tracking_history JSONB,
  last_tracked_at TIMESTAMP,
  raw_api_response JSONB,
  added_by VARCHAR NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX idx_courier_shipments_service_request_id ON courier_shipments(service_request_id);
CREATE INDEX idx_courier_shipments_awb_number ON courier_shipments(awb_number);
CREATE INDEX idx_courier_shipments_status ON courier_shipments(status);
CREATE INDEX idx_courier_shipments_created_at ON courier_shipments(created_at DESC);

-- Add comment to table
COMMENT ON TABLE courier_shipments IS 'Tracks spare parts shipments for service requests via various courier services';
COMMENT ON COLUMN courier_shipments.awb_number IS 'Air Waybill Number / Tracking Number from courier company';
COMMENT ON COLUMN courier_shipments.courier_name IS 'Name of courier company (Delhivery, BlueDart, DTDC, etc.)';
COMMENT ON COLUMN courier_shipments.courier_code IS 'Courier code used by tracking API (e.g., Ship24)';
COMMENT ON COLUMN courier_shipments.tracking_history IS 'Full tracking history with checkpoints and timestamps';
COMMENT ON COLUMN courier_shipments.raw_api_response IS 'Complete API response for debugging and audit';
