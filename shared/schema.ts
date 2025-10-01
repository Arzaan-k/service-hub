import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "client", "technician", "coordinator"]);
export const containerStatusEnum = pgEnum("container_status", ["active", "in_service", "maintenance", "retired"]);
export const containerTypeEnum = pgEnum("container_type", ["iot_enabled", "manual_tracking"]);
export const alertSeverityEnum = pgEnum("alert_severity", ["critical", "high", "medium", "low"]);
export const alertStatusEnum = pgEnum("alert_status", ["open", "acknowledged", "resolved", "closed"]);
export const serviceStatusEnum = pgEnum("service_status", ["pending", "approved", "scheduled", "in_progress", "completed", "cancelled"]);
export const servicePriorityEnum = pgEnum("service_priority", ["critical", "high", "medium", "low"]);
export const technicianStatusEnum = pgEnum("technician_status", ["available", "on_duty", "busy", "off_duty"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["pending", "partially_paid", "paid", "overdue"]);
export const customerTierEnum = pgEnum("customer_tier", ["premium", "standard", "basic"]);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumber: text("phone_number").notNull().unique(),
  name: text("name").notNull(),
  email: text("email"),
  role: userRoleEnum("role").notNull(),
  password: text("password"),
  isActive: boolean("is_active").default(true).notNull(),
  whatsappVerified: boolean("whatsapp_verified").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Clients table
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  companyName: text("company_name").notNull(),
  tier: customerTierEnum("tier").notNull().default("standard"),
  contactPerson: text("contact_person"),
  address: text("address"),
  paymentTerms: integer("payment_terms").default(30), // days
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Technicians table
export const technicians = pgTable("technicians", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  techNumber: text("tech_number").notNull().unique(),
  experienceLevel: text("experience_level").notNull(), // Junior, Mid, Senior, Expert
  skills: text("skills").array().notNull(),
  homeLocation: jsonb("home_location"), // {lat, lng}
  serviceAreas: text("service_areas").array(),
  status: technicianStatusEnum("status").default("available").notNull(),
  averageRating: integer("average_rating").default(0),
  totalJobs: integer("total_jobs").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Containers table
export const containers = pgTable("containers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  containerId: text("container_id").notNull().unique(),
  type: text("type").notNull(), // 20ft Standard, 40ft Standard, etc
  containerType: containerTypeEnum("container_type").notNull(),
  status: containerStatusEnum("status").default("active").notNull(),
  orbcommDeviceId: text("orbcomm_device_id"),
  currentLocation: jsonb("current_location"), // {lat, lng, address}
  assignedClientId: varchar("assigned_client_id").references(() => clients.id),
  capacity: text("capacity"),
  manufacturingDate: timestamp("manufacturing_date"),
  purchaseDate: timestamp("purchase_date"),
  lastSyncTime: timestamp("last_sync_time"),
  healthScore: integer("health_score").default(100),
  usageCycles: integer("usage_cycles").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Container Metrics (IoT data)
export const containerMetrics = pgTable("container_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  containerId: varchar("container_id").references(() => containers.id).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  temperature: integer("temperature"),
  doorStatus: text("door_status"), // open, closed
  powerStatus: text("power_status"), // on, off
  batteryLevel: integer("battery_level"),
  location: jsonb("location"), // {lat, lng}
  errorCodes: text("error_codes").array(),
  rawData: jsonb("raw_data"),
});

// Alerts table
export const alerts = pgTable("alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alertCode: text("alert_code").notNull().unique(),
  containerId: varchar("container_id").references(() => containers.id).notNull(),
  severity: alertSeverityEnum("severity").notNull(),
  status: alertStatusEnum("status").default("open").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  aiClassification: jsonb("ai_classification"), // AI analysis results
  errorCode: text("error_code"),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedAt: timestamp("resolved_at"),
  resolutionSteps: text("resolution_steps").array(),
  requiredParts: text("required_parts").array(),
  estimatedServiceTime: integer("estimated_service_time"), // minutes
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Service Requests table
export const serviceRequests = pgTable("service_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestNumber: text("request_number").notNull().unique(),
  containerId: varchar("container_id").references(() => containers.id).notNull(),
  clientId: varchar("client_id").references(() => clients.id).notNull(),
  alertId: varchar("alert_id").references(() => alerts.id),
  assignedTechnicianId: varchar("assigned_technician_id").references(() => technicians.id),
  status: serviceStatusEnum("status").default("pending").notNull(),
  priority: servicePriorityEnum("priority").notNull(),
  issueDescription: text("issue_description").notNull(),
  requiredParts: text("required_parts").array(),
  estimatedDuration: integer("estimated_duration"), // minutes
  scheduledDate: timestamp("scheduled_date"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  serviceNotes: text("service_notes"),
  beforePhotos: text("before_photos").array(),
  afterPhotos: text("after_photos").array(),
  clientApprovalRequired: boolean("client_approval_required").default(false),
  clientApprovedAt: timestamp("client_approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Invoices table
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull().unique(),
  serviceRequestId: varchar("service_request_id").references(() => serviceRequests.id).notNull(),
  clientId: varchar("client_id").references(() => clients.id).notNull(),
  status: invoiceStatusEnum("status").default("pending").notNull(),
  subtotal: integer("subtotal").notNull(), // cents
  tax: integer("tax").notNull(), // cents
  total: integer("total").notNull(), // cents
  itemizedCharges: jsonb("itemized_charges").notNull(), // array of line items
  dueDate: timestamp("due_date").notNull(),
  paidAt: timestamp("paid_at"),
  paymentMethod: text("payment_method"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// WhatsApp Sessions table
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

// WhatsApp Messages table
export const whatsappMessages = pgTable("whatsapp_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => whatsappSessions.id).notNull(),
  messageId: text("message_id").notNull().unique(), // WhatsApp message ID
  direction: text("direction").notNull(), // inbound, outbound
  messageType: text("message_type").notNull(), // text, image, button, list
  content: jsonb("content").notNull(),
  status: text("status"), // sent, delivered, read, failed
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Inventory table
export const inventory = pgTable("inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partNumber: text("part_number").notNull().unique(),
  partName: text("part_name").notNull(),
  category: text("category").notNull(),
  quantityInStock: integer("quantity_in_stock").notNull(),
  reorderLevel: integer("reorder_level").notNull(),
  unitPrice: integer("unit_price").notNull(), // cents
  location: text("location"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Audit Logs table
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

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  client: one(clients, { fields: [users.id], references: [clients.userId] }),
  technician: one(technicians, { fields: [users.id], references: [technicians.userId] }),
  whatsappSessions: many(whatsappSessions),
  auditLogs: many(auditLogs),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  user: one(users, { fields: [clients.userId], references: [users.id] }),
  containers: many(containers),
  serviceRequests: many(serviceRequests),
  invoices: many(invoices),
}));

export const techniciansRelations = relations(technicians, ({ one, many }) => ({
  user: one(users, { fields: [technicians.userId], references: [users.id] }),
  serviceRequests: many(serviceRequests),
}));

export const containersRelations = relations(containers, ({ one, many }) => ({
  client: one(clients, { fields: [containers.assignedClientId], references: [clients.id] }),
  alerts: many(alerts),
  metrics: many(containerMetrics),
  serviceRequests: many(serviceRequests),
}));

export const alertsRelations = relations(alerts, ({ one, many }) => ({
  container: one(containers, { fields: [alerts.containerId], references: [containers.id] }),
  serviceRequests: many(serviceRequests),
}));

export const serviceRequestsRelations = relations(serviceRequests, ({ one }) => ({
  container: one(containers, { fields: [serviceRequests.containerId], references: [containers.id] }),
  client: one(clients, { fields: [serviceRequests.clientId], references: [clients.id] }),
  alert: one(alerts, { fields: [serviceRequests.alertId], references: [alerts.id] }),
  technician: one(technicians, { fields: [serviceRequests.assignedTechnicianId], references: [technicians.id] }),
  invoice: one(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  serviceRequest: one(serviceRequests, { fields: [invoices.serviceRequestId], references: [serviceRequests.id] }),
  client: one(clients, { fields: [invoices.clientId], references: [clients.id] }),
}));

export const whatsappSessionsRelations = relations(whatsappSessions, ({ one, many }) => ({
  user: one(users, { fields: [whatsappSessions.userId], references: [users.id] }),
  messages: many(whatsappMessages),
}));

export const whatsappMessagesRelations = relations(whatsappMessages, ({ one }) => ({
  session: one(whatsappSessions, { fields: [whatsappMessages.sessionId], references: [whatsappSessions.id] }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true });
export const insertTechnicianSchema = createInsertSchema(technicians).omit({ id: true, createdAt: true });
export const insertContainerSchema = createInsertSchema(containers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAlertSchema = createInsertSchema(alerts).omit({ id: true, createdAt: true });
export const insertServiceRequestSchema = createInsertSchema(serviceRequests).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true });
export const insertWhatsappSessionSchema = createInsertSchema(whatsappSessions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInventorySchema = createInsertSchema(inventory).omit({ id: true, createdAt: true, updatedAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
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
export type WhatsappSession = typeof whatsappSessions.$inferSelect;
export type InsertWhatsappSession = z.infer<typeof insertWhatsappSessionSchema>;
export type InventoryItem = typeof inventory.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventorySchema>;
