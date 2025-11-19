/**
 * COMPREHENSIVE SERVICE HISTORY SCHEMA
 *
 * This schema captures ALL data from the "Service Master.xlsx" file (158 columns)
 * organized into normalized tables following the 7-stage service workflow:
 *
 * 1. Complaint Registration
 * 2. Job Assignment
 * 3. Indent/Parts Request
 * 4. Material Arrangement
 * 5. Material Dispatch
 * 6. Service Execution
 * 7. Closure & Follow-up
 *
 * Based on comprehensive analysis of 1,645 service records spanning 2 years.
 */

import { pgTable, text, varchar, timestamp, boolean, integer, jsonb, decimal } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ============================================================================
// ENHANCED SERVICE REQUESTS TABLE
// ============================================================================
// Extends the existing service_requests table with all Excel fields

export const serviceHistory = pgTable("service_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // ===== CORE IDENTIFIERS =====
  jobOrderNumber: text("job_order_number").notNull().unique(), // Column 1: PRIMARY KEY (JUL001, AUG015, etc.)
  serviceRequestId: varchar("service_request_id"), // Link to existing service_requests table

  // ===== STAGE 1: COMPLAINT REGISTRATION (Columns 1-16) =====
  complaintRegistrationTime: timestamp("complaint_registration_time"), // Column 2
  complaintRegisteredBy: text("complaint_registered_by"), // Column 3: Email
  clientName: text("client_name").notNull(), // Column 4
  contactPersonName: text("contact_person_name"), // Column 5
  contactPersonNumber: text("contact_person_number"), // Column 6
  contactPersonDesignation: text("contact_person_designation"), // Column 7
  containerNumber: text("container_number").notNull(), // Column 8: ASSET ID
  initialComplaint: text("initial_complaint"), // Column 9
  complaintRemarks: text("complaint_remarks"), // Column 10
  clientEmail: text("client_email"), // Column 11
  clientLocation: text("client_location"), // Column 12
  machineStatus: text("machine_status"), // Column 13

  // ===== STAGE 2: JOB ASSIGNMENT (Columns 17-41) =====
  assignmentTime: timestamp("assignment_time"), // Column 17
  assignedBy: text("assigned_by"), // Column 18: Email
  containerSize: text("container_size"), // Column 21: 40-REEFER, 20-REEFER
  machineMake: text("machine_make"), // Column 22: DAIKIN, CARRIER, THERMOKING
  workType: text("work_type"), // Column 23: SERVICE-AT SITE, INSTALLATION
  clientType: text("client_type"), // Column 24: LEASE, SALE, STOCK
  jobType: text("job_type"), // Column 25: FOC, PAID, AMC
  issuesFound: text("issues_found"), // Column 26: Diagnosis
  remedialAction: text("remedial_action"), // Column 27: Solution/action
  listOfSparesRequired: text("list_of_spares_required"), // Column 28
  reasonCause: text("reason_cause"), // Column 30
  formLink: text("form_link"), // Column 31: Google Form URL
  reeferUnit: text("reefer_unit"), // Column 32: Brand (Daikin, Carrier)
  reeferUnitModelName: text("reefer_unit_model_name"), // Column 33
  reeferUnitSerialNo: text("reefer_unit_serial_no"), // Column 34
  controllerConfigNumber: text("controller_config_number"), // Column 35
  controllerVersion: text("controller_version"), // Column 36
  equipmentCondition: text("equipment_condition"), // Column 37: Brand new/Used
  crystalSmartSerialNo: text("crystal_smart_serial_no"), // Column 38
  technicianName: text("technician_name"), // Column 39: ASSIGNED TECHNICIAN

  // ===== STAGE 3: INDENT/PARTS REQUEST (Columns 42-53) =====
  indentRequestTime: timestamp("indent_request_time"), // Column 42
  indentRequestedBy: text("indent_requested_by"), // Column 43
  indentRequired: boolean("indent_required"), // Column 44
  indentNo: text("indent_no"), // Column 45: Indent ID (JUL064, etc.)
  indentDate: timestamp("indent_date"), // Column 46
  indentType: text("indent_type"), // Column 47
  indentClientLocation: text("indent_client_location"), // Column 49
  whereToUse: text("where_to_use"), // Column 51: SITE
  billingType: text("billing_type"), // Column 52: FOC, PAID

  // ===== STAGE 4: MATERIAL ARRANGEMENT (Columns 54-60) =====
  materialArrangementTime: timestamp("material_arrangement_time"), // Column 54
  materialArrangedBy: text("material_arranged_by"), // Column 55
  sparesRequired: boolean("spares_required"), // Column 56
  requiredMaterialArranged: boolean("required_material_arranged"), // Column 58
  purchaseOrder: text("purchase_order"), // Column 59
  materialArrangedFrom: text("material_arranged_from"), // Column 60

  // ===== STAGE 5: MATERIAL DISPATCH (Columns 61-70) =====
  materialDispatchTime: timestamp("material_dispatch_time"), // Column 61
  materialDispatchedBy: text("material_dispatched_by"), // Column 62
  materialSentThrough: text("material_sent_through"), // Column 65: COURIER/TECHNICIAN
  courierName: text("courier_name"), // Column 66
  courierTrackingId: text("courier_tracking_id"), // Column 67
  courierContactNumber: text("courier_contact_number"), // Column 68
  estimatedDeliveryDate: timestamp("estimated_delivery_date"), // Column 69
  deliveryRemarks: text("delivery_remarks"), // Column 70

  // ===== STAGE 6: SERVICE EXECUTION (Columns 71-119) =====
  serviceFormSubmissionTime: timestamp("service_form_submission_time"), // Column 71
  complaintAttendedDate: timestamp("complaint_attended_date"), // Column 72: ★ ACTUAL SERVICE DATE (nullable for pending services)
  serviceType: text("service_type"), // Column 73: Lease, Paid, Free of Cost
  complaintReceivedBy: text("complaint_received_by"), // Column 74: EMAIL, Phone, Regular Visit
  serviceClientLocation: text("service_client_location"), // Column 76
  containerSizeService: text("container_size_service"), // Column 78: 40FT, 20FT
  callAttendedType: text("call_attended_type"), // Column 79: SERVICE-AT SITE
  issueComplaintLogged: text("issue_complaint_logged"), // Column 80: Problem description
  reeferMakeModel: text("reefer_make_model"), // Column 81
  operatingTemperature: text("operating_temperature"), // Column 82

  // === EQUIPMENT INSPECTION (Columns 83-113): 28 Inspection Points ===
  containerCondition: text("container_condition"), // Column 83
  condenserCoil: text("condenser_coil"), // Column 84
  condenserCoilImage: text("condenser_coil_image"), // Column 85
  condenserMotor: text("condenser_motor"), // Column 86
  evaporatorCoil: text("evaporator_coil"), // Column 87
  evaporatorMotor: text("evaporator_motor"), // Column 88
  compressorOil: text("compressor_oil"), // Column 89
  refrigerantGas: text("refrigerant_gas"), // Column 91
  controllerDisplay: text("controller_display"), // Column 93
  controllerKeypad: text("controller_keypad"), // Column 95
  powerCable: text("power_cable"), // Column 97
  machineMainBreaker: text("machine_main_breaker"), // Column 99
  compressorContactor: text("compressor_contactor"), // Column 100
  evpCondContactor: text("evp_cond_contactor"), // Column 102
  customerMainMcb: text("customer_main_mcb"), // Column 104
  customerMainCable: text("customer_main_cable"), // Column 105
  flpSocketCondition: text("flp_socket_condition"), // Column 106
  alarmListClear: text("alarm_list_clear"), // Column 107
  filterDrier: text("filter_drier"), // Column 108
  pressure: text("pressure"), // Column 110
  compressorCurrent: text("compressor_current"), // Column 111
  mainVoltage: text("main_voltage"), // Column 112
  pti: text("pti"), // Column 113: Performance Test Indicator

  // === DOCUMENTATION (Columns 114-119) ===
  observations: text("observations"), // Column 114
  workDescription: text("work_description"), // Column 115: Technician Comments
  requiredSpareParts: text("required_spare_parts"), // Column 116: Consumables
  signJobOrderFront: text("sign_job_order_front"), // Column 117
  signJobOrderBack: text("sign_job_order_back"), // Column 118
  signJobOrder: text("sign_job_order"), // Column 119: Signature URL

  // ===== STAGE 7: CLOSURE & FOLLOW-UP (Columns 120-128) =====
  tripNo: text("trip_no"), // Column 121
  anyPendingJob: boolean("any_pending_job"), // Column 122
  nextServiceCallRequired: boolean("next_service_call_required"), // Column 123
  nextServiceUrgency: text("next_service_urgency"), // Column 124
  pendingJobDetails: text("pending_job_details"), // Column 125

  // ===== METADATA & ADMIN =====
  rawExcelData: jsonb("raw_excel_data"), // Store complete row data from Excel
  dataImportedAt: timestamp("data_imported_at").defaultNow(),
  dataSource: text("data_source").default("excel_import"), // excel_import, manual, api

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// STANDARDIZATION LOOKUP TABLES
// ============================================================================
// These tables help normalize inconsistent Excel data

export const manufacturerStandards = pgTable("manufacturer_standards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  standardName: text("standard_name").notNull().unique(), // DAIKIN, CARRIER, THERMOKING
  variations: text("variations").array().notNull(), // ['Daikin', 'DAikin', 'DAIKIN']
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const containerSizeStandards = pgTable("container_size_standards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  standardSize: text("standard_size").notNull().unique(), // 40FT, 20FT, 40HC
  variations: text("variations").array().notNull(), // ['40 FT', '40FT', '40-REEFER']
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const locationStandards = pgTable("location_standards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  standardLocation: text("standard_location").notNull().unique(), // Visakhapatnam
  variations: text("variations").array().notNull(), // ['Vizag', 'Visakhapatnam', 'VIZAG']
  city: text("city"),
  state: text("state"),
  country: text("country").default("India"),
  coordinates: jsonb("coordinates"), // {lat, lng}
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================================
// SERVICE STATISTICS & ANALYTICS
// ============================================================================
// Materialized view for quick analytics

export const serviceStatistics = pgTable("service_statistics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Technician Performance
  technicianName: text("technician_name").notNull(),
  totalJobs: integer("total_jobs").default(0),
  completedJobs: integer("completed_jobs").default(0),
  averageJobDuration: integer("average_job_duration"), // minutes

  // Container Performance
  containerNumber: text("container_number"),
  totalServiceVisits: integer("total_service_visits").default(0),
  lastServiceDate: timestamp("last_service_date"),
  nextServiceDue: timestamp("next_service_due"),

  // Client Metrics
  clientName: text("client_name"),
  totalServicesReceived: integer("total_services_received").default(0),

  // Common Issues
  issueCategory: text("issue_category"),
  issueCount: integer("issue_count").default(0),

  // Time Metrics
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),

  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// EQUIPMENT INSPECTION CHECKLIST TEMPLATE
// ============================================================================
// Defines the standard 28-point inspection checklist

export const inspectionChecklistTemplate = pgTable("inspection_checklist_template", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(), // Physical, Heat Exchange, Refrigeration, Control, Electrical, Performance
  fieldName: text("field_name").notNull().unique(),
  displayLabel: text("display_label").notNull(),
  fieldType: text("field_type").notNull(), // text, boolean, select, number
  options: text("options").array(), // For select fields: ['OK', 'DIRTY', 'NEED CLEANING']
  isRequired: boolean("is_required").default(true),
  sortOrder: integer("sort_order").notNull(),
  helpText: text("help_text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================================
// PARTS INDENT MANAGEMENT
// ============================================================================
// Track parts requests separately for better inventory management

export const indents = pgTable("indents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  indentNumber: text("indent_number").notNull().unique(), // JUL064, AUG120
  serviceHistoryId: varchar("service_history_id").references(() => serviceHistory.id),
  serviceRequestId: varchar("service_request_id"),

  indentDate: timestamp("indent_date").notNull(),
  indentType: text("indent_type"), // EMERGENCY, REGULAR, PM
  requestedBy: text("requested_by").notNull(),

  partsRequested: jsonb("parts_requested").notNull(), // [{partName, quantity, reason}]
  whereToUse: text("where_to_use"), // SITE, WORKSHOP, DEPOT
  billingType: text("billing_type"), // FOC, PAID

  materialArranged: boolean("material_arranged").default(false),
  materialArrangedAt: timestamp("material_arranged_at"),
  materialArrangedBy: text("material_arranged_by"),
  materialSource: text("material_source"), // STOCK, PURCHASE, VENDOR

  dispatched: boolean("dispatched").default(false),
  dispatchedAt: timestamp("dispatched_at"),
  dispatchMethod: text("dispatch_method"), // COURIER, TECHNICIAN, PICKUP
  trackingNumber: text("tracking_number"),

  partsUsed: jsonb("parts_used"), // Actual consumption: [{partName, quantityUsed}]
  status: text("status").notNull().default("requested"), // requested, arranged, dispatched, received, used

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// EXPORT TYPES FOR USE IN APPLICATION
// ============================================================================

export type ServiceHistory = typeof serviceHistory.$inferSelect;
export type NewServiceHistory = typeof serviceHistory.$inferInsert;
export type ServiceStatistics = typeof serviceStatistics.$inferSelect;
export type Indent = typeof indents.$inferSelect;
export type NewIndent = typeof indents.$inferInsert;
