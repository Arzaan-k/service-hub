-- Add container_ownership_history table
CREATE TABLE IF NOT EXISTS container_ownership_history (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id VARCHAR NOT NULL REFERENCES containers(id),
  customer_id VARCHAR NOT NULL REFERENCES customers(id),
  order_type TEXT NOT NULL,
  quotation_no TEXT,
  order_received_number TEXT,
  internal_sales_order_no TEXT,
  purchase_order_number TEXT,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  tenure JSONB,
  basic_amount DECIMAL(10, 2),
  security_deposit DECIMAL(10, 2),
  is_current BOOLEAN NOT NULL DEFAULT true,
  purchase_details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add new fields to service_requests table
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS job_order TEXT UNIQUE;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS work_type TEXT;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS client_type TEXT;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS job_type TEXT;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS billing_type TEXT;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS call_status TEXT;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS month TEXT;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS excel_data JSONB;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_container_ownership_container_id ON container_ownership_history(container_id);
CREATE INDEX IF NOT EXISTS idx_container_ownership_customer_id ON container_ownership_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_container_ownership_is_current ON container_ownership_history(is_current);
CREATE INDEX IF NOT EXISTS idx_service_requests_job_order ON service_requests(job_order);
