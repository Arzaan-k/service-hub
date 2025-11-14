-- Add fields from Container Master Sheet to containers table

-- Product information fields
ALTER TABLE containers ADD COLUMN IF NOT EXISTS product_type TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS size_type TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS group_name TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS gku_product_name TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS category TEXT; -- Condition and usage state
ALTER TABLE containers ADD COLUMN IF NOT EXISTS size INTEGER;

-- Location and depot information
ALTER TABLE containers ADD COLUMN IF NOT EXISTS depot TEXT;

-- Container details
ALTER TABLE containers ADD COLUMN IF NOT EXISTS yom INTEGER; -- Year of Manufacture
ALTER TABLE containers ADD COLUMN IF NOT EXISTS grade TEXT;

-- Reefer specific fields
ALTER TABLE containers ADD COLUMN IF NOT EXISTS reefer_unit TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS reefer_model TEXT;

-- Image and documentation
ALTER TABLE containers ADD COLUMN IF NOT EXISTS image_links TEXT;

-- Master sheet metadata (store complete row as JSON for reference)
ALTER TABLE containers ADD COLUMN IF NOT EXISTS master_sheet_data JSONB;

-- Create indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_containers_product_type ON containers(product_type);
CREATE INDEX IF NOT EXISTS idx_containers_status_master ON containers(status);
CREATE INDEX IF NOT EXISTS idx_containers_location ON containers(depot);
CREATE INDEX IF NOT EXISTS idx_containers_grade ON containers(grade);
CREATE INDEX IF NOT EXISTS idx_containers_yom ON containers(yom);
CREATE INDEX IF NOT EXISTS idx_containers_category ON containers(category);

-- Add comment explaining master sheet data
COMMENT ON COLUMN containers.master_sheet_data IS 'Complete row data from Container Master Sheet for reference and auditing';

COMMENT ON COLUMN containers.product_type IS 'Product type from master sheet (e.g., Reefer, Dry, etc.)';
COMMENT ON COLUMN containers.size_type IS 'Size type from master sheet (e.g., 40FT 2BAY with Ante Room)';
COMMENT ON COLUMN containers.group_name IS 'Group classification from master sheet';
COMMENT ON COLUMN containers.gku_product_name IS 'GKU product code from master sheet';
COMMENT ON COLUMN containers.category IS 'Condition and usage state (e.g., Refurbished, New)';
COMMENT ON COLUMN containers.depot IS 'Current depot/customer location from master sheet';
COMMENT ON COLUMN containers.yom IS 'Year of Manufacture';
COMMENT ON COLUMN containers.grade IS 'Container grade (A, B, C, etc.)';
COMMENT ON COLUMN containers.reefer_unit IS 'Reefer unit brand (e.g., Daikin, Carrier)';
COMMENT ON COLUMN containers.reefer_model IS 'Reefer unit model name';
COMMENT ON COLUMN containers.image_links IS 'Links to container images/documentation';
