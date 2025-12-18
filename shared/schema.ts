import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb, pgEnum, decimal, uuid, point, customType, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums according to PRD
export const userRoleEnum = pgEnum("user_role", ["admin", "client", "technician", "coordinator", "super_admin", "senior_technician", "amc"]);
export const containerStatusEnum = pgEnum("container_status", ["active", "in_service", "maintenance", "retired", "in_transit", "stock", "sold"]);
// Use existing enum from database
export const containerTypeEnum = pgEnum("container_type", ["refrigerated", "dry", "special", "iot_enabled", "manual"]);
export const alertSeverityEnum = pgEnum("alert_severity", ["critical", "high", "medium", "low"]);
export const alertStatusEnum = pgEnum("alert_status", ["open", "acknowledged", "resolved", "closed"]);
export const alertTypeEnum = pgEnum("alert_type", ["error", "warning", "info", "temperature", "power", "connectivity", "door", "system"]);
export const alertSourceEnum = pgEnum("alert_source", ["orbcomm", "manual", "predictive", "simulation"]);
export const serviceStatusEnum = pgEnum("service_status", ["pending", "approved", "scheduled", "in_progress", "completed", "cancelled"]);
export const servicePriorityEnum = pgEnum("service_priority", ["urgent", "high", "normal", "low"]);
export const technicianStatusEnum = pgEnum("technician_status", ["available", "on_duty", "busy", "off_duty"]);
// Removed technicianExperienceEnum - using text instead
export const invoiceStatusEnum = pgEnum("invoice_status", ["pending", "partially_paid", "paid", "overdue", "cancelled"]);

// Custom type for bytea (binary data) to store file buffers
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
  toDriver(value: Buffer): Buffer {
    return value;
  },
  fromDriver(value: Buffer): Buffer {
    return value;
  },
});
export const customerTierEnum = pgEnum("customer_tier", ["premium", "standard", "basic"]);
export const paymentTermsEnum = pgEnum("payment_terms", ["prepaid", "net15", "net30"]);
export const customerStatusEnum = pgEnum("customer_status", ["active", "inactive", "suspended"]);
export const whatsappMessageTypeEnum = pgEnum("whatsapp_message_type", ["text", "template", "interactive", "media", "flow", "image", "video", "document", "audio"]);
export const whatsappMessageStatusEnum = pgEnum("whatsapp_message_status", ["sent", "delivered", "read", "failed", "received"]);
export const whatsappRecipientTypeEnum = pgEnum("whatsapp_recipient_type", ["customer", "technician", "admin"]);
export const scheduledServiceStatusEnum = pgEnum("scheduled_service_status", ["scheduled", "in_progress", "completed", "rescheduled", "cancelled"]);
export const feedbackRatingEnum = pgEnum("feedback_rating", ["1", "2", "3", "4", "5"]);
export const resolutionMethodEnum = pgEnum("resolution_method", ["auto", "service", "diy", "ignored"]);
export const pmStatusEnum = pgEnum("pm_status_enum", ["UP_TO_DATE", "DUE_SOON", "OVERDUE"]);
// Technician Travel Planning enums
export const tripStatusEnum = pgEnum("trip_status", ["planned", "confirmed", "booked", "in_progress", "completed", "cancelled"]);
export const bookingStatusEnum = pgEnum("booking_status", ["not_started", "tickets_booked", "hotel_booked", "all_confirmed"]);
export const tripPurposeEnum = pgEnum("trip_purpose", ["pm", "breakdown", "audit", "mixed"]);
export const tripTaskTypeEnum = pgEnum("trip_task_type", ["pm", "alert", "inspection"]);
export const tripTaskStatusEnum = pgEnum("trip_task_status", ["pending", "in_progress", "completed", "cancelled"]);
// Courier tracking enums
export const courierShipmentStatusEnum = pgEnum("courier_shipment_status", ["pending", "in_transit", "out_for_delivery", "delivered", "failed", "cancelled", "returned"]);

// Users table (matching actual database schema)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumber: text("phone_number").notNull().unique(),
  name: text("name").notNull(),
  email: text("email"),
  role: userRoleEnum("role").notNull().default("client"),
  password: text("password"),
  isActive: boolean("is_active").default(true).notNull(),
  whatsappVerified: boolean("whatsapp_verified").default(false).notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  requiresPasswordReset: boolean("requires_password_reset").default(false).notNull(),
  passwordReminderSentAt: timestamp("password_reminder_sent_at"), // Tracks when 24-hour password reminder was sent
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}) as any;

// Customers table (renamed from clients according to PRD)
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  companyName: text("company_name").notNull(),
  contactPerson: text("contact_person").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull().unique(),
  whatsappNumber: text("whatsapp_number").notNull().unique(),
  customerTier: customerTierEnum("customer_tier").notNull().default("standard"),
  paymentTerms: paymentTermsEnum("payment_terms").notNull().default("net30"),
  billingAddress: text("billing_address").notNull(),
  shippingAddress: text("shipping_address"),
  gstin: text("gstin"),
  accountManagerId: varchar("account_manager_id").references(() => users.id),
  status: customerStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}) as any;

