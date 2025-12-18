-- Create location_logs table to track technician locations over time
CREATE TABLE IF NOT EXISTS location_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id VARCHAR REFERENCES technicians(id) NOT NULL,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  battery_level INTEGER, -- Battery percentage (0-100)
  speed DECIMAL(6, 2), -- Speed in km/h
  accuracy DECIMAL(8, 2), -- GPS accuracy in meters
  address TEXT, -- Reverse geocoded address
  source TEXT NOT NULL DEFAULT 'app', -- 'app', 'whatsapp', 'manual'
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on employee_id and timestamp for efficient querying of latest locations
CREATE INDEX IF NOT EXISTS idx_location_logs_employee_timestamp
ON location_logs(employee_id, timestamp DESC);

-- Create index on timestamp for time-based queries
CREATE INDEX IF NOT EXISTS idx_location_logs_timestamp
ON location_logs(timestamp DESC);
