import 'dotenv/config';
import {
  users,
  customers,
  technicians,
  containers,
  containerMetrics,
  containerOwnershipHistory,
  alerts,
  serviceRequests,
  invoices,
  whatsappSessions,
  whatsappMessages,
  inventory,
  auditLogs,
  scheduledServices,
  feedback,
  emailVerifications,
  inventoryTransactions,
  manuals,
  ragQueries,
  type User,
  type InsertUser,
  type Customer,
  type InsertCustomer,
  type Technician,
  type Container,
  type Alert,
  type ServiceRequest,
  type Invoice,
  type WhatsappSession,
  type ScheduledService,
  type Feedback,
  type InsertFeedback,
  type ContainerMetrics,
  type InventoryItem,
  type EmailVerification,
  type InventoryTransaction,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, gte, sql, isNull } from "drizzle-orm";
import { Pool } from '@neondatabase/serverless';

export interface IStorage {
  // RAG operations
  createManual(manual: { title: string; description: string; fileName: string; filePath: string; uploadedBy: string; brand: string; model: string }): Promise<string>;
  getManual(id: string): Promise<any>;
  getAllManuals(): Promise<any[]>;
  getRagQueryHistory(userId: string, limit?: number): Promise<any[]>;
  
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User>;
  getAllUsers(): Promise<User[]>;

  // Customer operations
  getAllCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomerByUserId(userId: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;

  // Container operations
  getAllContainers(): Promise<Container[]>;
  getContainer(id: string): Promise<Container | undefined>;
  getContainerByContainerId(containerId: string): Promise<Container | undefined>;
  getContainerByOrbcommId(orbcommDeviceId: string): Promise<Container | undefined>;
  getContainerByCode(containerCode: string): Promise<Container | undefined>;
  getContainersByCustomer(customerId: string): Promise<Container[]>;
  createContainer(container: any): Promise<Container>;
  updateContainer(id: string, container: any): Promise<Container>;
  updateContainerLocation(containerId: string, locationData: { lat: number; lng: number; timestamp: string; source: string }): Promise<void>;
  updateContainerTelemetry(containerId: string, telemetryData: {
    lastAssetId: string;
    timestamp: string;
    latitude?: number;
    longitude?: number;
    temperature?: number;
    rawData: any;
  }): Promise<Container>;
  getContainerLocationHistory(containerId: string): Promise<any[]>;
  getContainerServiceHistory(containerId: string): Promise<any[]>;
  getContainerOwnershipHistory(containerId: string): Promise<any[]>;
  getContainerMetrics(containerId: string): Promise<any[]>;
  assignContainerToCustomer(containerId: string, customerId: string, assignmentDate: Date, expectedReturnDate: Date): Promise<Container>;
  unassignContainer(containerId: string): Promise<Container>;
  getIotEnabledContainers(): Promise<Container[]>;
  getContainersByStatus(status: string): Promise<Container[]>;

  // Alert operations
  getAllAlerts(): Promise<Alert[]>;
  getAlert(id: string): Promise<Alert | undefined>;
  getAlertsByContainer(containerId: string): Promise<Alert[]>;
  getOpenAlerts(): Promise<Alert[]>;
  createAlert(alert: any): Promise<Alert>;
  getAlertsBySeverity(severity: string): Promise<Alert[]>;
  getAlertsBySource(source: string): Promise<Alert[]>;
  acknowledgeAlert(alertId: string, userId: string): Promise<Alert>;
  resolveAlert(alertId: string, resolutionMethod: string): Promise<Alert>;
  updateAlert(id: string, alert: any): Promise<Alert>;

  // Service Request operations
  getAllServiceRequests(): Promise<ServiceRequest[]>;
  getServiceRequest(id: string): Promise<ServiceRequest | undefined>;
  getServiceRequestsByCustomer(customerId: string): Promise<ServiceRequest[]>;
  getServiceRequestsByTechnician(technicianId: string): Promise<ServiceRequest[]>;
  getPendingServiceRequests(): Promise<ServiceRequest[]>;
  createServiceRequest(request: any): Promise<ServiceRequest>;
  updateServiceRequest(id: string, request: any): Promise<ServiceRequest>;
  getServiceRequestsByStatus(status: string): Promise<ServiceRequest[]>;
  getServiceRequestsByPriority(priority: string): Promise<ServiceRequest[]>;
  assignServiceRequest(serviceRequestId: string, technicianId: string, scheduledDate?: Date, scheduledTimeWindow?: string): Promise<ServiceRequest>;
  startServiceRequest(serviceRequestId: string): Promise<ServiceRequest>;
  completeServiceRequest(serviceRequestId: string, resolutionNotes: string, usedParts: string[], beforePhotos: string[], afterPhotos: string[]): Promise<ServiceRequest>;
  cancelServiceRequest(serviceRequestId: string, reason: string): Promise<ServiceRequest>;
  getServiceRequestTimeline(serviceRequestId: string): Promise<any[]>;
  getScheduledService(id: string): Promise<ScheduledService | undefined>;

  // Technician operations
  getAllTechnicians(): Promise<Technician[]>;
  getTechnician(id: string): Promise<Technician | undefined>;
  getAvailableTechnicians(): Promise<Technician[]>;
  updateTechnicianStatus(id: string, status: string): Promise<Technician>;
  getTechnicianPerformance(technicianId: string): Promise<any>;
  getTechnicianSchedule(technicianId: string, date: string): Promise<any[]>;
  getTechniciansBySkill(skill: string): Promise<Technician[]>;
  getTechniciansByLocation(location: string): Promise<Technician[]>;
  updateTechnicianLocation(technicianId: string, location: any): Promise<Technician>;
  createTechnician(technician: any): Promise<Technician>;
  updateTechnician(technicianId: string, technician: any): Promise<Technician>;

  // WhatsApp operations
  getWhatsappSession(phoneNumber: string): Promise<WhatsappSession | undefined>;
  createWhatsappSession(session: any): Promise<WhatsappSession>;
  updateWhatsappSession(id: string, session: any): Promise<WhatsappSession>;
  createWhatsappMessage(message: any): Promise<any>;
  getWhatsAppMessageById(messageId: string): Promise<any | undefined>;
  getRecentWhatsAppMessages(userId: string, limit?: number): Promise<any[]>;

  // Audit logs
  createAuditLog(entry: { userId?: string; action: string; entityType: string; entityId?: string; changes?: any; source: string; ipAddress?: string; timestamp?: Date }): Promise<any>;

  // Invoice operations
  getAllInvoices(): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(invoice: any): Promise<Invoice>;
  updateInvoice(id: string, invoice: any): Promise<Invoice>;
  getInvoicesByCustomer(customerId: string): Promise<Invoice[]>;

  // Feedback operations
  getAllFeedback(): Promise<any[]>;
  getFeedback(id: string): Promise<any | undefined>;
  createFeedback(feedback: any): Promise<any>;
  updateFeedback(id: string, feedback: any): Promise<any>;
  getFeedbackByServiceRequest(serviceRequestId: string): Promise<any | undefined>;

  // Dashboard stats
  getDashboardStats(): Promise<any>;

  // Scheduled Services operations
  getScheduledServicesByDate(date: string): Promise<ScheduledService[]>;
  getScheduledServicesByTechnician(technicianId: string, date?: string): Promise<ScheduledService[]>;
  createScheduledService(service: any): Promise<ScheduledService>;
  updateScheduledService(id: string, service: any): Promise<ScheduledService>;
  getNextScheduledService(technicianId: string): Promise<ScheduledService | undefined>;
  getUsersByRole(role: string): Promise<User[]>;
}

export class DatabaseStorage implements IStorage {
  // RAG operations
  async createManual(manual: { title: string; description: string; fileName: string; filePath: string; uploadedBy: string; brand: string; model: string }): Promise<string> {
    const result = await db.insert(manuals).values({
      title: manual.title,
      description: manual.description,
      fileName: manual.fileName,
      filePath: manual.filePath,
      uploadedBy: manual.uploadedBy,
      brand: manual.brand,
      model: manual.model
    }).returning();
    
    return result[0].id;
  }

