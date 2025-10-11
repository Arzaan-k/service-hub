import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb, pgEnum, decimal, uuid, point } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums according to PRD
export const userRoleEnum = pgEnum("user_role", ["admin", "client", "technician", "coordinator", "super_admin"]);
export const containerStatusEnum = pgEnum("container_status", ["active", "in_service", "maintenance", "retired", "in_transit", "for_sale", "sold"]);
// Use existing enum from database
export const containerTypeEnum = pgEnum("container_type", ["refrigerated", "dry", "special", "iot_enabled", "manual"]);
export const alertSeverityEnum = pgEnum("alert_severity", ["critical", "high", "medium", "low"]);
export const alertStatusEnum = pgEnum("alert_status", ["open", "acknowledged", "resolved", "closed"]);
export const alertTypeEnum = pgEnum("alert_type", ["error", "warning", "info"]);
export const alertSourceEnum = pgEnum("alert_source", ["orbcomm", "manual", "predictive"]);
export const serviceStatusEnum = pgEnum("service_status", ["pending", "approved", "scheduled", "in_progress", "completed", "cancelled"]);
export const servicePriorityEnum = pgEnum("service_priority", ["urgent", "high", "normal", "low"]);
export const technicianStatusEnum = pgEnum("technician_status", ["available", "on_duty", "busy", "off_duty"]);
// Removed technicianExperienceEnum - using text instead
export const invoiceStatusEnum = pgEnum("invoice_status", ["pending", "partially_paid", "paid", "overdue", "cancelled"]);
export const customerTierEnum = pgEnum("customer_tier", ["premium", "standard", "basic"]);
export const paymentTermsEnum = pgEnum("payment_terms", ["prepaid", "net15", "net30"]);
export const customerStatusEnum = pgEnum("customer_status", ["active", "inactive", "suspended"]);
export const whatsappMessageTypeEnum = pgEnum("whatsapp_message_type", ["text", "template", "interactive", "media", "flow"]);
export const whatsappMessageStatusEnum = pgEnum("whatsapp_message_status", ["sent", "delivered", "read", "failed"]);
export const whatsappRecipientTypeEnum = pgEnum("whatsapp_recipient_type", ["customer", "technician", "admin"]);
export const scheduledServiceStatusEnum = pgEnum("scheduled_service_status", ["scheduled", "in_progress", "completed", "rescheduled", "cancelled"]);
export const feedbackRatingEnum = pgEnum("feedback_rating", ["1", "2", "3", "4", "5"]);
export const resolutionMethodEnum = pgEnum("resolution_method", ["auto", "service", "diy", "ignored"]);

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
});

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
  serviceRequestId: varchar("service_request_id").references(() => serviceRequests.id),
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
  containerId: varchar("container_id").references(() => containers.id).notNull(),
  customerId: varchar("client_id").references(() => customers.id).notNull(), // Using client_id from existing DB
  alertId: varchar("alert_id").references(() => alerts.id),
  assignedTechnicianId: varchar("assigned_technician_id").references(() => technicians.id),
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
  invoiceId: varchar("invoice_id").references(() => invoices.id),
  customerFeedbackId: varchar("customer_feedback_id").references(() => feedback.id),
  beforePhotos: text("before_photos").array(),
  afterPhotos: text("after_photos").array(),
  clientApprovalRequired: boolean("client_approval_required"),
  clientApprovedAt: timestamp("client_approved_at"),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Invoices table (enhanced according to PRD)
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull().unique(),
  serviceRequestId: varchar("service_request_id").references(() => serviceRequests.id).notNull(),
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
  serviceRequestId: varchar("service_request_id").references(() => serviceRequests.id).notNull(),
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
  serviceRequestId: varchar("service_request_id").references(() => serviceRequests.id).notNull(),
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

// Relations (updated according to PRD)
export const usersRelations = relations(users, ({ one, many }) => ({
  customer: one(customers, { fields: [users.id], references: [customers.userId] }),
  technician: one(technicians, { fields: [users.id], references: [technicians.userId] }),
  whatsappSessions: many(whatsappSessions),
  auditLogs: many(auditLogs),
  createdServiceRequests: many(serviceRequests),
  acknowledgedAlerts: many(alerts),
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
}));

export const containersRelations = relations(containers, ({ one, many }) => ({
  customer: one(customers, { fields: [containers.currentCustomerId], references: [customers.id] }),
  alerts: many(alerts),
  metrics: many(containerMetrics),
  serviceRequests: many(serviceRequests),
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
  invoice: one(invoices),
  feedback: one(feedback),
  createdBy: one(users, { fields: [serviceRequests.createdBy], references: [users.id] }),
  scheduledServices: many(scheduledServices),
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

// Insert schemas (updated according to PRD)
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTechnicianSchema = createInsertSchema(technicians).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContainerSchema = createInsertSchema(containers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAlertSchema = createInsertSchema(alerts).omit({ id: true, createdAt: true });
export const insertServiceRequestSchema = createInsertSchema(serviceRequests).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFeedbackSchema = createInsertSchema(feedback).omit({ id: true, createdAt: true });
export const insertScheduledServiceSchema = createInsertSchema(scheduledServices).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWhatsappSessionSchema = createInsertSchema(whatsappSessions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages).omit({ id: true, createdAt: true });
export const insertContainerMetricsSchema = createInsertSchema(containerMetrics).omit({ id: true });
export const insertInventorySchema = createInsertSchema(inventory).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, timestamp: true });

// Types (updated according to PRD)
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Technician = typeof technicians.$inferSelect;
export type InsertTechnician = z.infer<typeof insertTechnicianSchema>;
export type Container = typeof containers.$inferSelect;
export type InsertContainer = z.infer<typeof insertContainerSchema>;
export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type ServiceRequest = typeof serviceRequests.$inferSelect;
export type InsertServiceRequest = z.infer<typeof insertServiceRequestSchema>;
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
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
