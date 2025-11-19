-- Safe, non-destructive additions for Reefer Container Master fields
-- This migration only adds columns and indexes if they do not already exist.
-- It will not drop or modify any existing columns or data.

-- Product information fields
ALTER TABLE containers ADD COLUMN IF NOT EXISTS product_type TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS size_type TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS group_name TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS gku_product_name TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS size INTEGER;

-- Location and depot information
ALTER TABLE containers ADD COLUMN IF NOT EXISTS depot TEXT;

-- Container details
ALTER TABLE containers ADD COLUMN IF NOT EXISTS yom INTEGER;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS grade TEXT;

-- Reefer specific fields
ALTER TABLE containers ADD COLUMN IF NOT EXISTS reefer_unit TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS reefer_model TEXT;

-- Images and full master sheet row
ALTER TABLE containers ADD COLUMN IF NOT EXISTS image_links TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS master_sheet_data JSONB;

-- Helpful indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_containers_product_type ON containers(product_type);
CREATE INDEX IF NOT EXISTS idx_containers_depot ON containers(depot);
CREATE INDEX IF NOT EXISTS idx_containers_grade ON containers(grade);
CREATE INDEX IF NOT EXISTS idx_containers_yom ON containers(yom);
CREATE INDEX IF NOT EXISTS idx_containers_category ON containers(category);

-- Documentation
COMMENT ON COLUMN containers.master_sheet_data IS 'Complete row data from Reefer Container Master file for auditing';