// Technicians table (enhanced according to PRD)
export const technicians = pgTable("technicians", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  employeeCode: text("tech_number").notNull().unique(), // Using tech_number from existing DB
  experienceLevel: text("experience_level").notNull(), // Using text from existing DB
  skills: text("skills").array().notNull(), // array from existing DB
  baseLocation: jsonb("home_location"), // Using home_location from existing DB
  serviceAreas: text("service_areas").array(),
  status: technicianStatusEnum("status").notNull().default("available"),
  averageRating: integer("average_rating"),
  totalJobsCompleted: integer("total_jobs"),

  // Wage breakdown fields
  grade: text("grade"), // e.g., "S1", "S2", "S3"
  designation: text("designation"), // e.g., "Sr. Technician", "Jr. Technician"
  hotelAllowance: integer("hotel_allowance").default(0),
  localTravelAllowance: integer("local_travel_allowance").default(0),
  foodAllowance: integer("food_allowance").default(0),
  personalAllowance: integer("personal_allowance").default(0),
  serviceRequestCost: integer("service_request_cost").default(0), // Cost per service request
  pmCost: integer("pm_cost").default(0), // Cost per preventive maintenance task
  tasksPerDay: integer("tasks_per_day").default(3), // Rate: Number of tasks per day for trip planning

  // Current location fields (updated via WhatsApp location sharing)
  latitude: decimal("latitude", { precision: 10, scale: 7 }), // e.g., 19.0760000
  longitude: decimal("longitude", { precision: 10, scale: 7 }), // e.g., 72.8777000
  locationAddress: text("location_address"), // Full formatted address from reverse geocoding

  // Password setup and document submission fields
  passwordSetupToken: varchar("password_setup_token", { length: 255 }),
  passwordSetupTokenExpiry: timestamp("password_setup_token_expiry"),
  documentsSubmitted: boolean("documents_submitted").default(false),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Technician Documents table - Stores documents submitted by technicians
export const technicianDocuments = pgTable("technician_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  technicianId: varchar("technician_id").references(() => technicians.id, { onDelete: "cascade" }).notNull(),
  documentType: varchar("document_type", { length: 100 }).notNull(), // 'aadhar', 'health_report', 'cbc_report', 'insurance_report'
  filename: varchar("filename", { length: 255 }).notNull(),
  fileUrl: text("file_url"), // Optional now that we store in DB
  fileData: bytea("file_data"), // Binary file data
  fileSize: integer("file_size"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  contentType: varchar("content_type", { length: 100 }), // MIME type of the file
});

// Containers table (enhanced according to PRD)
export const containers = pgTable("containers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  containerCode: text("container_id").notNull().unique(), // Using container_id from existing DB
  type: containerTypeEnum("type").notNull().default("dry"),
  manufacturer: text("manufacturer"),
  model: text("model"),
  capacity: text("capacity"), // Using text from existing DB
  status: containerStatusEnum("status").notNull().default("active"),
  hasIot: boolean("has_iot").default(false).notNull(),
  orbcommDeviceId: text("orbcomm_device_id"),
  currentLocation: jsonb("current_location"), // Using jsonb from existing DB
  currentCustomerId: varchar("assigned_client_id").references(() => customers.id), // Using assigned_client_id from existing DB
  assignmentDate: timestamp("assignment_date"),
  expectedReturnDate: timestamp("expected_return_date"),
  manufacturingDate: timestamp("manufacturing_date"),
  purchaseDate: timestamp("purchase_date"),
  lastSyncTime: timestamp("last_sync_time"),
  healthScore: integer("health_score"),
  usageCycles: integer("usage_cycles"),
  excelMetadata: jsonb("excel_metadata"), // Store all Excel data as JSON

  // New telemetry fields for enhanced Orbcomm integration
  lastUpdateTimestamp: timestamp("last_update_timestamp"), // Timestamp from Orbcomm data
  locationLat: decimal("location_lat", { precision: 10, scale: 8 }), // Latitude from latest Orbcomm telemetry
  locationLng: decimal("location_lng", { precision: 11, scale: 8 }), // Longitude from latest Orbcomm telemetry
  lastTelemetry: jsonb("last_telemetry"), // Full raw JSON from Orbcomm message
  lastSyncedAt: timestamp("last_synced_at"), // Timestamp when this container was last synced

  // Master Sheet fields from Reefer/Container Master file
  productType: text("product_type"), // Reefer, Dry, Special, etc.
  sizeType: text("size_type"), // 40FT STD RF, 20FT, etc.
  groupName: text("group_name"), // Reefer Container, Dry Container
  gkuProductName: text("gku_product_name"), // GKU product code
  category: text("category"), // Refurbished, New, etc.
  size: integer("size"), // Container size
  depot: text("depot"), // Current depot/customer location
  yom: integer("yom"), // Year of Manufacture
  grade: text("grade"), // A, B, C quality grade
  reeferUnit: text("reefer_unit"), // Daikin, Carrier, etc.
  reeferModel: text("reefer_model"), // Reefer unit model name
  imageLinks: text("image_links"), // Links to container images/docs
  masterSheetData: jsonb("master_sheet_data"), // Complete master sheet row data
  // lastPmDate: timestamp("last_pm_date"),
  // nextPmDueDate: timestamp("next_pm_due_date"),
  // pmFrequencyDays: integer("pm_frequency_days").default(90),
  // pmStatus: pmStatusEnum("pm_status").default("UP_TO_DATE"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Container Ownership History - Track all owners over time
export const containerOwnershipHistory = pgTable("container_ownership_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  containerId: varchar("container_id").references(() => containers.id).notNull(),
  customerId: varchar("customer_id").references(() => customers.id).notNull(),
  orderType: text("order_type").notNull(), // Sale, Lease, Rental
  quotationNo: text("quotation_no"),
  orderReceivedNumber: text("order_received_number"),
  internalSalesOrderNo: text("internal_sales_order_no"),
  purchaseOrderNumber: text("purchase_order_number"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"), // null if current owner
  tenure: jsonb("tenure"), // { years, months, days }
  basicAmount: decimal("basic_amount", { precision: 10, scale: 2 }),
  securityDeposit: decimal("security_deposit", { precision: 10, scale: 2 }),
  isCurrent: boolean("is_current").default(true).notNull(),
  purchaseDetails: jsonb("purchase_details"), // Store full purchase details from Excel
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}) as any;

// Container Metrics (IoT data) - enhanced according to PRD
export const containerMetrics = pgTable("container_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  containerId: varchar("container_id").references(() => containers.id).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  location: jsonb("location"), // GPS coordinates
  temperature: decimal("temperature", { precision: 5, scale: 2 }),
  humidity: decimal("humidity", { precision: 5, scale: 2 }),
  powerStatus: text("power_status").notNull(), // Changed to text to handle existing data
  doorStatus: text("door_status").notNull(), // open, closed
  batteryLevel: decimal("battery_level", { precision: 5, scale: 2 }), // percentage
  signalStrength: integer("signal_strength"),
  errorCodes: text("error_codes").notNull(), // array - changed to text to handle existing data
  rawData: text("raw_data").notNull(), // all sensor readings - changed to text to handle existing data
});

// Alerts table (enhanced according to PRD)
export const alerts = pgTable("alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alertCode: text("alert_code").notNull(),
  containerId: varchar("container_id").references(() => containers.id).notNull(),
  alertType: alertTypeEnum("alert_type").notNull().default("error"),
  severity: alertSeverityEnum("severity").notNull().default("medium"),
  source: alertSourceEnum("source").notNull().default("manual"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  aiClassification: jsonb("ai_classification"),
  errorCode: text("error_code"),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedBy: varchar("acknowledged_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  resolutionMethod: resolutionMethodEnum("resolution_method"),
  serviceRequestId: varchar("service_request_id"), // Remove forward reference to avoid circular dependency
  resolutionSteps: text("resolution_steps").array(),
  requiredParts: text("required_parts").array(),
  estimatedServiceTime: integer("estimated_service_time"),
  metadata: jsonb("metadata"), // sensor readings, raw data
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Service Requests table (enhanced according to PRD)
export const serviceRequests = pgTable("service_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestNumber: text("request_number").notNull().unique(),
  jobOrder: text("job_order").unique(), // Job Order Number from Excel (e.g., "AUG045", "JUL001")
  containerId: varchar("container_id").references(() => containers.id).notNull(),
  customerId: varchar("client_id").references(() => customers.id).notNull(), // Using client_id from existing DB
  alertId: varchar("alert_id").references(() => alerts.id),
  assignedTechnicianId: varchar("assigned_technician_id").references(() => technicians.id),
  // Assignment audit fields (from existing DB columns)
  // assignedBy: text("assigned_by"),
  // assignedAt: timestamp("assigned_at"),
  priority: servicePriorityEnum("priority").notNull().default("normal"),
  status: serviceStatusEnum("status").notNull().default("pending"),
  issueDescription: text("issue_description").notNull(),
  requiredParts: text("required_parts").array(),
  estimatedDuration: integer("estimated_duration"),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"),
  scheduledDate: timestamp("scheduled_date"),
  scheduledTimeWindow: text("scheduled_time_window"), // e.g., "10:00-12:00"
  actualStartTime: timestamp("started_at"),
  actualEndTime: timestamp("completed_at"),
  serviceDuration: integer("service_duration"), // actual duration in minutes
  resolutionNotes: text("service_notes"),
  usedParts: text("used_parts").array(),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }),
  invoiceId: varchar("invoice_id"), // Will reference invoices table after it's defined
  customerFeedbackId: varchar("customer_feedback_id"),
  beforePhotos: text("before_photos").array(), // Technician's before service photos
  afterPhotos: text("after_photos").array(), // Technician's after service photos
  locationProofPhotos: text("location_proof_photos").array(), // Location proof photos
  videos: text("videos").array(), // Legacy: Video uploads (kept for backward compatibility)
  clientUploadedPhotos: text("client_uploaded_photos").array(), // Photos uploaded by client during service request creation
  clientUploadedVideos: text("client_uploaded_videos").array(), // Videos uploaded by client during service request creation
  clientApprovalRequired: boolean("client_approval_required"),
  clientApprovedAt: timestamp("client_approved_at"),
  // New columns for technician WhatsApp flow
  startTime: timestamp("start_time"), // When technician actually started (WhatsApp flow)
  endTime: timestamp("end_time"), // When technician actually ended (WhatsApp flow)
  durationMinutes: integer("duration_minutes"), // Calculated duration in minutes
  signedDocumentUrl: text("signed_document_url"), // Client signature document
  vendorInvoiceUrl: text("vendor_invoice_url"), // Third-party vendor invoice
  technicianNotes: text("technician_notes"), // Notes from technician during service
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  // Additional fields from Service History Excel
  workType: text("work_type"), // SERVICE-AT SITE, INSTALLATION, etc.
  clientType: text("client_type"), // LEASE, OWNED
  jobType: text("job_type"), // FOC, CHARGEABLE
  billingType: text("billing_type"), // FOC, CHARGEABLE
  callStatus: text("call_status"), // Close - PM, Completed, etc.
  month: text("month"), // AUG, JUL, etc.
  year: integer("year"), // 2023, 2024, etc.
  excelData: jsonb("excel_data"), // Store all Excel data as JSON

  // Inventory Integration fields
  inventoryOrderId: text("inventory_order_id"), // Order ID from Inventory System
  inventoryOrderNumber: text("inventory_order_number"), // Order Number from Inventory System
  inventoryOrderCreatedAt: timestamp("inventory_order_created_at"), // When order was created in Inventory System

  // Coordinator Remarks for Pre-Service Report
  coordinatorRemarks: text("coordinator_remarks"),
  remarksAddedBy: varchar("remarks_added_by"),
  remarksAddedAt: timestamp("remarks_added_at"),
});

// Service Report PDFs table (new according to PRD)
export const serviceReportPdfs = pgTable("service_report_pdfs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceRequestId: varchar("service_request_id").references(() => serviceRequests.id).notNull(),
  reportStage: varchar("report_stage").notNull(), // 'initial', 'pre_service', 'post_service', 'complete'
  fileUrl: text("file_url"), // Optional - kept for backward compatibility
  pdfData: bytea("pdf_data"), // PDF stored as binary data in database
  fileSize: integer("file_size"),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  emailedAt: timestamp("emailed_at"),
  emailRecipients: text("email_recipients").array(),
  status: varchar("status").default('generated'), // 'generated', 'emailed', 'failed'
});

