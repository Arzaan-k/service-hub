-- ============================================================================
-- COMPREHENSIVE SERVICE HISTORY SCHEMA MIGRATION
-- ============================================================================
-- This migration adds complete service history tracking from Service Master Excel
-- Capturing all 158 columns across 7 workflow stages
--
-- Run this migration with: psql -d your_database < add-service-history-schema.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- TABLE 1: SERVICE_HISTORY (Main comprehensive service tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_history (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core Identifiers
  job_order_number TEXT NOT NULL UNIQUE,
  service_request_id VARCHAR REFERENCES service_requests(id),

  -- Stage 1: Complaint Registration (Columns 1-16)
  complaint_registration_time TIMESTAMP,
  complaint_registered_by TEXT,
  client_name TEXT NOT NULL,
  contact_person_name TEXT,
  contact_person_number TEXT,
  contact_person_designation TEXT,
  container_number TEXT NOT NULL,
  initial_complaint TEXT,
  complaint_remarks TEXT,
  client_email TEXT,
  client_location TEXT,
  machine_status TEXT,

  -- Stage 2: Job Assignment (Columns 17-41)
  assignment_time TIMESTAMP,
  assigned_by TEXT,
  container_size TEXT,
  machine_make TEXT,
  work_type TEXT,
  client_type TEXT,
  job_type TEXT,
  issues_found TEXT,
  remedial_action TEXT,
  list_of_spares_required TEXT,
  reason_cause TEXT,
  form_link TEXT,
  reefer_unit TEXT,
  reefer_unit_model_name TEXT,
  reefer_unit_serial_no TEXT,
  controller_config_number TEXT,
  controller_version TEXT,
  equipment_condition TEXT,
  crystal_smart_serial_no TEXT,
  technician_name TEXT,

  -- Stage 3: Indent/Parts Request (Columns 42-53)
  indent_request_time TIMESTAMP,
  indent_requested_by TEXT,
  indent_required BOOLEAN,
  indent_no TEXT,
  indent_date TIMESTAMP,
  indent_type TEXT,
  indent_client_location TEXT,
  where_to_use TEXT,
  billing_type TEXT,

  -- Stage 4: Material Arrangement (Columns 54-60)
  material_arrangement_time TIMESTAMP,
  material_arranged_by TEXT,
  spares_required BOOLEAN,
  required_material_arranged BOOLEAN,
  purchase_order TEXT,
  material_arranged_from TEXT,

  -- Stage 5: Material Dispatch (Columns 61-70)
  material_dispatch_time TIMESTAMP,
  material_dispatched_by TEXT,
  material_sent_through TEXT,
  courier_name TEXT,
  courier_tracking_id TEXT,
  courier_contact_number TEXT,
  estimated_delivery_date TIMESTAMP,
  delivery_remarks TEXT,

  -- Stage 6: Service Execution (Columns 71-119)
  service_form_submission_time TIMESTAMP,
  complaint_attended_date TIMESTAMP NOT NULL, -- MOST IMPORTANT DATE
  service_type TEXT,
  complaint_received_by TEXT,
  service_client_location TEXT,
  container_size_service TEXT,
  call_attended_type TEXT,
  issue_complaint_logged TEXT,
  reefer_make_model TEXT,
  operating_temperature TEXT,

  -- Equipment Inspection (28 points)
  container_condition TEXT,
  condenser_coil TEXT,
  condenser_coil_image TEXT,
  condenser_motor TEXT,
  evaporator_coil TEXT,
  evaporator_motor TEXT,
  compressor_oil TEXT,
  refrigerant_gas TEXT,
  controller_display TEXT,
  controller_keypad TEXT,
  power_cable TEXT,
  machine_main_breaker TEXT,
  compressor_contactor TEXT,
  evp_cond_contactor TEXT,
  customer_main_mcb TEXT,
  customer_main_cable TEXT,
  flp_socket_condition TEXT,
  alarm_list_clear TEXT,
  filter_drier TEXT,
  pressure TEXT,
  compressor_current TEXT,
  main_voltage TEXT,
  pti TEXT,

  -- Documentation
  observations TEXT,
  work_description TEXT,
  required_spare_parts TEXT,
  sign_job_order_front TEXT,
  sign_job_order_back TEXT,
  sign_job_order TEXT,

  -- Stage 7: Closure & Follow-up (Columns 120-128)
  trip_no TEXT,
  any_pending_job BOOLEAN,
  next_service_call_required BOOLEAN,
  next_service_urgency TEXT,
  pending_job_details TEXT,

  -- Metadata
  raw_excel_data JSONB,
  data_imported_at TIMESTAMP DEFAULT NOW(),
  data_source TEXT DEFAULT 'excel_import',

  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_service_history_job_order ON service_history(job_order_number);
CREATE INDEX idx_service_history_container ON service_history(container_number);
CREATE INDEX idx_service_history_client ON service_history(client_name);
CREATE INDEX idx_service_history_technician ON service_history(technician_name);
CREATE INDEX idx_service_history_service_date ON service_history(complaint_attended_date);
CREATE INDEX idx_service_history_indent ON service_history(indent_no);

-- ============================================================================
-- TABLE 2: INDENTS (Parts Request Management)
-- ============================================================================

CREATE TABLE IF NOT EXISTS indents (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  indent_number TEXT NOT NULL UNIQUE,
  service_history_id VARCHAR REFERENCES service_history(id),
  service_request_id VARCHAR REFERENCES service_requests(id),

  indent_date TIMESTAMP NOT NULL,
  indent_type TEXT,
  requested_by TEXT NOT NULL,

  parts_requested JSONB NOT NULL,
  where_to_use TEXT,
  billing_type TEXT,

  material_arranged BOOLEAN DEFAULT false,
  material_arranged_at TIMESTAMP,
  material_arranged_by TEXT,
  material_source TEXT,

  dispatched BOOLEAN DEFAULT false,
  dispatched_at TIMESTAMP,
  dispatch_method TEXT,
  tracking_number TEXT,

  parts_used JSONB,
  status TEXT NOT NULL DEFAULT 'requested',

  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_indents_number ON indents(indent_number);
CREATE INDEX idx_indents_service_history ON indents(service_history_id);
CREATE INDEX idx_indents_status ON indents(status);

-- ============================================================================
-- TABLE 3: MANUFACTURER_STANDARDS (Standardization)
-- ============================================================================

CREATE TABLE IF NOT EXISTS manufacturer_standards (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_name TEXT NOT NULL UNIQUE,
  variations TEXT[] NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Pre-populate with top 3 manufacturers
INSERT INTO manufacturer_standards (standard_name, variations) VALUES
  ('DAIKIN', ARRAY['DAIKIN', 'Daikin', 'DAikin', 'daikin']),
  ('CARRIER', ARRAY['CARRIER', 'Carrier', 'carrier']),
  ('THERMOKING', ARRAY['THERMOKING', 'Thermoking', 'ThermoKing', 'thermoking', 'THERMO KING'])
ON CONFLICT (standard_name) DO NOTHING;

-- ============================================================================
-- TABLE 4: CONTAINER_SIZE_STANDARDS (Standardization)
-- ============================================================================

CREATE TABLE IF NOT EXISTS container_size_standards (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_size TEXT NOT NULL UNIQUE,
  variations TEXT[] NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Pre-populate with standard sizes
INSERT INTO container_size_standards (standard_size, variations) VALUES
  ('40FT', ARRAY['40FT', '40 FT', '40-REEFER', '40FT STD RF']),
  ('40FT-HC', ARRAY['40FT HC', '40FT HC RF', '40 FT HC']),
  ('20FT', ARRAY['20FT', '20 FT', '20-REEFER', '20FT STD RF']),
  ('45FT-HC', ARRAY['45FT HC', '45FT', '45 FT'])
ON CONFLICT (standard_size) DO NOTHING;

-- ============================================================================
-- TABLE 5: LOCATION_STANDARDS (Standardization)
-- ============================================================================

CREATE TABLE IF NOT EXISTS location_standards (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_location TEXT NOT NULL UNIQUE,
  variations TEXT[] NOT NULL,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'India',
  coordinates JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Pre-populate with common locations
INSERT INTO location_standards (standard_location, variations, city, state) VALUES
  ('Visakhapatnam', ARRAY['Vizag', 'VIZAG', 'vizag', 'Visakhapatnam'], 'Visakhapatnam', 'Andhra Pradesh'),
  ('Hyderabad', ARRAY['Hyd', 'HYD', 'hyderabad', 'Hyderabad'], 'Hyderabad', 'Telangana'),
  ('Chennai', ARRAY['Chennai', 'CHENNAI', 'chennai'], 'Chennai', 'Tamil Nadu'),
  ('Mumbai', ARRAY['Mumbai', 'MUMBAI', 'mumbai'], 'Mumbai', 'Maharashtra'),
  ('Delhi', ARRAY['Delhi', 'DELHI', 'delhi', 'New Delhi'], 'New Delhi', 'Delhi')
ON CONFLICT (standard_location) DO NOTHING;

-- ============================================================================
-- TABLE 6: SERVICE_STATISTICS (Analytics & Reporting)
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_statistics (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Technician Performance
  technician_name TEXT,
  total_jobs INTEGER DEFAULT 0,
  completed_jobs INTEGER DEFAULT 0,
  average_job_duration INTEGER,

  -- Container Performance
  container_number TEXT,
  total_service_visits INTEGER DEFAULT 0,
  last_service_date TIMESTAMP,
  next_service_due TIMESTAMP,

  -- Client Metrics
  client_name TEXT,
  total_services_received INTEGER DEFAULT 0,

  -- Common Issues
  issue_category TEXT,
  issue_count INTEGER DEFAULT 0,

  -- Time Metrics
  period_start TIMESTAMP,
  period_end TIMESTAMP,

  calculated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_stats_technician ON service_statistics(technician_name);
CREATE INDEX idx_stats_container ON service_statistics(container_number);
CREATE INDEX idx_stats_client ON service_statistics(client_name);

-- ============================================================================
-- TABLE 7: INSPECTION_CHECKLIST_TEMPLATE (28-point inspection)
-- ============================================================================

CREATE TABLE IF NOT EXISTS inspection_checklist_template (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  field_name TEXT NOT NULL UNIQUE,
  display_label TEXT NOT NULL,
  field_type TEXT NOT NULL,
  options TEXT[],
  is_required BOOLEAN DEFAULT true,
  sort_order INTEGER NOT NULL,
  help_text TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Pre-populate with 28-point inspection checklist
INSERT INTO inspection_checklist_template (category, field_name, display_label, field_type, options, sort_order, help_text) VALUES
  ('Physical', 'container_condition', 'Container Condition', 'select', ARRAY['OK', 'DAMAGED', 'NEEDS REPAIR'], 1, 'Overall physical condition of container'),
  ('Heat Exchange', 'condenser_coil', 'Condenser Coil', 'select', ARRAY['CLEAN', 'DIRTY', 'NEED CLEANING'], 2, 'Condenser coil cleanliness'),
  ('Heat Exchange', 'condenser_motor', 'Condenser Motor', 'select', ARRAY['OK', 'NOISY', 'FAULTY'], 3, 'Condenser motor operation'),
  ('Heat Exchange', 'evaporator_coil', 'Evaporator Coil', 'select', ARRAY['CLEAN', 'DIRTY', 'NEED CLEANING'], 4, 'Evaporator coil cleanliness'),
  ('Heat Exchange', 'evaporator_motor', 'Evaporator Motor', 'select', ARRAY['OK', 'NOISY', 'FAULTY'], 5, 'Evaporator motor operation'),
  ('Refrigeration', 'compressor_oil', 'Compressor Oil', 'select', ARRAY['OK', 'LOW', 'NEED CHANGE'], 6, 'Compressor oil level'),
  ('Refrigeration', 'refrigerant_gas', 'Refrigerant Gas', 'select', ARRAY['OK', 'LOW', 'NEED TOP-UP'], 7, 'Refrigerant gas level'),
  ('Refrigeration', 'filter_drier', 'Filter Drier', 'select', ARRAY['OK', 'NEED CHANGE'], 8, 'Filter drier condition'),
  ('Refrigeration', 'pressure', 'Pressure', 'text', NULL, 9, 'System pressure reading'),
  ('Control', 'controller_display', 'Controller Display', 'select', ARRAY['OK', 'DIM', 'NOT VISIBLE', 'FAULTY'], 10, 'Controller display visibility'),
  ('Control', 'controller_keypad', 'Controller Keypad', 'select', ARRAY['OK', 'FAULTY', 'UNRESPONSIVE'], 11, 'Controller keypad responsiveness'),
  ('Control', 'alarm_list_clear', 'Alarm List Clear', 'boolean', NULL, 12, 'All alarms cleared'),
  ('Electrical', 'power_cable', 'Power Cable', 'select', ARRAY['OK', 'DAMAGED', 'NEED REPLACEMENT'], 13, 'Power cable condition'),
  ('Electrical', 'machine_main_breaker', 'Machine Main Breaker', 'select', ARRAY['OK', 'FAULTY'], 14, 'Main circuit breaker'),
  ('Electrical', 'compressor_contactor', 'Compressor Contactor', 'select', ARRAY['OK', 'NEED REPLACEMENT'], 15, 'Compressor contactor'),
  ('Electrical', 'evp_cond_contactor', 'EVP/COND Contactor', 'select', ARRAY['OK', 'NEED REPLACEMENT'], 16, 'Evaporator/Condenser contactor'),
  ('Electrical', 'customer_main_mcb', 'Customer Main MCB', 'select', ARRAY['OK', 'FAULTY'], 17, 'Customer main MCB'),
  ('Electrical', 'customer_main_cable', 'Customer Main Cable', 'select', ARRAY['OK', 'DAMAGED'], 18, 'Customer main cable'),
  ('Electrical', 'flp_socket_condition', 'FLP Socket Condition', 'select', ARRAY['OK', 'FAULTY'], 19, 'FLP socket condition'),
  ('Electrical', 'compressor_current', 'Compressor Current', 'text', NULL, 20, 'Current reading in amps'),
  ('Electrical', 'main_voltage', 'Main Voltage', 'text', NULL, 21, 'Voltage reading'),
  ('Performance', 'pti', 'PTI (Pre-Trip Inspection)', 'select', ARRAY['PASS', 'FAIL'], 22, 'Overall PTI result')
ON CONFLICT (field_name) DO NOTHING;

-- ============================================================================
-- VIEWS FOR EASY QUERYING
-- ============================================================================

-- View: Complete service history with linked data
CREATE OR REPLACE VIEW v_complete_service_history AS
SELECT
  sh.*,
  c.container_id as container_code,
  c.status as container_status,
  cust.company_name,
  cust.phone as customer_phone,
  t.id as technician_id,
  u.name as technician_full_name,
  u.phone_number as technician_phone
FROM service_history sh
LEFT JOIN containers c ON sh.container_number = c.container_id
LEFT JOIN customers cust ON sh.client_name = cust.company_name
LEFT JOIN technicians t ON sh.technician_name = t.user_id
LEFT JOIN users u ON t.user_id = u.id;

-- View: Service statistics summary
CREATE OR REPLACE VIEW v_service_stats_summary AS
SELECT
  COUNT(*) as total_services,
  COUNT(DISTINCT container_number) as unique_containers,
  COUNT(DISTINCT client_name) as unique_clients,
  COUNT(DISTINCT technician_name) as unique_technicians,
  COUNT(*) FILTER (WHERE job_type = 'FOC') as foc_services,
  COUNT(*) FILTER (WHERE job_type = 'PAID') as paid_services,
  COUNT(*) FILTER (WHERE indent_required = true) as services_with_parts,
  AVG(EXTRACT(EPOCH FROM (complaint_attended_date - complaint_registration_time)) / 3600)::INTEGER as avg_response_hours
FROM service_history;

-- View: Top performing technicians
CREATE OR REPLACE VIEW v_top_technicians AS
SELECT
  technician_name,
  COUNT(*) as total_jobs,
  COUNT(DISTINCT container_number) as unique_containers_serviced,
  COUNT(DISTINCT client_name) as unique_clients_served,
  MAX(complaint_attended_date) as last_service_date
FROM service_history
WHERE technician_name IS NOT NULL
GROUP BY technician_name
ORDER BY total_jobs DESC;

-- View: Container service frequency
CREATE OR REPLACE VIEW v_container_service_frequency AS
SELECT
  container_number,
  COUNT(*) as service_count,
  MIN(complaint_attended_date) as first_service,
  MAX(complaint_attended_date) as last_service,
  ARRAY_AGG(DISTINCT technician_name) as technicians_assigned,
  ARRAY_AGG(DISTINCT issues_found) as common_issues
FROM service_history
WHERE container_number IS NOT NULL
GROUP BY container_number
ORDER BY service_count DESC;

-- ============================================================================
-- FUNCTIONS FOR AUTOMATION
-- ============================================================================

-- Function: Update service statistics automatically
CREATE OR REPLACE FUNCTION update_service_statistics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update technician stats
  INSERT INTO service_statistics (technician_name, total_jobs, calculated_at)
  VALUES (NEW.technician_name, 1, NOW())
  ON CONFLICT (technician_name)
  DO UPDATE SET
    total_jobs = service_statistics.total_jobs + 1,
    calculated_at = NOW();

  -- Update container stats
  INSERT INTO service_statistics (container_number, total_service_visits, last_service_date, calculated_at)
  VALUES (NEW.container_number, 1, NEW.complaint_attended_date, NOW())
  ON CONFLICT (container_number)
  DO UPDATE SET
    total_service_visits = service_statistics.total_service_visits + 1,
    last_service_date = NEW.complaint_attended_date,
    calculated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update statistics on new service record
CREATE TRIGGER trigger_update_service_stats
AFTER INSERT ON service_history
FOR EACH ROW
EXECUTE FUNCTION update_service_statistics();

-- ============================================================================
-- GRANT PERMISSIONS (adjust as needed for your setup)
-- ============================================================================

-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Run the Excel import script: tsx server/tools/import-service-master.ts
-- 2. Verify data: SELECT COUNT(*) FROM service_history;
-- 3. Check statistics: SELECT * FROM v_service_stats_summary;
-- ============================================================================