  async getManual(id: string): Promise<any> {
    const result = await db.select().from(manuals).where(eq(manuals.id, id));
    return result[0];
  }

  async getAllManuals(): Promise<any[]> {
    return await db.select().from(manuals).orderBy(desc(manuals.createdAt));
  }

  async getRagQueryHistory(userId: string, limit: number = 20): Promise<any[]> {
    return await db.select().from(ragQueries)
      .where(eq(ragQueries.userId, userId))
      .orderBy(desc(ragQueries.createdAt))
      .limit(limit);
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phoneNumber, phoneNumber));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updateData: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async getCustomerByUserId(userId: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.userId, userId));
    return customer;
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values(insertCustomer).returning();
    return customer;
  }

  async updateCustomer(id: string, updateData: Partial<InsertCustomer>): Promise<Customer> {
    const [updated] = await db
      .update(customers)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return updated;
  }

  async deleteCustomer(id: string): Promise<Customer> {
    const [deleted] = await db
      .delete(customers)
      .where(eq(customers.id, id))
      .returning();
    return deleted;
  }

  async getAllContainers(): Promise<Container[]> {
    const containerList = await db.select().from(containers).orderBy(containers.id);
    return containerList.map(container => this.parseContainerData(container));
  }

  // Helper function to parse decimal fields and ensure currentLocation
  private parseContainerData(container: Container): Container {
    if (!container) return container;

    // Parse decimal fields from strings to numbers
    const parsedContainer = {
      ...container,
      locationLat: container.locationLat ? parseFloat(container.locationLat as string) : undefined,
      locationLng: container.locationLng ? parseFloat(container.locationLng as string) : undefined
    };

    // Ensure container has currentLocation data for map display
    if (!parsedContainer.currentLocation) {
      // Use telemetry location if available
      if (parsedContainer.locationLat && parsedContainer.locationLng) {
        parsedContainer.currentLocation = {
          lat: parsedContainer.locationLat,
          lng: parsedContainer.locationLng,
          timestamp: parsedContainer.lastSyncedAt?.toISOString(),
          source: 'orbcomm'
        };
      } else {
        // Fallback to default location
        const defaultLocations = [
          { lat: 33.7434, lng: -118.2726, name: "LA Port" },
          { lat: 32.7157, lng: -117.1611, name: "San Diego" },
          { lat: 37.8044, lng: -122.2712, name: "Oakland" },
          { lat: 33.7701, lng: -118.1937, name: "Long Beach" }
        ];
        const defaultLocation = defaultLocations[Math.floor(Math.random() * defaultLocations.length)];

        parsedContainer.currentLocation = {
          lat: defaultLocation.lat,
          lng: defaultLocation.lng,
          address: defaultLocation.name,
          source: 'default'
        };
      }
    }

    return parsedContainer;
  }

  async getContainer(id: string): Promise<Container | undefined> {
    const [container] = await db.select().from(containers).where(eq(containers.id, id));
    return container ? this.parseContainerData(container) : undefined;
  }

  async getContainerByContainerId(containerId: string): Promise<Container | undefined> {
    const [container] = await db.select().from(containers).where(eq(containers.containerCode, containerId));
    return container ? this.parseContainerData(container) : undefined;
  }

  async getContainersByCustomer(customerId: string): Promise<Container[]> {
    const containerList = await db.select().from(containers).where(eq(containers.currentCustomerId, customerId));
    return containerList.map(container => this.parseContainerData(container));
  }

  async createContainer(container: any): Promise<Container> {
    const [newContainer] = await db.insert(containers).values(container).returning();
    return newContainer;
  }

  async updateContainer(id: string, container: any): Promise<Container> {
    const [updated] = await db
      .update(containers)
      .set({ ...container, updatedAt: new Date() })
      .where(eq(containers.id, id))
      .returning();
    return updated;
  }

  async getContainerByOrbcommId(orbcommDeviceId: string): Promise<Container | undefined> {
    const [container] = await db.select().from(containers).where(eq(containers.orbcommDeviceId, orbcommDeviceId));
    return container ? this.parseContainerData(container) : undefined;
  }

  async getContainerByCode(containerCode: string): Promise<Container | undefined> {
    const [container] = await db.select().from(containers).where(eq(containers.containerCode, containerCode));
    return container ? this.parseContainerData(container) : undefined;
  }

  async updateContainerLocation(containerId: string, locationData: { lat: number; lng: number; timestamp: string; source: string }): Promise<void> {
    await db
      .update(containers)
      .set({
        currentLocation: {
          lat: locationData.lat,
          lng: locationData.lng,
          timestamp: locationData.timestamp,
          source: locationData.source
        },
        locationLat: locationData.lat.toString(),
        locationLng: locationData.lng.toString(),
        lastUpdateTimestamp: new Date(locationData.timestamp),
        lastSyncedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(containers.id, containerId));
  }

  // Enhanced method for updating container telemetry data (using new schema)
  async updateContainerTelemetry(containerId: string, telemetryData: {
    lastAssetId: string;
    timestamp: string;
    latitude?: number;
    longitude?: number;
    temperature?: number;
    rawData: any;
  }): Promise<Container> {
    const [updated] = await db
      .update(containers)
      .set({
        // Update with new telemetry fields
        locationLat: telemetryData.latitude ? telemetryData.latitude.toString() : null,
        locationLng: telemetryData.longitude ? telemetryData.longitude.toString() : null,
        currentLocation: (telemetryData.latitude && telemetryData.longitude) ? {
          lat: telemetryData.latitude,
          lng: telemetryData.longitude,
          timestamp: telemetryData.timestamp,
          source: 'orbcomm'
        } : undefined,
        lastUpdateTimestamp: new Date(telemetryData.timestamp),
        lastTelemetry: telemetryData.rawData, // Store full raw JSON as JSONB
        lastSyncedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(containers.id, containerId))
      .returning();

    return updated;
  }

  async getAllAlerts(): Promise<Alert[]> {
    return await db.select().from(alerts).orderBy(desc(alerts.detectedAt));
  }

  async getAlert(id: string): Promise<Alert | undefined> {
    const [alert] = await db.select().from(alerts).where(eq(alerts.id, id));
    return alert;
  }

  async getAlertsByContainer(containerId: string): Promise<Alert[]> {
    return await db.select().from(alerts).where(eq(alerts.containerId, containerId)).orderBy(desc(alerts.detectedAt));
  }

  async getOpenAlerts(): Promise<Alert[]> {
    return await db
      .select()
      .from(alerts)
      .where(isNull(alerts.resolvedAt))
      .orderBy(desc(alerts.detectedAt));
  }

  async createAlert(alert: any): Promise<Alert> {
    const [newAlert] = await db.insert(alerts).values(alert).returning();
    return newAlert;
  }

  async updateAlert(id: string, alert: any): Promise<Alert> {
    const [updated] = await db.update(alerts).set(alert).where(eq(alerts.id, id)).returning();
    return updated;
  }

  async getAllServiceRequests(): Promise<ServiceRequest[]> {
    return await db.select().from(serviceRequests).orderBy(desc(serviceRequests.createdAt));
  }

  async getServiceRequest(id: string): Promise<ServiceRequest | undefined> {
    const [request] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, id));
    return request;
  }

  async getServiceRequestsByCustomer(customerId: string): Promise<ServiceRequest[]> {
    return await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.customerId, customerId))
      .orderBy(desc(serviceRequests.createdAt));
  }

  async getServiceRequestsByTechnician(technicianId: string): Promise<ServiceRequest[]> {
    return await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.assignedTechnicianId, technicianId))
      .orderBy(desc(serviceRequests.createdAt));
  }

  async getServiceRequestsByStatus(status: string): Promise<ServiceRequest[]> {
    return await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.status, status))
      .orderBy(desc(serviceRequests.createdAt));
  }

  async getPendingServiceRequests(): Promise<ServiceRequest[]> {
    return await db
      .select()
      .from(serviceRequests)
      .where(and(
        isNull(serviceRequests.actualEndTime),
        isNull(serviceRequests.actualStartTime)
      ))
      .orderBy(desc(serviceRequests.createdAt));
  }

  async createServiceRequest(request: any): Promise<ServiceRequest> {
    const [newRequest] = await db.insert(serviceRequests).values(request).returning();
    return newRequest;
  }

  async updateServiceRequest(id: string, request: any): Promise<ServiceRequest> {
    const [updated] = await db
      .update(serviceRequests)
      .set({ ...request, updatedAt: new Date() })
      .where(eq(serviceRequests.id, id))
      .returning();
    return updated;
  }

  async getAllTechnicians(): Promise<Technician[]> {
    // Return technicians enriched with linked user fields for UI display
    try {
      const rows = await db
        .select({
          tech: technicians,
          userName: users.name,
          userEmail: users.email,
          userPhone: users.phoneNumber,
        })
        .from(technicians)
        .leftJoin(users, eq(technicians.userId, users.id));

      return rows.map((r: any) => ({
        ...r.tech,
        name: r.userName,
        email: r.userEmail,
        phone: r.userPhone,
      }));
    } catch (error) {
      console.error("Error in getAllTechnicians:", error);
      // Fallback: return technicians without user data
      try {
        const techRows = await db.select().from(technicians);
        return techRows.map((tech: any) => ({
          ...tech,
          name: null,
          email: null,
          phone: null,
        }));
      } catch (fallbackError) {
        console.error("Fallback also failed:", fallbackError);
        // Last resort: return empty array
        return [];
      }
    }
  }

  async getTechnician(id: string): Promise<Technician | undefined> {
    try {
      const [row] = await db
        .select({
          tech: technicians,
          userName: users.name,
          userEmail: users.email,
          userPhone: users.phoneNumber,
        })
        .from(technicians)
        .leftJoin(users, eq(technicians.userId, users.id))
        .where(eq(technicians.id, id));
      if (!row) return undefined as any;
      return { ...row.tech, name: row.userName, email: row.userEmail, phone: row.userPhone } as any;
    } catch (error) {
      console.error("Error in getTechnician:", error);
      // Fallback: return technician without user data
      try {
        const [techRow] = await db.select().from(technicians).where(eq(technicians.id, id));
        if (!techRow) return undefined as any;
        return { ...techRow, name: null, email: null, phone: null } as any;
      } catch (fallbackError) {
        console.error("Technician fallback failed:", fallbackError);
        return undefined as any;
      }
    }
  }

  async getAvailableTechnicians(): Promise<Technician[]> {
    // Get technicians that are available or on_duty
    const techs = await db.select().from(technicians).where(
      sql`${technicians.status} IN ('available', 'on_duty')`
    );
    console.log('[Storage] Available technicians found:', techs.length);
    return techs;
  }

  async updateTechnicianStatus(id: string, status: string): Promise<Technician> {
    const [updated] = await db
      .update(technicians)
      .set({ status: status as any })
      .where(eq(technicians.id, id))
      .returning();
    return updated;
  }

  async getWhatsappSession(phoneNumber: string): Promise<WhatsappSession | undefined> {
    const [session] = await db
      .select()
      .from(whatsappSessions)
      .where(and(eq(whatsappSessions.phoneNumber, phoneNumber), eq(whatsappSessions.isActive, true)))
      .orderBy(desc(whatsappSessions.createdAt));
    return session;
  }

  async createWhatsappSession(session: any): Promise<WhatsappSession> {
    const [newSession] = await db.insert(whatsappSessions).values(session).returning();
    return newSession;
  }

  async updateWhatsappSession(id: string, session: any): Promise<WhatsappSession> {
    const [updated] = await db
      .update(whatsappSessions)
      .set({ ...session, updatedAt: new Date() })
      .where(eq(whatsappSessions.id, id))
      .returning();
    return updated;
  }

  async createWhatsappMessage(message: any): Promise<any> {
    const [newMessage] = await db.insert(whatsappMessages).values(message).returning();
    return newMessage;
  }

  async getWhatsAppMessageById(messageId: string): Promise<any | undefined> {
    const [message] = await db
      .select()
      .from(whatsappMessages)
      .where(eq(whatsappMessages.whatsappMessageId, messageId));
    return message;
  }

  async getRecentWhatsAppMessages(userId: string, limit: number = 50): Promise<any[]> {
    return await db
      .select()
      .from(whatsappMessages)
      .where(eq(whatsappMessages.recipientId, userId))
      .orderBy(desc(whatsappMessages.sentAt))
      .limit(limit);
  }

  async createAuditLog(entry: { userId?: string; action: string; entityType: string; entityId?: string; changes?: any; source: string; ipAddress?: string; timestamp?: Date }): Promise<any> {
    const [log] = await db
      .insert(auditLogs)
      .values({
        userId: entry.userId || null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId || null,
        changes: entry.changes || null,
        source: entry.source,
        ipAddress: entry.ipAddress || null,
        timestamp: entry.timestamp || new Date(),
      })
      .returning();
    return log;
  }

  async getAllCustomers(): Promise<Customer[]> {
    return await db.select().from(customers).orderBy(customers.companyName);
  }

  async getAllInvoices(): Promise<Invoice[]> {
    return await db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async createInvoice(invoice: any): Promise<Invoice> {
    const [newInvoice] = await db.insert(invoices).values(invoice).returning();
    return newInvoice;
  }

  async updateInvoice(id: string, invoice: any): Promise<Invoice> {
    const [updated] = await db
      .update(invoices)
      .set({ ...invoice, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    return updated;
  }

  async getAllFeedback(): Promise<any[]> {
    return await db.select().from(feedback).orderBy(desc(feedback.submittedAt));
  }

  async getFeedback(id: string): Promise<any | undefined> {
    const [feedbackItem] = await db.select().from(feedback).where(eq(feedback.id, id));
    return feedbackItem;
  }

  async createFeedback(feedbackData: any): Promise<any> {
    const [newFeedback] = await db.insert(feedback).values(feedbackData).returning();
    return newFeedback;
  }

  async updateFeedback(id: string, feedbackData: any): Promise<any> {
    const [updated] = await db
      .update(feedback)
      .set(feedbackData)
      .where(eq(feedback.id, id))
      .returning();
    return updated;
  }

  async getFeedbackByServiceRequest(serviceRequestId: string): Promise<any | undefined> {
    const [feedbackRecord] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.serviceRequestId, serviceRequestId));
    return feedbackRecord;
  }

  async getDashboardStats(): Promise<any> {
    const totalContainers = await db
      .select({ count: sql<number>`count(*)` })
      .from(containers);

    // Count unresolved alerts (where resolved_at is null)
    const activeAlerts = await db
      .select({ count: sql<number>`count(*)` })
      .from(alerts)
      .where(isNull(alerts.resolvedAt));

    // Count pending service requests (where completed_at is null and started_at is null)
    const pendingServices = await db
      .select({ count: sql<number>`count(*)` })
      .from(serviceRequests)
      .where(and(
        isNull(serviceRequests.actualEndTime),
        isNull(serviceRequests.actualStartTime)
      ));

    // Count containers with assigned clients (active containers)
    const activeContainersCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(containers)
      .where(sql`assigned_client_id IS NOT NULL OR ${containers.currentCustomerId} IS NOT NULL`);

    return {
      totalContainers: totalContainers[0]?.count || 0,
      activeContainers: activeContainersCount[0]?.count || 0,
      activeAlerts: activeAlerts[0]?.count || 0,
      pendingServices: pendingServices[0]?.count || 0,
      fleetUtilization: totalContainers[0]?.count 
        ? Math.round((Number(activeContainersCount[0]?.count || 0) / Number(totalContainers[0].count)) * 100) 
        : 0,
    };
  }

  // Enhanced Container Management Methods according to PRD
  async getContainerLocationHistory(containerId: string): Promise<any[]> {
    return await db
      .select()
      .from(containerMetrics)
      .where(eq(containerMetrics.containerId, containerId))
      .orderBy(desc(containerMetrics.timestamp))
      .limit(100);
  }

  async getContainerServiceHistory(containerId: string): Promise<any[]> {
    return await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.containerId, containerId))
      .orderBy(desc(serviceRequests.createdAt));
  }

  async getContainerOwnershipHistory(containerId: string): Promise<any[]> {
    // Get ownership history with customer details
    const history = await db
      .select({
        id: containerOwnershipHistory.id,
        containerId: containerOwnershipHistory.containerId,
        customerId: containerOwnershipHistory.customerId,
        orderType: containerOwnershipHistory.orderType,
        quotationNo: containerOwnershipHistory.quotationNo,
        orderReceivedNumber: containerOwnershipHistory.orderReceivedNumber,
        internalSalesOrderNo: containerOwnershipHistory.internalSalesOrderNo,
        purchaseOrderNumber: containerOwnershipHistory.purchaseOrderNumber,
        startDate: containerOwnershipHistory.startDate,
        endDate: containerOwnershipHistory.endDate,
        tenure: containerOwnershipHistory.tenure,
        basicAmount: containerOwnershipHistory.basicAmount,
        securityDeposit: containerOwnershipHistory.securityDeposit,
        isCurrent: containerOwnershipHistory.isCurrent,
        purchaseDetails: containerOwnershipHistory.purchaseDetails,
        createdAt: containerOwnershipHistory.createdAt,
        updatedAt: containerOwnershipHistory.updatedAt,
        customerName: customers.companyName,
        contactPerson: customers.contactPerson,
        phone: customers.phone,
      })
      .from(containerOwnershipHistory)
      .leftJoin(customers, eq(containerOwnershipHistory.customerId, customers.id))
      .where(eq(containerOwnershipHistory.containerId, containerId))
      .orderBy(desc(containerOwnershipHistory.startDate));

    return history;
  }

  async getContainerMetrics(containerId: string): Promise<any[]> {
    return await db
      .select()
      .from(containerMetrics)
      .where(eq(containerMetrics.containerId, containerId))
      .orderBy(desc(containerMetrics.timestamp))
      .limit(50);
  }

  async assignContainerToCustomer(containerId: string, customerId: string, assignmentDate: Date, expectedReturnDate: Date): Promise<Container> {
    const [updated] = await db
      .update(containers)
      .set({
        currentCustomerId: customerId,
        assignmentDate,
        expectedReturnDate,
        updatedAt: new Date()
      })
      .where(eq(containers.id, containerId))
      .returning();
    return updated;
  }

  async unassignContainer(containerId: string): Promise<Container> {
    const [updated] = await db
      .update(containers)
      .set({
        currentCustomerId: null,
        assignmentDate: null,
        expectedReturnDate: null,
        updatedAt: new Date()
      })
      .where(eq(containers.id, containerId))
      .returning();
    return updated;
  }

  async getIotEnabledContainers(): Promise<Container[]> {
    return await db
      .select()
      .from(containers)
      .where(eq(containers.hasIot, true))
      .orderBy(containers.id);
  }

  async getContainersByStatus(status: string): Promise<Container[]> {
    return await db
      .select()
      .from(containers)
      .where(eq(containers.status, status as any))
      .orderBy(containers.id);
  }

  // Enhanced Alert Management Methods according to PRD
  async getAlertsBySeverity(severity: string): Promise<Alert[]> {
    return await db
      .select()
      .from(alerts)
      .where(eq(alerts.severity, severity as any))
      .orderBy(desc(alerts.detectedAt));
  }

  async getAlertsBySource(source: string): Promise<Alert[]> {
    return await db
      .select()
      .from(alerts)
      .where(eq(alerts.source, source as any))
      .orderBy(desc(alerts.detectedAt));
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<Alert> {
    const [updated] = await db
      .update(alerts)
      .set({
        acknowledgedAt: new Date(),
        acknowledgedBy: userId
      })
      .where(eq(alerts.id, alertId))
      .returning();
    return updated;
  }

  async resolveAlert(alertId: string, resolutionMethod: string): Promise<Alert> {
    const [updated] = await db
      .update(alerts)
      .set({
        resolvedAt: new Date(),
        resolutionMethod: resolutionMethod as any
      })
      .where(eq(alerts.id, alertId))
      .returning();
    return updated;
  }

  // Enhanced Service Request Management Methods according to PRD
  async getServiceRequestsByStatus(status: string): Promise<ServiceRequest[]> {
    return await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.status, status as any))
      .orderBy(desc(serviceRequests.createdAt));
  }

  async getServiceRequestsByPriority(priority: string): Promise<ServiceRequest[]> {
    return await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.priority, priority as any))
      .orderBy(desc(serviceRequests.createdAt));
  }

  async assignServiceRequest(serviceRequestId: string, technicianId: string, scheduledDate?: Date, scheduledTimeWindow?: string): Promise<ServiceRequest> {
    const updateFields: any = {
      assignedTechnicianId: technicianId,
      status: "scheduled",
      updatedAt: new Date(),
    };
    if (scheduledDate instanceof Date && !isNaN(scheduledDate.getTime())) {
      updateFields.scheduledDate = scheduledDate;
    }
    if (scheduledTimeWindow) {
      updateFields.scheduledTimeWindow = scheduledTimeWindow;
    }
    const [updated] = await db
      .update(serviceRequests)
      .set(updateFields)
      .where(eq(serviceRequests.id, serviceRequestId))
      .returning();
    return updated;
  }

  async startServiceRequest(serviceRequestId: string): Promise<ServiceRequest> {
    const [updated] = await db
      .update(serviceRequests)
      .set({
        status: "in_progress",
        actualStartTime: new Date(),
        updatedAt: new Date()
      })
      .where(eq(serviceRequests.id, serviceRequestId))
      .returning();
    return updated;
  }

  async completeServiceRequest(serviceRequestId: string, resolutionNotes: string, usedParts: string[], beforePhotos: string[], afterPhotos: string[]): Promise<ServiceRequest> {
    const [updated] = await db
      .update(serviceRequests)
      .set({
        status: "completed",
        actualEndTime: new Date(),
        resolutionNotes,
        usedParts,
        beforePhotos,
        afterPhotos,
        serviceDuration: sql`EXTRACT(EPOCH FROM (${serviceRequests.actualEndTime} - ${serviceRequests.actualStartTime})) / 60`,
        updatedAt: new Date()
      })
      .where(eq(serviceRequests.id, serviceRequestId))
      .returning();
    return updated;
  }

  async cancelServiceRequest(serviceRequestId: string, reason: string): Promise<ServiceRequest> {
    const [updated] = await db
      .update(serviceRequests)
      .set({
        status: "cancelled",
        resolutionNotes: reason,
        updatedAt: new Date()
      })
      .where(eq(serviceRequests.id, serviceRequestId))
      .returning();
    return updated;
  }

  async getServiceRequestTimeline(serviceRequestId: string): Promise<any[]> {
    // This would typically involve querying audit logs or a timeline table
    // For now, return basic timeline based on service request status changes
    const serviceRequest = await this.getServiceRequest(serviceRequestId);
    if (!serviceRequest) return [];

    const timeline = [];
    
    if (serviceRequest.requestedAt) {
      timeline.push({
        event: "Request Created",
        timestamp: serviceRequest.requestedAt,
        description: "Service request was created"
      });
    }
    
    if (serviceRequest.approvedAt) {
      timeline.push({
        event: "Request Approved",
        timestamp: serviceRequest.approvedAt,
        description: "Service request was approved"
      });
    }
    
    if (serviceRequest.scheduledDate) {
      timeline.push({
        event: "Scheduled",
        timestamp: serviceRequest.scheduledDate,
        description: `Scheduled for ${serviceRequest.scheduledTimeWindow || 'TBD'}`
      });
    }
    
    if (serviceRequest.actualStartTime) {
      timeline.push({
        event: "Service Started",
        timestamp: serviceRequest.actualStartTime,
        description: "Technician started service"
      });
    }
    
    if (serviceRequest.actualEndTime) {
      timeline.push({
        event: "Service Completed",
        timestamp: serviceRequest.actualEndTime,
        description: "Service was completed"
      });
    }

    return timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async getScheduledService(id: string): Promise<ScheduledService | undefined> {
    const [svc] = await db
      .select()
      .from(scheduledServices)
      .where(eq(scheduledServices.id, id))
      .limit(1);
    return svc;
  }

  // Enhanced Technician Management Methods according to PRD
  async getTechnicianPerformance(technicianId: string): Promise<any> {
    const technician = await this.getTechnician(technicianId);
    if (!technician) return null;

    // Get service requests for this technician
    const serviceRequests = await this.getServiceRequestsByTechnician(technicianId);
    const completedServices = serviceRequests.filter(sr => sr.status === 'completed');
    
    // Calculate performance metrics
    const totalServices = completedServices.length;
    const averageRating = technician.averageRating || 0;
    const firstTimeFixRate = totalServices > 0 
      ? (completedServices.filter(sr => !sr.resolutionNotes?.includes('follow-up')).length / totalServices) * 100 
      : 0;

    // Calculate average service duration
    const totalDuration = completedServices.reduce((sum, sr) => sum + (sr.serviceDuration || 0), 0);
    const averageServiceDuration = totalServices > 0 ? totalDuration / totalServices : 0;

    // Get recent performance (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentServices = completedServices.filter(sr => 
      sr.actualEndTime && new Date(sr.actualEndTime) >= thirtyDaysAgo
    );

    return {
      technicianId,
      totalServices,
      averageRating,
      firstTimeFixRate: Math.round(firstTimeFixRate * 100) / 100,
      averageServiceDuration: Math.round(averageServiceDuration),
      recentServices: recentServices.length,
      skills: technician.skills,
      experienceLevel: technician.experienceLevel,
      lastUpdated: new Date()
    };
  }

  async getTechnicianSchedule(technicianId: string, date: string): Promise<any[]> {
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    return await db
      .select()
      .from(serviceRequests)
      .where(and(
        eq(serviceRequests.assignedTechnicianId, technicianId),
        sql`${serviceRequests.scheduledDate} >= ${startOfDay}`,
        sql`${serviceRequests.scheduledDate} <= ${endOfDay}`
      ))
      .orderBy(serviceRequests.scheduledDate);
  }

  async getTechniciansBySkill(skill: string): Promise<Technician[]> {
    return await db
      .select()
      .from(technicians)
      .where(sql`${technicians.skills} @> ${JSON.stringify([skill])}`)
      .orderBy(technicians.id);
  }

  async getTechniciansByLocation(location: string): Promise<Technician[]> {
    // This would typically involve geographic proximity calculation
    // For now, return technicians whose base location contains the location string
    return await db
      .select()
      .from(technicians)
      .where(sql`${technicians.baseLocation}::text ILIKE ${`%${location}%`}`)
      .orderBy(technicians.id);
  }

  async updateTechnicianLocation(technicianId: string, location: any): Promise<Technician> {
    const [updated] = await db
      .update(technicians)
      .set({
        baseLocation: location,
        updatedAt: new Date()
      })
      .where(eq(technicians.id, technicianId))
      .returning();
    return updated;
  }

  async createTechnician(technicianData: any): Promise<Technician> {
    const [technician] = await db
      .insert(technicians)
      .values({
        ...technicianData,
        createdAt: new Date()
      })
      .returning();
    return technician;
  }

  async updateTechnician(technicianId: string, technicianData: any): Promise<Technician> {
    const [updated] = await db
      .update(technicians)
      .set({
        ...technicianData,
        updatedAt: new Date()
      })
      .where(eq(technicians.id, technicianId))
      .returning();

    // Enrich with user fields for consistency in responses
    const user = await this.getUser(updated.userId);
    return { ...updated, name: user?.name, email: user?.email, phone: user?.phoneNumber } as any;
  }

  async getTechnicianByUserId(userId: string): Promise<Technician | undefined> {
    const [row] = await db
      .select({
        tech: technicians,
        userName: users.name,
        userEmail: users.email,
        userPhone: users.phoneNumber,
      })
      .from(technicians)
      .leftJoin(users, eq(technicians.userId, users.id))
      .where(eq(technicians.userId, userId));
    if (!row) return undefined as any;
    return { ...row.tech, name: row.userName, email: row.userEmail, phone: row.userPhone } as any;
  }

  // Invoice management methods
  async getAllInvoices(): Promise<any[]> {
    return await db
      .select()
      .from(invoices)
      .orderBy(desc(invoices.issueDate));
  }

  async getInvoice(invoiceId: string): Promise<any> {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);
    return invoice;
  }

  async createInvoice(invoiceData: any): Promise<any> {
    const [invoice] = await db
      .insert(invoices)
      .values({
        ...invoiceData,
        createdAt: new Date()
      })
      .returning();
    return invoice;
  }

  async updateInvoice(invoiceId: string, invoiceData: any): Promise<any> {
    const [updated] = await db
      .update(invoices)
      .set({
        ...invoiceData,
        updatedAt: new Date()
      })
      .where(eq(invoices.id, invoiceId))
      .returning();
    return updated;
  }

  async getInvoicesByCustomer(customerId: string): Promise<Invoice[]> {
    return await db
      .select()
      .from(invoices)
      .where(eq(invoices.customerId, customerId))
      .orderBy(desc(invoices.createdAt));
  }

  // Feedback management methods
  async getAllFeedback(): Promise<any[]> {
    return await db
      .select()
      .from(feedback)
      .orderBy(desc(feedback.submittedAt));
  }

  async getFeedbackByServiceRequest(serviceRequestId: string): Promise<any> {
    const [fb] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.serviceRequestId, serviceRequestId))
      .limit(1);
    return fb;
  }

  async getFeedbackByTechnician(technicianId: string): Promise<any[]> {
    return await db
      .select()
      .from(feedback)
      .where(eq(feedback.technicianId, technicianId))
      .orderBy(desc(feedback.submittedAt));
  }

  async createFeedback(feedbackData: any): Promise<any> {
    const [fb] = await db
      .insert(feedback)
      .values({
        ...feedbackData,
        createdAt: new Date()
      })
      .returning();
    return fb;
  }

  // Service request update method
  async updateServiceRequest(serviceRequestId: string, serviceRequestData: any): Promise<any> {
    const [updated] = await db
      .update(serviceRequests)
      .set({
        ...serviceRequestData,
        updatedAt: new Date()
      })
      .where(eq(serviceRequests.id, serviceRequestId))
      .returning();
    return updated;
  }

  // Inventory management methods
  async getAllInventoryItems(): Promise<any[]> {
    // If an external source table is configured, read live from it
    const srcTable = process.env.INVENTORY_SOURCE_TABLE;
    if (srcTable) {
      const col = (name: string, dflt?: string) => process.env[name] || dflt || '';
      const COL_ID = col('INVENTORY_COL_ID');
      const COL_PN = col('INVENTORY_COL_PART_NUMBER');
      const COL_NAME = col('INVENTORY_COL_PART_NAME');
      const COL_CAT = col('INVENTORY_COL_CATEGORY');
      const COL_QTY = col('INVENTORY_COL_QTY');
      const COL_REO = col('INVENTORY_COL_REORDER');
      const COL_PRICE = col('INVENTORY_COL_PRICE');
      const COL_LOC = col('INVENTORY_COL_LOCATION');
      const COL_CREATED = col('INVENTORY_COL_CREATED_AT');
      const COL_UPDATED = col('INVENTORY_COL_UPDATED_AT');

      if (!COL_PN || !COL_NAME || !COL_CAT) {
        throw new Error(
          'External inventory mapping incomplete. Please set INVENTORY_COL_PART_NUMBER, INVENTORY_COL_PART_NAME, and INVENTORY_COL_CATEGORY.'
        );
      }

      // Build a dynamic SQL selecting and mapping columns. Note: identifiers come from env - ensure they are correct.
      const QTY_EXPR = COL_QTY ? `"${COL_QTY}"` : '0';
      const REO_EXPR = COL_REO ? `"${COL_REO}"` : '0';
      const PRICE_EXPR = COL_PRICE ? `"${COL_PRICE}"` : '0';
      const LOC_EXPR = COL_LOC ? `COALESCE("${COL_LOC}"::text, NULL)` : 'NULL';
      const CREATED_EXPR = COL_CREATED ? `COALESCE("${COL_CREATED}", NOW())` : 'NOW()';
      const UPDATED_EXPR = COL_UPDATED ? `COALESCE("${COL_UPDATED}", NOW())` : 'NOW()';
      const queryText = `
        SELECT
          COALESCE(${COL_ID ? `"${COL_ID}"::text` : `"${COL_PN}"::text`}) AS id,
          COALESCE("${COL_PN}"::text, '')                                  AS part_number,
          COALESCE("${COL_NAME}"::text, 'Unnamed Part')                    AS part_name,
          COALESCE("${COL_CAT}"::text, 'general')                           AS category,
          COALESCE(${QTY_EXPR}::int, 0)                                      AS quantity_in_stock,
          COALESCE(${REO_EXPR}::int, 0)                                      AS reorder_level,
          COALESCE(${PRICE_EXPR}::numeric, 0)::numeric(10,2)                 AS unit_price,
          ${LOC_EXPR}                                                        AS location,
          ${CREATED_EXPR}                                                    AS created_at,
          ${UPDATED_EXPR}                                                    AS updated_at
        FROM ${srcTable}
        ORDER BY 3`;

      const externalUrl = process.env.INVENTORY_SOURCE_DATABASE_URL;
      let rows: any[] = [];
      if (externalUrl) {
        const pool = new Pool({ connectionString: externalUrl });
        try {
          const res = await pool.query(queryText);
          rows = res.rows as any[];
        } finally {
          await pool.end();
        }
      } else {
        const q = sql.raw(queryText);
        rows = await db.execute(q) as any[];
      }
      // Normalize keys to match drizzle inventory schema consumers
      return (rows as any[]).map((r: any) => ({
        id: r.id,
        partNumber: r.part_number,
        partName: r.part_name,
        category: r.category,
        quantityInStock: Number(r.quantity_in_stock) || 0,
        reorderLevel: Number(r.reorder_level) || 0,
        unitPrice: Number(r.unit_price) || 0,
        location: r.location || null,
        createdAt: r.created_at ?? new Date(),
        updatedAt: r.updated_at ?? new Date(),
      }));
    }

    // Default: use local inventory table managed by drizzle schema
    return await db
      .select()
      .from(inventory)
      .orderBy(inventory.partName);
  }

  async getInventoryItem(itemId: string): Promise<any> {
    const [item] = await db
      .select()
      .from(inventory)
      .where(eq(inventory.id, itemId))
      .limit(1);
    return item;
  }

  async createInventoryItem(itemData: any): Promise<any> {
    const [item] = await db
      .insert(inventory)
      .values({
        ...itemData,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return item;
  }

  async updateInventoryItem(itemId: string, itemData: any): Promise<any> {
    const [updated] = await db
      .update(inventory)
      .set({
        ...itemData,
        updatedAt: new Date()
      })
      .where(eq(inventory.id, itemId))
      .returning();
    return updated;
  }

  async deleteInventoryItem(itemId: string): Promise<void> {
    await db
      .delete(inventory)
      .where(eq(inventory.id, itemId));
  }

  async getInventoryTransactions(itemId?: string, limit: number = 100): Promise<any[]> {
    let query = db
      .select()
      .from(inventoryTransactions)
      .where(sql`1=1`) // Always true condition to satisfy where requirement
      .orderBy(desc(inventoryTransactions.timestamp))
      .limit(limit);

    if (itemId) {
      query = query.where(eq(inventoryTransactions.itemId, itemId));
    }

    return await query;
  }

  async createInventoryTransaction(transactionData: any): Promise<any> {
    const [transaction] = await db
      .insert(inventoryTransactions)
      .values({
        ...transactionData,
        createdAt: new Date()
      })
      .returning();
    return transaction;
  }

  // Scheduled Services operations
  async getScheduledServicesByDate(date: string): Promise<ScheduledService[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await db
      .select()
      .from(scheduledServices)
      .where(and(
        sql`${scheduledServices.scheduledDate} >= ${startOfDay}`,
        sql`${scheduledServices.scheduledDate} <= ${endOfDay}`
      ))
      .orderBy(scheduledServices.sequenceNumber);
  }

  async getScheduledServicesByTechnician(technicianId: string, date?: string): Promise<ScheduledService[]> {
    let query = db
      .select()
      .from(scheduledServices)
      .where(eq(scheduledServices.technicianId, technicianId))
      .orderBy(scheduledServices.sequenceNumber);

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      query = query.where(and(
        sql`${scheduledServices.scheduledDate} >= ${startOfDay}`,
        sql`${scheduledServices.scheduledDate} <= ${endOfDay}`
      ));
    }

    return await query;
  }

  async createScheduledService(service: any): Promise<ScheduledService> {
    const [scheduledService] = await db
      .insert(scheduledServices)
      .values({
        ...service,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return scheduledService;
  }

  async updateScheduledService(id: string, service: any): Promise<ScheduledService> {
    const [updated] = await db
      .update(scheduledServices)
      .set({
        ...service,
        updatedAt: new Date()
      })
      .where(eq(scheduledServices.id, id))
      .returning();
    return updated;
  }

  async getNextScheduledService(technicianId: string): Promise<ScheduledService | undefined> {
    const services = await db
      .select()
      .from(scheduledServices)
      .where(and(
        eq(scheduledServices.technicianId, technicianId),
        eq(scheduledServices.status, 'scheduled'),
        gte(scheduledServices.scheduledDate, new Date())
      ))
      .orderBy(asc(scheduledServices.sequenceNumber))
      .limit(1);

    return services[0];
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(and(
        eq(users.role, role as any),
        eq(users.isActive, true)
      ))
      .orderBy(users.name);
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }
}

export const storage = new DatabaseStorage();