// Courier Shipments table - Track spare parts shipments
export const courierShipments = pgTable("courier_shipments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceRequestId: varchar("service_request_id").references(() => serviceRequests.id).notNull(),
  awbNumber: text("awb_number").notNull().unique(), // Air Waybill Number / Tracking Number
  courierName: text("courier_name").notNull(), // Auto-detected or manually entered (Delhivery, BlueDart, DTDC, etc.)
  courierCode: text("courier_code"), // Courier code from Ship24 API
  shipmentDescription: text("shipment_description"), // What's being shipped
  origin: text("origin"), // Shipping from location
  destination: text("destination"), // Shipping to location
  estimatedDeliveryDate: timestamp("estimated_delivery_date"),
  actualDeliveryDate: timestamp("actual_delivery_date"),
  status: courierShipmentStatusEnum("status").default("pending").notNull(),
  currentLocation: text("current_location"), // Last known location
  trackingHistory: jsonb("tracking_history"), // Full tracking history from API
  lastTrackedAt: timestamp("last_tracked_at"), // When we last fetched tracking data
  rawApiResponse: jsonb("raw_api_response"), // Store full API response for debugging
  addedBy: varchar("added_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Invoices table (enhanced according to PRD)
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull().unique(),
  serviceRequestId: varchar("service_request_id").notNull(),
  customerId: varchar("customer_id").references(() => customers.id).notNull(),
  issueDate: timestamp("issue_date").defaultNow().notNull(),
  dueDate: timestamp("due_date").notNull(),
  lineItems: jsonb("line_items").notNull(), // array of {description, quantity, rate, amount}
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  paymentStatus: invoiceStatusEnum("payment_status").notNull().default("pending"),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).default("0.00"),
  paymentDate: timestamp("payment_date"),
  paymentMethod: text("payment_method"),
  paymentReference: text("payment_reference"),
  pdfUrl: text("pdf_url"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Feedback table (new according to PRD)
export const feedback = pgTable("feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceRequestId: varchar("service_request_id").references(() => (serviceRequests as any).id).notNull(),
  customerId: varchar("customer_id").references(() => customers.id).notNull(),
  technicianId: varchar("technician_id").references(() => technicians.id).notNull(),
  rating: feedbackRatingEnum("rating").notNull(),
  feedbackText: text("feedback_text"),
  quickFeedbackTags: jsonb("quick_feedback_tags").notNull(), // array of selected tags
  issueResolved: boolean("issue_resolved").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  followUpRequired: boolean("follow_up_required").default(false).notNull(),
  followUpCompleted: boolean("follow_up_completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Scheduled Services table (new according to PRD)
export const scheduledServices = pgTable("scheduled_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceRequestId: varchar("service_request_id").references(() => (serviceRequests as any).id).notNull(),
  technicianId: varchar("technician_id").references(() => technicians.id).notNull(),
  scheduledDate: timestamp("scheduled_date").notNull(),
  sequenceNumber: integer("sequence_number").notNull(), // order in technician's day
  estimatedStartTime: timestamp("estimated_start_time").notNull(),
  estimatedEndTime: timestamp("estimated_end_time").notNull(),
  estimatedTravelTime: integer("estimated_travel_time").notNull(), // minutes
  estimatedServiceDuration: integer("estimated_service_duration").notNull(), // minutes
  routeOrder: integer("route_order").notNull(),
  totalDistance: decimal("total_distance", { precision: 10, scale: 2 }).notNull(), // km
  optimizationScore: decimal("optimization_score", { precision: 5, scale: 2 }).notNull(),
  status: scheduledServiceStatusEnum("status").notNull().default("scheduled"),
  actualStartTime: timestamp("actual_start_time"),
  actualEndTime: timestamp("actual_end_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// WhatsApp Sessions table (enhanced according to PRD)
export const whatsappSessions = pgTable("whatsapp_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumber: text("phone_number").notNull(),
  userId: varchar("user_id").references(() => users.id),
  conversationState: jsonb("conversation_state"), // current state for multi-step flows
  lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// WhatsApp Messages table (enhanced according to PRD)
export const whatsappMessages = pgTable("whatsapp_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recipientType: whatsappRecipientTypeEnum("recipient_type").notNull(),
  recipientId: varchar("recipient_id").notNull(),
  phoneNumber: text("phone_number").notNull(),
  messageType: whatsappMessageTypeEnum("message_type").notNull(),
  templateName: text("template_name"),
  messageContent: jsonb("message_content").notNull(),
  whatsappMessageId: text("whatsapp_message_id").notNull().unique(), // from WhatsApp API
  status: whatsappMessageStatusEnum("status").notNull().default("sent"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
  failedReason: text("failed_reason"),
  conversationId: varchar("conversation_id").references(() => whatsappSessions.id),
  relatedEntityType: text("related_entity_type"), // e.g., "ServiceRequest"
  relatedEntityId: varchar("related_entity_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Inventory table (enhanced according to PRD)
export const inventory = pgTable("inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partNumber: text("part_number").notNull().unique(),
  partName: text("part_name").notNull(),
  category: text("category").notNull(),
  quantityInStock: integer("quantity_in_stock").notNull(),
  reorderLevel: integer("reorder_level").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  location: text("location"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Audit Logs table (enhanced according to PRD)
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  changes: jsonb("changes"),
  source: text("source").notNull(), // dashboard, whatsapp
  ipAddress: text("ip_address"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Email OTP verification (free email verification flow)
export const emailVerifications = pgTable("email_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Password Reset Tokens (secure password reset flow)
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  tokenHash: text("token_hash").notNull().unique(), // SHA-256 hash of the token
  expiresAt: timestamp("expires_at").notNull(), // Tokens expire after 1 hour
  usedAt: timestamp("used_at"), // null if not used yet, timestamp when used
  createdBy: varchar("created_by").references(() => users.id), // Admin who triggered the reset
  ipAddress: text("ip_address"), // IP address of the requester
  userAgent: text("user_agent"), // Browser/device info
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Inventory Transactions table
export const inventoryTransactions = pgTable("inventory_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itemId: varchar("item_id").references(() => inventory.id).notNull(),
  type: text("type").notNull(), // 'in', 'out', 'adjustment'
  quantity: integer("quantity").notNull(),
  reason: text("reason").notNull(),
  reference: text("reference"), // Service request ID, purchase order, etc.
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Inventory Indents (Purchase Requisitions/Orders)
export const inventoryIndents = pgTable("inventory_indents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  indentNumber: text("indent_number").notNull().unique(),
  serviceRequestId: varchar("service_request_id").references(() => serviceRequests.id),
  status: text("status").notNull().default("pending"), // pending, approved, ordered, received, cancelled
  priority: text("priority").notNull().default("normal"), // low, normal, high, urgent
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  remarks: text("remarks"),
  requestedBy: varchar("requested_by").references(() => users.id).notNull(),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Inventory Indent Items (line items for each indent)
export const inventoryIndentItems = pgTable("inventory_indent_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  indentId: varchar("indent_id").references(() => inventoryIndents.id).notNull(),
  itemId: varchar("item_id").references(() => inventory.id).notNull(),
  partName: text("part_name").notNull(),
  partNumber: text("part_number").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// RAG (Retrieval-Augmented Generation) Tables for Reefer Diagnostic Chatbot
export const manuals = pgTable("manuals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  sourceUrl: text("source_url"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  uploadedOn: timestamp("uploaded_on").defaultNow().notNull(),
  version: text("version"),
  meta: jsonb("meta"), // Additional metadata like brand, model, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Define vector type for pgvector
const vector = customType<{ data: number[]; driverData: string }>({
  dataType(config) {
    const dims = (config as any)?.dimensions ?? 384;
    return `vector(${dims})`;
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  },
});

export const manualChunks = pgTable("manual_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  manualId: varchar("manual_id").references(() => manuals.id).notNull(),
  chunkText: text("chunk_text").notNull(),
  chunkEmbeddingId: text("chunk_embedding_id"), // Legacy field for compatibility
  embedding: vector("embedding", { dimensions: 384 }), // Vector embedding stored directly in PostgreSQL
  pageNum: integer("page_num"),
  startOffset: integer("start_offset"),
  endOffset: integer("end_offset"),
  metadata: jsonb("metadata"), // Additional chunk metadata (headings, alarm codes, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ragQueries = pgTable("rag_queries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  unitId: varchar("unit_id").references(() => containers.id),
  queryText: text("query_text").notNull(),
  responseText: text("response_text").notNull(),
  sources: jsonb("sources"), // Array of source citations
  confidence: text("confidence").notNull(), // 'high', 'medium', 'low'
  suggestedParts: jsonb("suggested_parts"), // Array of suggested spare parts
  context: jsonb("context"), // Additional context (telemetry, alarm data, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Technician Travel Planning tables
export const technicianTrips = pgTable("technician_trips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  technicianId: varchar("technician_id").references(() => technicians.id).notNull(),
  origin: text("origin").notNull(), // Origin city/location (auto from technician base or configurable)
  destinationCity: text("destination_city").notNull(), // Destination city/region (e.g., Chennai)
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  dailyWorkingTimeWindow: text("daily_working_time_window"), // Optional: e.g., "10:00-18:00"
  purpose: tripPurposeEnum("purpose").notNull().default("pm"),
  notes: text("notes"), // Free text instructions/notes
  tripStatus: tripStatusEnum("trip_status").notNull().default("planned"),
  bookingStatus: bookingStatusEnum("booking_status").notNull().default("not_started"),
  ticketReference: text("ticket_reference"), // PNR, booking ID, links for tickets
  hotelReference: text("hotel_reference"), // Hotel booking ID, links
  bookingAttachments: jsonb("booking_attachments"), // Store file uploads/references as JSON
  miscellaneousAmount: decimal("miscellaneous_amount", { precision: 10, scale: 2 }).default("0.00"), // Additional miscellaneous costs
  createdBy: varchar("created_by").references(() => users.id), // Admin/Scheduler who created the trip
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const technicianTripCosts = pgTable("technician_trip_costs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId: varchar("trip_id").references(() => technicianTrips.id).notNull().unique(),
  travelFare: decimal("travel_fare", { precision: 10, scale: 2 }).default("0.00"),
  travelFareIsManual: boolean("travel_fare_is_manual").notNull().default(false),
  stayCost: decimal("stay_cost", { precision: 10, scale: 2 }).default("0.00"),
  stayCostIsManual: boolean("stay_cost_is_manual").notNull().default(false),
  dailyAllowance: decimal("daily_allowance", { precision: 10, scale: 2 }).default("0.00"),
  dailyAllowanceIsManual: boolean("daily_allowance_is_manual").notNull().default(false),
  localTravelCost: decimal("local_travel_cost", { precision: 10, scale: 2 }).default("0.00"),
  localTravelCostIsManual: boolean("local_travel_cost_is_manual").notNull().default(false),
  miscCost: decimal("misc_cost", { precision: 10, scale: 2 }).default("0.00"),
  miscCostIsManual: boolean("misc_cost_is_manual").notNull().default(false),
  totalEstimatedCost: decimal("total_estimated_cost", { precision: 10, scale: 2 }).default("0.00"), // Auto-calculated sum
  currency: text("currency").default("INR").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const technicianTripTasks = pgTable("technician_trip_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId: varchar("trip_id").references(() => technicianTrips.id).notNull(),
  containerId: varchar("container_id").references(() => containers.id).notNull(),
  siteName: text("site_name"), // Customer/site name
  customerId: varchar("customer_id").references(() => customers.id),
  taskType: tripTaskTypeEnum("task_type").notNull().default("pm"),
  priority: text("priority").default("normal"), // urgent, high, normal, low (reuse service_priority enum values)
  scheduledDate: timestamp("scheduled_date"), // Specific date within trip range for this task
  estimatedDurationHours: integer("estimated_duration_hours"), // Estimated hours to complete
  status: tripTaskStatusEnum("status").notNull().default("pending"),
  serviceRequestId: varchar("service_request_id").references(() => serviceRequests.id), // Link to service request if created
  alertId: varchar("alert_id").references(() => alerts.id), // Link to alert if task is for alert resolution
  notes: text("notes"), // Task-specific notes
  completedAt: timestamp("completed_at"),
  source: text("source").default('auto').notNull(),
  isManual: boolean("is_manual").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const locationMultipliers = pgTable("location_multipliers", {
  city: text("city").primaryKey(),
  multiplier: decimal("multiplier", { precision: 6, scale: 3 }).default("1.000").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Daily Summary Acknowledgment table
export const dailySummaryAcknowledgment = pgTable("daily_summary_acknowledgment", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: date("date").notNull(),
  summary: jsonb("summary").notNull(),
  status: text("status").notNull().default("pending"),
  acknowledgedAt: timestamp("acknowledged_at"),
});

// Weekly Summary Reports table (for CAPA Reefer Reports)
export const weeklySummaryReports = pgTable("weekly_summary_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  weekStartDate: date("week_start_date").notNull(), // Monday of the week
  weekEndDate: date("week_end_date").notNull(),     // Friday of the week
  weekIdentifier: text("week_identifier").notNull().unique(), // e.g., "2025-W51" for idempotency
  summary: jsonb("summary").notNull(),
  detailedReport: text("detailed_report").notNull(), // Paragraph format report
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  sentTo: jsonb("sent_to").notNull(), // Array of recipient emails
  status: text("status").notNull().default("sent"), // 'sent', 'failed'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Location Logs table - Track technician locations over time
export const locationLogs = pgTable("location_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: varchar("employee_id").references(() => technicians.id).notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  batteryLevel: integer("battery_level"), // Battery percentage (0-100)
  speed: decimal("speed", { precision: 6, scale: 2 }), // Speed in km/h
  accuracy: decimal("accuracy", { precision: 8, scale: 2 }), // GPS accuracy in meters
  address: text("address"), // Reverse geocoded address
  source: text("source").default("app").notNull(), // 'app', 'whatsapp', 'manual'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Finance Expenses table
export const financeExpenses = pgTable("finance_expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  containerId: varchar("container_id").references(() => containers.id).notNull(),
  technicianId: varchar("technician_id").references(() => technicians.id),
  expenseType: varchar("expense_type").notNull(), // 'Travel', 'Material', 'Misc'
  description: text("description"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  date: date("date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations (updated according to PRD)
export const usersRelations = relations(users, ({ one, many }) => ({
  customer: one(customers, { fields: [users.id], references: [customers.userId] }),
  technician: one(technicians, { fields: [users.id], references: [technicians.userId] }),
  whatsappSessions: many(whatsappSessions),
  auditLogs: many(auditLogs),
  createdServiceRequests: many(serviceRequests),
  acknowledgedAlerts: many(alerts),
  createdTrips: many(technicianTrips),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  user: one(users, { fields: [customers.userId], references: [users.id] }),
  accountManager: one(users, { fields: [customers.accountManagerId], references: [users.id] }),
  containers: many(containers),
  serviceRequests: many(serviceRequests),
  invoices: many(invoices),
  feedback: many(feedback),
}));

export const techniciansRelations = relations(technicians, ({ one, many }) => ({
  user: one(users, { fields: [technicians.userId], references: [users.id] }),
  serviceRequests: many(serviceRequests),
  scheduledServices: many(scheduledServices),
  feedback: many(feedback),
  trips: many(technicianTrips),
  locationLogs: many(locationLogs),
}));

export const containersRelations = relations(containers, ({ one, many }) => ({
  customer: one(customers, { fields: [containers.currentCustomerId], references: [customers.id] }),
  alerts: many(alerts),
  metrics: many(containerMetrics),
  serviceRequests: many(serviceRequests),
  tripTasks: many(technicianTripTasks),
}));

export const alertsRelations = relations(alerts, ({ one, many }) => ({
  container: one(containers, { fields: [alerts.containerId], references: [containers.id] }),
  acknowledgedBy: one(users, { fields: [alerts.acknowledgedBy], references: [users.id] }),
  serviceRequest: one(serviceRequests, { fields: [alerts.serviceRequestId], references: [serviceRequests.id] }),
}));

export const serviceRequestsRelations = relations(serviceRequests, ({ one, many }) => ({
  container: one(containers, { fields: [serviceRequests.containerId], references: [containers.id] }),
  customer: one(customers, { fields: [serviceRequests.customerId], references: [customers.id] }),
  alert: one(alerts, { fields: [serviceRequests.alertId], references: [alerts.id] }),
  technician: one(technicians, { fields: [serviceRequests.assignedTechnicianId], references: [technicians.id] }),
  invoice: one(invoices, { fields: [serviceRequests.id], references: [invoices.serviceRequestId] }),
  feedback: one(feedback, { fields: [serviceRequests.id], references: [feedback.serviceRequestId] }),
  createdBy: one(users, { fields: [serviceRequests.createdBy], references: [users.id] }),
  scheduledServices: many(scheduledServices),
  courierShipments: many(courierShipments),
}));

export const courierShipmentsRelations = relations(courierShipments, ({ one }) => ({
  serviceRequest: one(serviceRequests, { fields: [courierShipments.serviceRequestId], references: [serviceRequests.id] }),
  addedByUser: one(users, { fields: [courierShipments.addedBy], references: [users.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  serviceRequest: one(serviceRequests, { fields: [invoices.serviceRequestId], references: [serviceRequests.id] }),
  customer: one(customers, { fields: [invoices.customerId], references: [customers.id] }),
}));

export const feedbackRelations = relations(feedback, ({ one }) => ({
  serviceRequest: one(serviceRequests, { fields: [feedback.serviceRequestId], references: [serviceRequests.id] }),
  customer: one(customers, { fields: [feedback.customerId], references: [customers.id] }),
  technician: one(technicians, { fields: [feedback.technicianId], references: [technicians.id] }),
}));

export const scheduledServicesRelations = relations(scheduledServices, ({ one }) => ({
  serviceRequest: one(serviceRequests, { fields: [scheduledServices.serviceRequestId], references: [serviceRequests.id] }),
  technician: one(technicians, { fields: [scheduledServices.technicianId], references: [technicians.id] }),
}));

export const whatsappSessionsRelations = relations(whatsappSessions, ({ one, many }) => ({
  user: one(users, { fields: [whatsappSessions.userId], references: [users.id] }),
  messages: many(whatsappMessages),
}));

export const whatsappMessagesRelations = relations(whatsappMessages, ({ one }) => ({
  session: one(whatsappSessions, { fields: [whatsappMessages.conversationId], references: [whatsappSessions.id] }),
}));

export const containerMetricsRelations = relations(containerMetrics, ({ one }) => ({
  container: one(containers, { fields: [containerMetrics.containerId], references: [containers.id] }),
}));

// RAG Relations
export const manualsRelations = relations(manuals, ({ one, many }) => ({
  uploadedBy: one(users, { fields: [manuals.uploadedBy], references: [users.id] }),
  chunks: many(manualChunks),
}));

export const manualChunksRelations = relations(manualChunks, ({ one }) => ({
  manual: one(manuals, { fields: [manualChunks.manualId], references: [manuals.id] }),
}));

export const ragQueriesRelations = relations(ragQueries, ({ one }) => ({
  user: one(users, { fields: [ragQueries.userId], references: [users.id] }),
  unit: one(containers, { fields: [ragQueries.unitId], references: [containers.id] }),
}));

// Technician Travel Planning Relations
export const technicianTripsRelations = relations(technicianTrips, ({ one, many }) => ({
  technician: one(technicians, { fields: [technicianTrips.technicianId], references: [technicians.id] }),
  createdByUser: one(users, { fields: [technicianTrips.createdBy], references: [users.id] }),
  costs: one(technicianTripCosts, { fields: [technicianTrips.id], references: [technicianTripCosts.tripId] }),
  tasks: many(technicianTripTasks),
}));

export const technicianTripCostsRelations = relations(technicianTripCosts, ({ one }) => ({
  trip: one(technicianTrips, { fields: [technicianTripCosts.tripId], references: [technicianTrips.id] }),
}));

export const technicianTripTasksRelations = relations(technicianTripTasks, ({ one }) => ({
  trip: one(technicianTrips, { fields: [technicianTripTasks.tripId], references: [technicianTrips.id] }),
  container: one(containers, { fields: [technicianTripTasks.containerId], references: [containers.id] }),
  customer: one(customers, { fields: [technicianTripTasks.customerId], references: [customers.id] }),
  serviceRequest: one(serviceRequests, { fields: [technicianTripTasks.serviceRequestId], references: [serviceRequests.id] }),
  alert: one(alerts, { fields: [technicianTripTasks.alertId], references: [alerts.id] }),
}));

export const locationLogsRelations = relations(locationLogs, ({ one }) => ({
  technician: one(technicians, { fields: [locationLogs.employeeId], references: [technicians.id] }),
}));

export const financeExpensesRelations = relations(financeExpenses, ({ one }) => ({
  container: one(containers, { fields: [financeExpenses.containerId], references: [containers.id] }),
  technician: one(technicians, { fields: [financeExpenses.technicianId], references: [technicians.id] }),
}));

// Insert schemas (updated according to PRD)

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true } as any);
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true, updatedAt: true } as any);
export const insertTechnicianSchema = createInsertSchema(technicians).omit({ id: true, createdAt: true, updatedAt: true } as any);
export const insertTechnicianDocumentSchema = createInsertSchema(technicianDocuments).omit({ id: true, uploadedAt: true, updatedAt: true } as any);
export const insertContainerSchema = createInsertSchema(containers).omit({ id: true, createdAt: true, updatedAt: true } as any);
export const insertAlertSchema = createInsertSchema(alerts).omit({ id: true, createdAt: true } as any);
export const insertServiceRequestSchema = createInsertSchema(serviceRequests).omit({ id: true, createdAt: true, updatedAt: true } as any);
export const insertCourierShipmentSchema = createInsertSchema(courierShipments).omit({ id: true, createdAt: true, updatedAt: true } as any);
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true, updatedAt: true } as any);
export const insertFeedbackSchema = createInsertSchema(feedback).omit({ id: true, createdAt: true } as any);
export const insertScheduledServiceSchema = createInsertSchema(scheduledServices).omit({ id: true, createdAt: true, updatedAt: true } as any);
export const insertWhatsappSessionSchema = createInsertSchema(whatsappSessions).omit({ id: true, createdAt: true, updatedAt: true } as any);
export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages).omit({ id: true, createdAt: true } as any);
export const insertContainerMetricsSchema = createInsertSchema(containerMetrics).omit({ id: true } as any);
export const insertInventorySchema = createInsertSchema(inventory).omit({ id: true, createdAt: true, updatedAt: true } as any);
export const insertEmailVerificationSchema = createInsertSchema(emailVerifications).omit({ id: true, createdAt: true } as any);
export const insertInventoryTransactionSchema = createInsertSchema(inventoryTransactions).omit({ id: true, createdAt: true } as any);
export const insertManualSchema = createInsertSchema(manuals).omit({ id: true, createdAt: true, updatedAt: true } as any);
export const insertLocationLogSchema = createInsertSchema(locationLogs).omit({ id: true, createdAt: true } as any);
export const insertFinanceExpenseSchema = createInsertSchema(financeExpenses).omit({ id: true, createdAt: true } as any);
export const insertManualChunkSchema = createInsertSchema(manualChunks).omit({ id: true, createdAt: true, embedding: true } as any);
export const insertRagQuerySchema = createInsertSchema(ragQueries).omit({ id: true, createdAt: true } as any);
// Technician Travel Planning insert schemas
export const insertTechnicianTripSchema = createInsertSchema(technicianTrips).omit({ id: true, createdAt: true, updatedAt: true } as any);
export const insertTechnicianTripCostSchema = createInsertSchema(technicianTripCosts).omit({ id: true, createdAt: true, updatedAt: true } as any);
export const insertTechnicianTripTaskSchema = createInsertSchema(technicianTripTasks).omit({ id: true, createdAt: true, updatedAt: true } as any);

export const insertDailySummaryAcknowledgmentSchema = createInsertSchema(dailySummaryAcknowledgment).omit({ id: true } as any);
export const insertWeeklySummaryReportSchema = createInsertSchema(weeklySummaryReports).omit({ id: true, createdAt: true } as any);

// Service Request Remarks (immutable)
export const serviceRequestRemarks = pgTable("service_request_remarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceRequestId: varchar("service_request_id").references(() => serviceRequests.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  userName: text("user_name").notNull(),
  userRole: text("user_role").notNull(),
  remarkText: text("remark_text").notNull(),
  isSystemGenerated: boolean("is_system_generated").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Service Request Recordings
export const serviceRequestRecordings = pgTable("service_request_recordings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceRequestId: varchar("service_request_id").references(() => serviceRequests.id).notNull(),
  remarkId: varchar("remark_id").references(() => serviceRequestRemarks.id),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  uploadedByName: text("uploaded_by_name").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  originalFileSize: integer("original_file_size"),
  durationSeconds: integer("duration_seconds"),
  mimeType: text("mime_type"),
  isCompressed: boolean("is_compressed").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertServiceRequestRemarkSchema = createInsertSchema(serviceRequestRemarks).omit({ id: true, createdAt: true } as any);
export const insertServiceRequestRecordingSchema = createInsertSchema(serviceRequestRecordings).omit({ id: true, createdAt: true } as any);

// Types (updated according to PRD)
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Technician = typeof technicians.$inferSelect;
export type InsertTechnician = z.infer<typeof insertTechnicianSchema>;
export type TechnicianDocument = typeof technicianDocuments.$inferSelect;
export type InsertTechnicianDocument = z.infer<typeof insertTechnicianDocumentSchema>;
export type Container = typeof containers.$inferSelect;
export type InsertContainer = z.infer<typeof insertContainerSchema>;
export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type ServiceRequest = typeof serviceRequests.$inferSelect;
export type InsertServiceRequest = z.infer<typeof insertServiceRequestSchema>;
export type CourierShipment = typeof courierShipments.$inferSelect;
export type InsertCourierShipment = z.infer<typeof insertCourierShipmentSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type ScheduledService = typeof scheduledServices.$inferSelect;
export type InsertScheduledService = z.infer<typeof insertScheduledServiceSchema>;
export type WhatsappSession = typeof whatsappSessions.$inferSelect;
export type InsertWhatsappSession = z.infer<typeof insertWhatsappSessionSchema>;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;
export type ContainerMetrics = typeof containerMetrics.$inferSelect;
export type InsertContainerMetrics = z.infer<typeof insertContainerMetricsSchema>;
export type InventoryItem = typeof inventory.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventorySchema>;
export type EmailVerification = typeof emailVerifications.$inferSelect;
export type InsertEmailVerification = z.infer<typeof insertEmailVerificationSchema>;
export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
export type InsertInventoryTransaction = z.infer<typeof insertInventoryTransactionSchema>;
export type Manual = typeof manuals.$inferSelect;
export type InsertManual = z.infer<typeof insertManualSchema>;
export type ManualChunk = typeof manualChunks.$inferSelect;
export type InsertManualChunk = z.infer<typeof insertManualChunkSchema>;
export type RagQuery = typeof ragQueries.$inferSelect;
export type InsertRagQuery = z.infer<typeof insertRagQuerySchema>;
// Technician Travel Planning types
export type TechnicianTrip = typeof technicianTrips.$inferSelect;
export type InsertTechnicianTrip = z.infer<typeof insertTechnicianTripSchema>;
export type TechnicianTripCost = typeof technicianTripCosts.$inferSelect;
export type InsertTechnicianTripCost = z.infer<typeof insertTechnicianTripCostSchema>;
export type TechnicianTripTask = typeof technicianTripTasks.$inferSelect;
export type InsertTechnicianTripTask = z.infer<typeof insertTechnicianTripTaskSchema>;
// Service Request Remarks & Recordings types
export type ServiceRequestRemark = typeof serviceRequestRemarks.$inferSelect;
export type InsertServiceRequestRemark = z.infer<typeof insertServiceRequestRemarkSchema>;
export type ServiceRequestRecording = typeof serviceRequestRecordings.$inferSelect;
export type InsertServiceRequestRecording = z.infer<typeof insertServiceRequestRecordingSchema>;
// Location Log types
export type LocationLog = typeof locationLogs.$inferSelect;
export type InsertLocationLog = z.infer<typeof insertLocationLogSchema>;
