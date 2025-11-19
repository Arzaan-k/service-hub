-- Non-destructive migration: add CSV-derived columns to public.containers
-- This file ONLY adds columns if they do not already exist.
-- No drops, renames, or destructive changes.

-- Identification and general
ALTER TABLE containers ADD COLUMN IF NOT EXISTS sr_no INTEGER;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS container_no TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS product_type TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS size INTEGER;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS size_type TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS group_name TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS gku_product_name TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS available_location TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS depot TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS mfg_year INTEGER;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS inventory_status TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS current TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS images_pti_survey TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS grade TEXT;

-- Dates and numeric
ALTER TABLE containers ADD COLUMN IF NOT EXISTS purchase_date DATE;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS temperature DOUBLE PRECISION;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS domestication TEXT;

-- Reefer unit details
ALTER TABLE containers ADD COLUMN IF NOT EXISTS reefer_unit TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS reefer_unit_model_name TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS reefer_unit_serial_no TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS controller_configuration_number TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS controller_version TEXT;

-- Purchase and logistics
ALTER TABLE containers ADD COLUMN IF NOT EXISTS city_of_purchase TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS purchase_yard_details TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS cro_number TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS brand_new_used TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS date_of_arrival_in_depot DATE;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS in_house_run_test_report TEXT;

-- Condition and attributes
ALTER TABLE containers ADD COLUMN IF NOT EXISTS condition TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS curtains TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS lights TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS colour TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS logo_sticker TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS repair_remarks TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS estimated_cost_for_repair DOUBLE PRECISION;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS crystal_smart_sr_no TEXT;

-- Dispatch / booking
ALTER TABLE containers ADD COLUMN IF NOT EXISTS booking_order_number TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS do_number TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS dispatch_date DATE;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS no_of_days INTEGER;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS dispatch_location TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS set_temperature_during_dispatch_live DOUBLE PRECISION;

-- Ownership / status
ALTER TABLE containers ADD COLUMN IF NOT EXISTS assets_belong_to TEXT;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS blocked BOOLEAN;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS remark TEXT;


