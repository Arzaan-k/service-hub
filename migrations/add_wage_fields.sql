-- Add wage breakdown fields to technicians table
ALTER TABLE technicians
ADD COLUMN IF NOT EXISTS grade TEXT,
ADD COLUMN IF NOT EXISTS designation TEXT,
ADD COLUMN IF NOT EXISTS hotel_allowance INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS local_travel_allowance INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS food_allowance INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS personal_allowance INTEGER DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN technicians.grade IS 'Technician grade level (e.g., S1, S2, S3)';
COMMENT ON COLUMN technicians.designation IS 'Technician designation (e.g., Sr. Technician, Jr. Technician)';
COMMENT ON COLUMN technicians.hotel_allowance IS 'Daily hotel allowance in rupees';
COMMENT ON COLUMN technicians.local_travel_allowance IS 'Daily local travel allowance in rupees';
COMMENT ON COLUMN technicians.food_allowance IS 'Daily food allowance in rupees';
COMMENT ON COLUMN technicians.personal_allowance IS 'Daily personal allowance (PA) in rupees';
