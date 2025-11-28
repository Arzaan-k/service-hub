-- Add location columns to technicians table for WhatsApp location sharing feature
-- These columns store the technician's current location shared via WhatsApp

ALTER TABLE technicians 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7);

ALTER TABLE technicians 
ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7);

ALTER TABLE technicians 
ADD COLUMN IF NOT EXISTS location_address TEXT;

ALTER TABLE technicians 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Add comments for documentation
COMMENT ON COLUMN technicians.latitude IS 'Current latitude from WhatsApp location sharing';
COMMENT ON COLUMN technicians.longitude IS 'Current longitude from WhatsApp location sharing';
COMMENT ON COLUMN technicians.location_address IS 'Full formatted address from reverse geocoding';
