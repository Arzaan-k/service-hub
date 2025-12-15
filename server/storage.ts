import 'dotenv/config';
import {
  users,
  customers,
  technicians,
  technicianDocuments,
  containers,
  containerMetrics,
  containerOwnershipHistory,
  alerts,
  serviceRequests,
  courierShipments,
  invoices,
  whatsappSessions,
  whatsappMessages,
  inventory,
  auditLogs,
  scheduledServices,
  feedback,
  emailVerifications,
  inventoryTransactions,
  inventoryIndents,
  inventoryIndentItems,
  manuals,
  ragQueries,
  locationMultipliers,
  type User,
  type InsertUser,
  type Customer,
  type InsertCustomer,
  type Technician,
  type Container,
  type Alert,
  type ServiceRequest,
  type CourierShipment,
  type InsertCourierShipment,
  type Invoice,
  type WhatsappSession,
  type ScheduledService,
  type Feedback,
  type InsertFeedback,
  type ContainerMetrics,
  type InventoryItem,
  type EmailVerification,
  type InventoryTransaction,
  technicianTrips,
  technicianTripCosts,
  technicianTripTasks,
  type TechnicianTrip,
  type TechnicianTripCost,
  type TechnicianTripTask,
  type InsertTechnicianTrip,
  type InsertTechnicianTripCost,
  type InsertTechnicianTripTask,
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, and, desc, asc, gte, sql, isNull, ilike, inArray, notInArray } from "drizzle-orm";
import { Pool as NeonPool } from '@neondatabase/serverless';

// Helper to create a pool for external database connections
// External databases (like inventory) are typically cloud-hosted, so we use Neon
function createExternalPool(connectionString: string) {
  return new NeonPool({ connectionString });
}

export interface IStorage {
  ensureServiceRequestAssignmentColumns(): Promise<void>;
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

  // Courier Shipment operations
  getCourierShipment(id: string): Promise<any | undefined>;
  getCourierShipmentByAwb(awbNumber: string): Promise<any | undefined>;
  getCourierShipmentsByServiceRequest(serviceRequestId: string): Promise<any[]>;
  getAllCourierShipments(): Promise<any[]>;
  createCourierShipment(shipment: any): Promise<any>;
  updateCourierShipment(id: string, shipment: any): Promise<any>;
  deleteCourierShipment(id: string): Promise<void>;

  // Technician operations
  getAllTechnicians(): Promise<Technician[]>;
  getTechnician(id: string): Promise<Technician | undefined>;
  getTechnicianByUserId(userId: string): Promise<Technician | undefined>;
  getAvailableTechnicians(): Promise<Technician[]>;
  updateTechnicianStatus(id: string, status: string): Promise<Technician>;
  getTechnicianPerformance(technicianId: string): Promise<any>;
  getTechnicianSchedule(technicianId: string, date: string): Promise<any[]>;
  getTechniciansBySkill(skill: string): Promise<Technician[]>;
  getTechniciansByLocation(location: string): Promise<Technician[]>;
  updateTechnicianLocation(technicianId: string, location: any): Promise<Technician>;
  createTechnician(technician: any): Promise<Technician>;
  updateTechnician(technicianId: string, technician: any): Promise<Technician>;
  
  // Technician document operations
  getTechnicianDocuments(technicianId: string): Promise<any[]>;
  getTechnicianDocument(documentId: string): Promise<any | undefined>;
  createTechnicianDocument(document: any): Promise<any>;
  updateTechnicianDocument(documentId: string, document: any): Promise<any>;
  deleteTechnicianDocument(documentId: string): Promise<void>;

  // WhatsApp operations
  getWhatsappSession(phoneNumber: string): Promise<WhatsappSession | undefined>;
  createWhatsappSession(session: any): Promise<WhatsappSession>;
  updateWhatsappSession(id: string, session: any): Promise<WhatsappSession>;
  createWhatsappMessage(message: any): Promise<any>;
  getWhatsAppMessageById(messageId: string): Promise<any | undefined>;
  getRecentWhatsAppMessages(userId: string, limit?: number): Promise<any[]>;
  getWhatsAppMessagesByServiceRequest(serviceRequestId: string): Promise<any[]>;

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

  // Technician Travel Planning operations
  createTechnicianTrip(trip: any): Promise<any>;
  getTechnicianTrip(id: string): Promise<any | undefined>;
  getTechnicianTrips(filters?: { technicianId?: string; startDate?: Date; endDate?: Date; destinationCity?: string; tripStatus?: string | string[] }): Promise<any[]>;
  updateTechnicianTrip(id: string, trip: any): Promise<any>;
  deleteTechnicianTrip(id: string): Promise<void>;
  getTechnicianTripCosts(tripId: string): Promise<any | undefined>;
  updateTechnicianTripCosts(tripId: string, costs: any): Promise<any>;
  getTechnicianTripTasks(tripId: string): Promise<any[]>;
  createTechnicianTripTask(task: any): Promise<any>;
  updateTechnicianTripTask(id: string, task: any): Promise<any>;
  getLocationMultiplier(city: string): Promise<number>;
  
  // Analytics operations
  getClientAnalytics(range: number): Promise<any[]>;
  getTechnicianAnalytics(range: number): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  async ensureServiceRequestAssignmentColumns(): Promise<void> {
    try {
      await db.execute(sql`
        ALTER TABLE service_requests
        ADD COLUMN IF NOT EXISTS assigned_by text,
        ADD COLUMN IF NOT EXISTS assigned_at timestamptz
      `);
    } catch (error) {
      console.error('[Storage] Failed to ensure service_requests assignment audit columns:', error);
    }
  }

  // RAG operations
  async createManual(manual: { title: string; description?: string; fileName?: string; filePath?: string; uploadedBy: string; brand?: string; model?: string; sourceUrl?: string; version?: string }): Promise<string> {
    const result = await db.insert(manuals).values({
      name: manual.title, // Map title to name field
      sourceUrl: manual.sourceUrl || manual.filePath,
      uploadedBy: manual.uploadedBy,
      version: manual.version,
      meta: {
        description: manual.description,
        fileName: manual.fileName,
        filePath: manual.filePath,
        brand: manual.brand,
        model: manual.model
      }
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
    console.log(`[CREATE USER] Creating user with data:`, {
      ...insertUser,
      password: (insertUser as any).password ? '[HASHED]' : null
    });
    const result = await db.insert(users).values(insertUser as any).returning();
    const user = (result as any[])[0];
    console.log(`[CREATE USER] User created with ID: ${user.id}`);
    return user;
  }

  async updateUser(id: string, updateData: Partial<InsertUser>): Promise<User> {
    console.log(`[UPDATE USER] Updating user ${id} with data:`, {
      ...updateData,
      password: (updateData as any).password ? '[HASHED]' : undefined
    });
    const [user] = await db
      .update(users)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    console.log(`[UPDATE USER] User updated: ${user.id}`);
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
    const result = await db.insert(customers).values(insertCustomer).returning();
    const customer = (result as any[])[0];
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
    console.log(`[DELETE CUSTOMER] Starting deletion for customer: ${id}`);

    // Get the customer to access userId
    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, id)
    });

    if (!customer) {
      console.log(`[DELETE CUSTOMER] Customer ${id} not found`);
      throw new Error("Customer not found");
    }

    console.log(`[DELETE CUSTOMER] Found customer ${id}, userId: ${customer.userId}`);

    // Start transaction for complete cascade delete
    await db.transaction(async (tx) => {
      console.log(`[DELETE CUSTOMER] Starting transaction for customer ${id}`);
      // 1. Unassign all containers from this customer
      await tx
        .update(containers)
        .set({ currentCustomerId: null })
        .where(eq(containers.currentCustomerId, id));

      // 2. Delete container ownership history for this customer
      await tx
        .delete(containerOwnershipHistory)
        .where(eq(containerOwnershipHistory.customerId, id));

      // 3. Get all service requests for this customer to cascade delete related data
      const customerServiceRequests = await tx.query.serviceRequests.findMany({
        where: eq(serviceRequests.customerId, id),
        columns: { id: true }
      });
      const serviceRequestIds = customerServiceRequests.map(sr => sr.id);

      // 4. Delete feedback for this customer's service requests
      if (serviceRequestIds.length > 0) {
        await tx
          .delete(feedback)
          .where(inArray(feedback.serviceRequestId, serviceRequestIds));
      }

      // 5. Delete scheduled services for this customer's service requests
      if (serviceRequestIds.length > 0) {
        await tx
          .delete(scheduledServices)
          .where(inArray(scheduledServices.serviceRequestId, serviceRequestIds));
      }

      // 6. Delete invoices for this customer's service requests
      if (serviceRequestIds.length > 0) {
        await tx
          .delete(invoices)
          .where(inArray(invoices.serviceRequestId, serviceRequestIds));
      }

      // 7. Delete service requests
      await tx
        .delete(serviceRequests)
        .where(eq(serviceRequests.customerId, id));

      // 8. Delete all audit logs for this user (both customer and user actions)
      if (customer.userId) {
        await tx
          .delete(auditLogs)
          .where(eq(auditLogs.userId, customer.userId));
      }

      // 9. Delete audit logs for this customer entity
      await tx
        .delete(auditLogs)
        .where(and(
          eq(auditLogs.entityType, "customer"),
          eq(auditLogs.entityId, id)
        ));

      // 10. Delete WhatsApp sessions for this customer's user
      if (customer.userId) {
        await tx
          .delete(whatsappSessions)
          .where(eq(whatsappSessions.userId, customer.userId));
      }

      // 11. Delete WhatsApp messages for this customer
      await tx
        .delete(whatsappMessages)
        .where(and(
          eq(whatsappMessages.recipientType, "customer"),
          eq(whatsappMessages.recipientId, id)
        ));

      // 12. Delete email verifications for this customer's user
      if (customer.userId) {
        await tx
          .delete(emailVerifications)
          .where(eq(emailVerifications.userId, customer.userId));
      }

      // 13. Delete inventory transactions for this user
      if (customer.userId) {
        await tx
          .delete(inventoryTransactions)
          .where(eq(inventoryTransactions.userId, customer.userId));
      }

      // 14. Update alerts to remove acknowledgedBy reference (allows null)
      if (customer.userId) {
        await tx
          .update(alerts)
          .set({ acknowledgedBy: null })
          .where(eq(alerts.acknowledgedBy, customer.userId));
      }

      // 15. Update customers to remove accountManagerId reference (allows null)
      if (customer.userId) {
        await tx
          .update(customers)
          .set({ accountManagerId: null })
          .where(eq(customers.accountManagerId, customer.userId));
      }

      // 16. Delete technician record if this user is also a technician
      if (customer.userId) {
        await tx
          .delete(technicians)
          .where(eq(technicians.userId, customer.userId));
      }

      // 17. Delete the customer record
      await tx
        .delete(customers)
        .where(eq(customers.id, id));

      // 18. Finally, delete the user account
      if (customer.userId) {
        console.log(`[DELETE CUSTOMER] Deleting user account: ${customer.userId}`);
        await tx
          .delete(users)
          .where(eq(users.id, customer.userId));
        console.log(`[DELETE CUSTOMER] Successfully deleted user account: ${customer.userId}`);
      }
    });

    console.log(`[DELETE CUSTOMER] Successfully completed deletion for customer: ${id}`);
    return customer;
  }

  async getAllContainers(): Promise<any[]> {
    // Use raw SELECT * to include dynamically added columns not present in typed schema
    const result: any = await db.execute(sql`SELECT * FROM containers ORDER BY id`);
    const rows: any[] = Array.isArray(result) ? result : (result?.rows || []);
    return rows.map((row: any) => this.parseContainerData(row as any));
  }

  // Helper function to parse decimal fields and ensure currentLocation
  private parseContainerData(container: Container): Container {
    if (!container) return container;

    // Parse decimal fields from strings to numbers
    const parsedContainer: any = {
      ...container,
      locationLat: container.locationLat ? parseFloat(container.locationLat as string) : undefined,
      locationLng: container.locationLng ? parseFloat(container.locationLng as string) : undefined
    };

    // Add camelCase aliases for frontend compatibility
    parsedContainer.containerCode = parsedContainer.container_id || parsedContainer.containerCode;
    parsedContainer.currentCustomerId = parsedContainer.assigned_client_id || parsedContainer.currentCustomerId;
    parsedContainer.productType = parsedContainer.product_type || parsedContainer.productType;
    parsedContainer.sizeType = parsedContainer.size_type || parsedContainer.sizeType;
    parsedContainer.groupName = parsedContainer.group_name || parsedContainer.groupName;
    parsedContainer.gkuProductName = parsedContainer.gku_product_name || parsedContainer.gkuProductName;
    parsedContainer.availableLocation = parsedContainer.available_location || parsedContainer.availableLocation;
    parsedContainer.mfgYear = parsedContainer.mfg_year || parsedContainer.mfgYear;
    parsedContainer.inventoryStatus = parsedContainer.inventory_status || parsedContainer.inventoryStatus;
    parsedContainer.reeferUnit = parsedContainer.reefer_unit || parsedContainer.reeferUnit;
    parsedContainer.reeferModel = parsedContainer.reefer_model || parsedContainer.reeferModel;
    parsedContainer.reeferUnitModelName = parsedContainer.reefer_unit_model_name || parsedContainer.reeferUnitModelName;
    parsedContainer.reeferUnitSerialNo = parsedContainer.reefer_unit_serial_no || parsedContainer.reeferUnitSerialNo;
    parsedContainer.imageLinks = parsedContainer.images_pti_survey || parsedContainer.image_links || parsedContainer.imageLinks;
    parsedContainer.masterSheetData = parsedContainer.master_sheet_data || parsedContainer.masterSheetData;
    parsedContainer.containerNo = parsedContainer.container_no || parsedContainer.containerNo;
    parsedContainer.controllerConfigurationNumber = parsedContainer.controller_configuration_number || parsedContainer.controllerConfigurationNumber;
    parsedContainer.controllerVersion = parsedContainer.controller_version || parsedContainer.controllerVersion;
    parsedContainer.cityOfPurchase = parsedContainer.city_of_purchase || parsedContainer.cityOfPurchase;
    parsedContainer.purchaseYardDetails = parsedContainer.purchase_yard_details || parsedContainer.purchaseYardDetails;
    parsedContainer.dispatchLocation = parsedContainer.dispatch_location || parsedContainer.dispatchLocation;
    parsedContainer.dispatchDate = parsedContainer.dispatch_date || parsedContainer.dispatchDate;
    parsedContainer.croNumber = parsedContainer.cro_number || parsedContainer.croNumber;
    parsedContainer.brandNewUsed = parsedContainer.brand_new_used || parsedContainer.brandNewUsed;
    parsedContainer.inHouseRunTestReport = parsedContainer.in_house_run_test_report || parsedContainer.inHouseRunTestReport;
    parsedContainer.repairRemarks = parsedContainer.repair_remarks || parsedContainer.repairRemarks;
    parsedContainer.estimatedCostForRepair = parsedContainer.estimated_cost_for_repair || parsedContainer.estimatedCostForRepair;
    parsedContainer.logoSticker = parsedContainer.logo_sticker || parsedContainer.logoSticker;

    // Telemetry aliases
    parsedContainer.lastTelemetry = parsedContainer.last_telemetry || parsedContainer.lastTelemetry;
    parsedContainer.orbcommDeviceId = parsedContainer.orbcomm_device_id || parsedContainer.orbcommDeviceId;
    parsedContainer.lastSyncedAt = parsedContainer.last_synced_at || parsedContainer.lastSyncedAt;
    parsedContainer.lastUpdateTimestamp = parsedContainer.last_update_timestamp || parsedContainer.lastUpdateTimestamp;
    parsedContainer.powerStatus = parsedContainer.power_status || parsedContainer.powerStatus;

    // Add excelMetadata from excel_metadata if exists
    if (parsedContainer.excel_metadata && !parsedContainer.excelMetadata) {
      parsedContainer.excelMetadata = parsedContainer.excel_metadata;
    }

    // Ensure container has currentLocation data for map display
    // Priority: 1) current_location from DB, 2) locationLat/Lng from telemetry, 3) default
    if (parsedContainer.current_location && parsedContainer.current_location.lat && parsedContainer.current_location.lng) {
      // Use current_location from database (Orbcomm data)
      parsedContainer.currentLocation = {
        lat: parseFloat(parsedContainer.current_location.lat),
        lng: parseFloat(parsedContainer.current_location.lng),
        timestamp: parsedContainer.current_location.timestamp,
        source: parsedContainer.current_location.source || 'orbcomm'
      };

      // Also populate top-level fields if missing, so frontend components using them work correctly
      if (!parsedContainer.locationLat) parsedContainer.locationLat = parsedContainer.currentLocation.lat;
      if (!parsedContainer.locationLng) parsedContainer.locationLng = parsedContainer.currentLocation.lng;
    } else if (!parsedContainer.currentLocation) {
      // Use telemetry location if available
      if (parsedContainer.locationLat && parsedContainer.locationLng) {
        parsedContainer.currentLocation = {
          lat: typeof parsedContainer.locationLat === 'string' ? parseFloat(parsedContainer.locationLat) : parsedContainer.locationLat,
          lng: typeof parsedContainer.locationLng === 'string' ? parseFloat(parsedContainer.locationLng) : parsedContainer.locationLng,
          timestamp: parsedContainer.lastSyncedAt?.toISOString(),
          source: 'orbcomm'
        };
      } else {
        // No location data available
        parsedContainer.currentLocation = undefined;
      }
    }

  // Populate other telemetry fields from last_telemetry if top-level fields are missing
  if(parsedContainer.last_telemetry) {
    if (parsedContainer.temperature === undefined && parsedContainer.last_telemetry.temperature !== undefined) {
      parsedContainer.temperature = parsedContainer.last_telemetry.temperature;
    }
    if (!parsedContainer.powerStatus && parsedContainer.last_telemetry.powerStatus) {
      parsedContainer.powerStatus = parsedContainer.last_telemetry.powerStatus;
    }
  }

    return parsedContainer;
  }

  async getContainer(id: string): Promise < any | undefined > {
  const out: any = await db.execute(sql`SELECT * FROM containers WHERE id = ${id} LIMIT 1`);
  const row = Array.isArray(out) ? out[0] : out?.rows?.[0];
  return row ? this.parseContainerData(row as any) : undefined;
}

  async getContainerByContainerId(containerId: string): Promise < Container | undefined > {
  const [container] = await db.select().from(containers).where(eq(containers.containerCode, containerId));
  return container ? this.parseContainerData(container) : undefined;
}

  async getContainersByCustomer(customerId: string): Promise < Container[] > {
  const containerList = await db.select().from(containers).where(eq(containers.currentCustomerId, customerId));
  return containerList.map(container => this.parseContainerData(container));
}

  async createContainer(container: any): Promise < Container > {
  const [newContainer] = await db.insert(containers).values(container).returning();
  return newContainer;
}

  async updateContainer(id: string, container: any): Promise < any > {
  // Use Drizzle's update method which handles dynamic fields properly
  const updateData: any = {
    ...container,
    updatedAt: new Date(),
  };

  const [updated] = await db
    .update(containers)
    .set(updateData)
    .where(eq(containers.id, id))
    .returning();

  return updated ? this.parseContainerData(updated) : undefined;
}

  async getContainerByOrbcommId(orbcommDeviceId: string): Promise < Container | undefined > {
  const [container] = await db.select().from(containers).where(eq(containers.orbcommDeviceId, orbcommDeviceId));
  return container ? this.parseContainerData(container) : undefined;
}

  async getContainerByCode(containerCode: string): Promise < Container | undefined > {
  const [container] = await db.select().from(containers).where(eq(containers.containerCode, containerCode));
  return container ? this.parseContainerData(container) : undefined;
}

  async updateContainerLocation(containerId: string, locationData: { lat: number; lng: number; timestamp: string; source: string }): Promise < void> {
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
}): Promise < Container > {
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

  async getAllAlerts(): Promise < Alert[] > {
  return await db.select().from(alerts).orderBy(desc(alerts.detectedAt));
}

  async getAlert(id: string): Promise < Alert | undefined > {
  const [alert] = await db.select().from(alerts).where(eq(alerts.id, id));
  return alert;
}

  async getAlertsByContainer(containerId: string): Promise < Alert[] > {
  return await db.select().from(alerts).where(eq(alerts.containerId, containerId)).orderBy(desc(alerts.detectedAt));
}

  async getOpenAlerts(): Promise < Alert[] > {
  return await db
    .select()
    .from(alerts)
    .where(isNull(alerts.resolvedAt))
    .orderBy(desc(alerts.detectedAt));
}

  async createAlert(alert: any): Promise < Alert > {
  const [newAlert] = await db.insert(alerts).values(alert).returning();
  return newAlert;
}

  async updateAlert(id: string, alert: any): Promise < Alert > {
  const [updated] = await db.update(alerts).set(alert).where(eq(alerts.id, id)).returning();
  return updated;
}

  async getAllServiceRequests(): Promise<any[]> {
  // Select only fields that exist in the database to avoid schema mismatch errors
  return await db
    .select({
      id: serviceRequests.id,
      requestNumber: serviceRequests.requestNumber,
      jobOrder: serviceRequests.jobOrder,
      containerId: serviceRequests.containerId,
      customerId: serviceRequests.customerId,
      alertId: serviceRequests.alertId,
      assignedTechnicianId: serviceRequests.assignedTechnicianId,
      priority: serviceRequests.priority,
      status: serviceRequests.status,
      issueDescription: serviceRequests.issueDescription,
      requiredParts: serviceRequests.requiredParts,
      estimatedDuration: serviceRequests.estimatedDuration,
      requestedAt: serviceRequests.requestedAt,
      approvedAt: serviceRequests.approvedAt,
      scheduledDate: serviceRequests.scheduledDate,
      scheduledTimeWindow: serviceRequests.scheduledTimeWindow,
      actualStartTime: serviceRequests.actualStartTime,
      actualEndTime: serviceRequests.actualEndTime,
      serviceDuration: serviceRequests.serviceDuration,
      resolutionNotes: serviceRequests.resolutionNotes,
      usedParts: serviceRequests.usedParts,
      totalCost: serviceRequests.totalCost,
      invoiceId: serviceRequests.invoiceId,
      customerFeedbackId: serviceRequests.customerFeedbackId,
      beforePhotos: serviceRequests.beforePhotos,
      afterPhotos: serviceRequests.afterPhotos,
      clientUploadedPhotos: serviceRequests.clientUploadedPhotos,
      clientUploadedVideos: serviceRequests.clientUploadedVideos,
      videos: serviceRequests.videos,
      locationProofPhotos: serviceRequests.locationProofPhotos,
      clientApprovalRequired: serviceRequests.clientApprovalRequired,
      clientApprovedAt: serviceRequests.clientApprovedAt,
      createdBy: serviceRequests.createdBy,
      createdAt: serviceRequests.createdAt,
      updatedAt: serviceRequests.updatedAt,
      // Skip fields that don't exist in DB yet
      // workType, clientType, jobType, billingType, callStatus, month, year, excelData will be added later
    })
    .from(serviceRequests)
    .orderBy(desc(serviceRequests.createdAt));
}

  async getServiceRequest(id: string): Promise<any | undefined> {
  const [request] = await db
    .select({
      id: serviceRequests.id,
      requestNumber: serviceRequests.requestNumber,
      jobOrder: serviceRequests.jobOrder,
      containerId: serviceRequests.containerId,
      customerId: serviceRequests.customerId,
      alertId: serviceRequests.alertId,
      assignedTechnicianId: serviceRequests.assignedTechnicianId,
      priority: serviceRequests.priority,
      status: serviceRequests.status,
      issueDescription: serviceRequests.issueDescription,
      requiredParts: serviceRequests.requiredParts,
      estimatedDuration: serviceRequests.estimatedDuration,
      requestedAt: serviceRequests.requestedAt,
      approvedAt: serviceRequests.approvedAt,
      scheduledDate: serviceRequests.scheduledDate,
      scheduledTimeWindow: serviceRequests.scheduledTimeWindow,
      actualStartTime: serviceRequests.actualStartTime,
      actualEndTime: serviceRequests.actualEndTime,
      serviceDuration: serviceRequests.serviceDuration,
      resolutionNotes: serviceRequests.resolutionNotes,
      usedParts: serviceRequests.usedParts,
      totalCost: serviceRequests.totalCost,
      invoiceId: serviceRequests.invoiceId,
      customerFeedbackId: serviceRequests.customerFeedbackId,
      beforePhotos: serviceRequests.beforePhotos,
      afterPhotos: serviceRequests.afterPhotos,
      clientUploadedPhotos: serviceRequests.clientUploadedPhotos,
      clientUploadedVideos: serviceRequests.clientUploadedVideos,
      videos: serviceRequests.videos,
      locationProofPhotos: serviceRequests.locationProofPhotos,
      clientApprovalRequired: serviceRequests.clientApprovalRequired,
      clientApprovedAt: serviceRequests.clientApprovedAt,
      createdBy: serviceRequests.createdBy,
      createdAt: serviceRequests.createdAt,
      updatedAt: serviceRequests.updatedAt,
      excelData: serviceRequests.excelData,
    })
    .from(serviceRequests)
    .where(eq(serviceRequests.id, id));
  return request;
}

  async getServiceRequestsByCustomer(customerId: string): Promise < ServiceRequest[] > {
  return await db
    .select()
    .from(serviceRequests)
    .where(eq(serviceRequests.customerId, customerId))
    .orderBy(desc(serviceRequests.createdAt));
}

  async getServiceRequestsByTechnician(technicianId: string, activeOnly: boolean = false): Promise < any[] > {
  if(!technicianId) {
    console.warn('[Storage] getServiceRequestsByTechnician called with empty technicianId');
    return [];
  }

    try {
    // Build where conditions - use eq for direct comparison
    const conditions: any[] = [
      eq(serviceRequests.assignedTechnicianId, technicianId),
      sql`${serviceRequests.assignedTechnicianId} IS NOT NULL`
    ];

    // If activeOnly is true, filter by active statuses
    if(activeOnly) {
      const activeStatuses = ['pending', 'scheduled', 'approved', 'in_progress'] as const;
      conditions.push(inArray(serviceRequests.status, activeStatuses as any));
    }

      // Clean, simple select without nested objects to avoid orderSelectedFields issues
      const rows = await db
      .select({
        id: serviceRequests.id,
        requestNumber: serviceRequests.requestNumber,
        jobOrder: serviceRequests.jobOrder,
        status: serviceRequests.status,
        priority: serviceRequests.priority,
        issueDescription: serviceRequests.issueDescription,
        scheduledDate: serviceRequests.scheduledDate,
        scheduledTimeWindow: serviceRequests.scheduledTimeWindow,
        actualStartTime: serviceRequests.actualStartTime,
        actualEndTime: serviceRequests.actualEndTime,
        durationMinutes: serviceRequests.durationMinutes,
        resolutionNotes: serviceRequests.resolutionNotes,
        beforePhotos: serviceRequests.beforePhotos,
        afterPhotos: serviceRequests.afterPhotos,
        clientUploadedPhotos: serviceRequests.clientUploadedPhotos,
        clientUploadedVideos: serviceRequests.clientUploadedVideos,
        containerId: serviceRequests.containerId,
        customerId: serviceRequests.customerId,
        assignedTechnicianId: serviceRequests.assignedTechnicianId,
        createdAt: serviceRequests.createdAt,
        updatedAt: serviceRequests.updatedAt,
      })
      .from(serviceRequests)
      .where(and(...conditions))
      .orderBy(desc(serviceRequests.createdAt));

    // Fetch container and customer data separately to avoid join complexity
    const enrichedRows = await Promise.all(
      rows.map(async (row) => {
        let container = null;
        let customer = null;

        if (row.containerId) {
          try {
            container = await this.getContainer(row.containerId);
          } catch (err) {
            console.warn(`[Storage] Failed to fetch container ${row.containerId}:`, err);
          }
        }

        if (row.customerId) {
          try {
            customer = await this.getCustomer(row.customerId);
          } catch (err) {
            console.warn(`[Storage] Failed to fetch customer ${row.customerId}:`, err);
          }
        }

        return {
          ...row,
          container: container ? {
            id: container.id,
            containerCode: container.containerCode,
            type: container.type,
            status: container.status,
            currentLocation: container.currentLocation
          } : null,
          customer: customer ? {
            id: customer.id,
            companyName: customer.companyName,
            contactPerson: customer.contactPerson,
            phone: customer.phone,
            email: customer.email,
            address: customer.address
          } : null
        };
      })
    );

    console.log("[Storage] getServiceRequestsByTechnician", { technicianId, count: enrichedRows.length });

    return enrichedRows;
  } catch(error: any) {
    console.error('[Storage] Error in getServiceRequestsByTechnician:', error);
    console.error('[Storage] Technician ID:', technicianId);
    console.error('[Storage] Error details:', error?.message, error?.stack);
    // Return empty array instead of throwing to prevent 500 errors
    return [];
  }
}


  async getPendingServiceRequests(): Promise < ServiceRequest[] > {
  // Return all unassigned requests (not completed/cancelled)
  // This includes requests with any status as long as they don't have a technician assigned
  return await db
    .select()
    .from(serviceRequests)
    .where(and(
      isNull(serviceRequests.assignedTechnicianId),
      notInArray(serviceRequests.status, ['completed', 'cancelled']),
      isNull(serviceRequests.actualEndTime)
    ))
    .orderBy(desc(serviceRequests.createdAt));
}

  async createServiceRequest(request: any): Promise < ServiceRequest > {
  const [newRequest] = await db.insert(serviceRequests).values(request).returning();
  return newRequest;
}


  async getAllTechnicians(): Promise < Technician[] > {
  // Return technicians enriched with linked user fields for UI display
  try {
    const rows = await db
      .select({
        // Explicitly select only existing columns to avoid migration issues
        id: technicians.id,
        userId: technicians.userId,
        employeeCode: technicians.employeeCode,
        experienceLevel: technicians.experienceLevel,
        skills: technicians.skills,
        baseLocation: technicians.baseLocation,
        serviceAreas: technicians.serviceAreas,
        status: technicians.status,
        averageRating: technicians.averageRating,
        totalJobsCompleted: technicians.totalJobsCompleted,
        grade: technicians.grade,
        designation: technicians.designation,
        hotelAllowance: technicians.hotelAllowance,
        localTravelAllowance: technicians.localTravelAllowance,
        foodAllowance: technicians.foodAllowance,
        personalAllowance: technicians.personalAllowance,
        serviceRequestCost: technicians.serviceRequestCost,
        pmCost: technicians.pmCost,
        tasksPerDay: technicians.tasksPerDay,
        latitude: technicians.latitude,
        longitude: technicians.longitude,
        locationAddress: technicians.locationAddress,
        createdAt: technicians.createdAt,
        updatedAt: technicians.updatedAt,
        userName: users.name,
        userEmail: users.email,
        userPhone: users.phoneNumber,
      })
      .from(technicians)
      .leftJoin(users, eq(technicians.userId, users.id));

    return rows.map((r: any) => ({
      id: r.id,
      userId: r.userId,
      employeeCode: r.employeeCode,
      experienceLevel: r.experienceLevel,
      skills: r.skills,
      baseLocation: r.baseLocation,
      serviceAreas: r.serviceAreas,
      status: r.status,
      averageRating: r.averageRating,
      totalJobsCompleted: r.totalJobsCompleted,
      grade: r.grade,
      designation: r.designation,
      hotelAllowance: r.hotelAllowance,
      localTravelAllowance: r.localTravelAllowance,
      foodAllowance: r.foodAllowance,
      personalAllowance: r.personalAllowance,
      serviceRequestCost: r.serviceRequestCost,
      pmCost: r.pmCost,
      tasksPerDay: r.tasksPerDay,
      latitude: r.latitude,
      longitude: r.longitude,
      locationAddress: r.locationAddress,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      name: r.userName,
      email: r.userEmail,
      phone: r.userPhone,
    }));
  } catch(error) {
    console.error("Error in getAllTechnicians:", error);
    throw error;
  }
}

  async getTechnician(id: string): Promise < Technician | undefined > {
  try {
    const [row] = await db
      .select({
        // Explicitly select only existing columns to avoid migration issues
        id: technicians.id,
        userId: technicians.userId,
        employeeCode: technicians.employeeCode,
        experienceLevel: technicians.experienceLevel,
        skills: technicians.skills,
        baseLocation: technicians.baseLocation,
        serviceAreas: technicians.serviceAreas,
        status: technicians.status,
        averageRating: technicians.averageRating,
        totalJobsCompleted: technicians.totalJobsCompleted,
        grade: technicians.grade,
        designation: technicians.designation,
        hotelAllowance: technicians.hotelAllowance,
        localTravelAllowance: technicians.localTravelAllowance,
        foodAllowance: technicians.foodAllowance,
        personalAllowance: technicians.personalAllowance,
        serviceRequestCost: technicians.serviceRequestCost,
        pmCost: technicians.pmCost,
        tasksPerDay: technicians.tasksPerDay,
        latitude: technicians.latitude,
        longitude: technicians.longitude,
        locationAddress: technicians.locationAddress,
        createdAt: technicians.createdAt,
        updatedAt: technicians.updatedAt,
        userName: users.name,
        userEmail: users.email,
        userPhone: users.phoneNumber,
      })
      .from(technicians)
      .leftJoin(users, eq(technicians.userId, users.id))
      .where(eq(technicians.id, id));
    if(!row) return undefined as any;
    return {
      id: row.id,
      userId: row.userId,
      employeeCode: row.employeeCode,
      experienceLevel: row.experienceLevel,
      skills: row.skills,
      baseLocation: row.baseLocation,
      serviceAreas: row.serviceAreas,
      status: row.status,
      averageRating: row.averageRating,
      totalJobsCompleted: row.totalJobsCompleted,
      grade: row.grade,
      designation: row.designation,
      hotelAllowance: row.hotelAllowance,
      localTravelAllowance: row.localTravelAllowance,
      foodAllowance: row.foodAllowance,
      personalAllowance: row.personalAllowance,
      serviceRequestCost: row.serviceRequestCost,
      pmCost: row.pmCost,
      tasksPerDay: row.tasksPerDay,
      latitude: row.latitude,
      longitude: row.longitude,
      locationAddress: row.locationAddress,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      name: row.userName,
      email: row.userEmail,
      phone: row.userPhone,
    } as any;
  } catch(error) {
    console.error("Error in getTechnician:", error);
    throw error;
  }
}

  async getAvailableTechnicians(): Promise < Technician[] > {
  // Get technicians that are available or on_duty
  const techs = await db.select().from(technicians).where(
    sql`${technicians.status} IN ('available', 'on_duty')`
  );
  console.log('[Storage] Available technicians found:', techs.length);
  return techs;
}

  async updateTechnicianStatus(id: string, status: string): Promise < Technician > {
  const [updated] = await db
    .update(technicians)
    .set({ status: status as any })
    .where(eq(technicians.id, id))
    .returning();
  return updated;
}

  async getWhatsappSession(phoneNumber: string): Promise < WhatsappSession | undefined > {
  const [session] = await db
    .select()
    .from(whatsappSessions)
    .where(and(eq(whatsappSessions.phoneNumber, phoneNumber), eq(whatsappSessions.isActive, true)))
    .orderBy(desc(whatsappSessions.createdAt));
  return session;
}

  async createWhatsappSession(session: any): Promise < WhatsappSession > {
  const [newSession] = await db.insert(whatsappSessions).values(session).returning();
  return newSession;
}

  async updateWhatsappSession(id: string, session: any): Promise < WhatsappSession > {
  const [updated] = await db
    .update(whatsappSessions)
    .set({ ...session, updatedAt: new Date() })
    .where(eq(whatsappSessions.id, id))
    .returning();
  return updated;
}

  async createWhatsappMessage(message: any): Promise < any > {
  const [newMessage] = await db.insert(whatsappMessages).values(message).returning();
  return newMessage;
}

  async getWhatsAppMessageById(messageId: string): Promise < any | undefined > {
  const [message] = await db
    .select()
    .from(whatsappMessages)
    .where(eq(whatsappMessages.whatsappMessageId, messageId));
  return message;
}

  async getRecentWhatsAppMessages(userId: string, limit: number = 50): Promise < any[] > {
  return await db
    .select()
    .from(whatsappMessages)
    .where(eq(whatsappMessages.recipientId, userId))
    .orderBy(desc(whatsappMessages.sentAt))
    .limit(limit);
}

  async getWhatsAppMessagesByServiceRequest(serviceRequestId: string): Promise < any[] > {
  return await db
    .select()
    .from(whatsappMessages)
    .where(
      and(
        eq(whatsappMessages.relatedEntityType, 'ServiceRequest'),
        eq(whatsappMessages.relatedEntityId, serviceRequestId)
      )
    )
    .orderBy(whatsappMessages.sentAt);
}

  async createAuditLog(entry: { userId?: string; action: string; entityType: string; entityId?: string; changes?: any; source: string; ipAddress?: string; timestamp?: Date }): Promise < any > {
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

  async getAllCustomers(): Promise < Customer[] > {
  return await db.select().from(customers).orderBy(customers.companyName);
}






  async getFeedback(id: string): Promise < any | undefined > {
  const [feedbackItem] = await db.select().from(feedback).where(eq(feedback.id, id));
  return feedbackItem;
}


  async updateFeedback(id: string, feedbackData: any): Promise < any > {
  const [updated] = await db
    .update(feedback)
    .set(feedbackData)
    .where(eq(feedback.id, id))
    .returning();
  return updated;
}


  async getDashboardStats(): Promise < any > {
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
  async getContainerLocationHistory(containerId: string): Promise < any[] > {
  return await db
    .select()
    .from(containerMetrics)
    .where(eq(containerMetrics.containerId, containerId))
    .orderBy(desc(containerMetrics.timestamp))
    .limit(100);
}

  async getContainerServiceHistory(containerId: string): Promise < any[] > {
  // Get container code from containerId
  const container = await this.getContainer(containerId);
  if(!container) return [];

  const containerCode = container.containerCode;

  // Get service requests from service_requests table
  const serviceRequestsData = await db
    .select({
      id: serviceRequests.id,
      jobOrder: serviceRequests.jobOrder,
      requestNumber: serviceRequests.requestNumber,
      containerId: serviceRequests.containerId,
      customerId: serviceRequests.customerId,
      status: serviceRequests.status,
      issueDescription: serviceRequests.issueDescription,
      requestedAt: serviceRequests.requestedAt,
      createdAt: serviceRequests.createdAt,
      source: sql`'service_requests'`.as('source'),
    })
    .from(serviceRequests)
    .where(eq(serviceRequests.containerId, containerId))
    .orderBy(desc(serviceRequests.createdAt));

  // Get service history from service_history table (imported from Excel)
  const serviceHistoryData = await db.execute(sql`
      SELECT
        id,
        job_order_number as "jobOrder",
        container_number as "containerCode",
        client_name as "customerName",
        machine_status as status,
        complaint_attended_date as "requestedAt",
        work_description as "issueDescription",
        technician_name as "technicianName",
        work_type as "workType",
        'service_history' as source
      FROM service_history
      WHERE container_number = ${containerCode}
      ORDER BY complaint_attended_date DESC NULLS LAST, created_at DESC
    `);

  // Combine both sources
  const combined = [
    ...serviceRequestsData,
    ...(serviceHistoryData.rows || [])
  ];

  // Sort by date (most recent first)
  return combined.sort((a: any, b: any) => {
    const dateA = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
    const dateB = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
    return dateB - dateA;
  });
}

  async getContainerOwnershipHistory(containerId: string): Promise < any[] > {
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

  async getContainerMetrics(containerId: string): Promise < any[] > {
  return await db
    .select()
    .from(containerMetrics)
    .where(eq(containerMetrics.containerId, containerId))
    .orderBy(desc(containerMetrics.timestamp))
    .limit(50);
}

  async assignContainerToCustomer(containerId: string, customerId: string, assignmentDate: Date, expectedReturnDate: Date): Promise < Container > {
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

  async unassignContainer(containerId: string): Promise < Container > {
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

  async getIotEnabledContainers(): Promise < Container[] > {
  return await db
    .select()
    .from(containers)
    .where(eq(containers.hasIot, true))
    .orderBy(containers.id);
}

  async getContainersByStatus(status: string): Promise < Container[] > {
  return await db
    .select()
    .from(containers)
    .where(eq(containers.status, status as any))
    .orderBy(containers.id);
}

  // Enhanced Alert Management Methods according to PRD
  async getAlertsBySeverity(severity: string): Promise < Alert[] > {
  return await db
    .select()
    .from(alerts)
    .where(eq(alerts.severity, severity as any))
    .orderBy(desc(alerts.detectedAt));
}

  async getAlertsBySource(source: string): Promise < Alert[] > {
  return await db
    .select()
    .from(alerts)
    .where(eq(alerts.source, source as any))
    .orderBy(desc(alerts.detectedAt));
}

  async acknowledgeAlert(alertId: string, userId: string): Promise < Alert > {
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

  async resolveAlert(alertId: string, resolutionMethod: string): Promise < Alert > {
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
  async getServiceRequestsByStatus(status: string): Promise < ServiceRequest[] > {
  return await db
    .select()
    .from(serviceRequests)
    .where(eq(serviceRequests.status, status as any))
    .orderBy(desc(serviceRequests.createdAt));
}

  async getServiceRequestsByPriority(priority: string): Promise < ServiceRequest[] > {
  return await db
    .select()
    .from(serviceRequests)
    .where(eq(serviceRequests.priority, priority as any))
    .orderBy(desc(serviceRequests.createdAt));
}

  async assignServiceRequest(serviceRequestId: string, technicianId: string, scheduledDate ?: Date, scheduledTimeWindow ?: string): Promise < ServiceRequest > {
  const updateFields: any = {
    assignedTechnicianId: technicianId,
    status: "scheduled",
    updatedAt: new Date(),
  };
  if(scheduledDate instanceof Date && !isNaN(scheduledDate.getTime())) {
  updateFields.scheduledDate = scheduledDate;
}
if (scheduledTimeWindow) {
  updateFields.scheduledTimeWindow = scheduledTimeWindow;
}

console.log(`[Storage] assignServiceRequest: Setting assignedTechnicianId=${technicianId} for request ${serviceRequestId}`);

const [updated] = await db
  .update(serviceRequests)
  .set(updateFields)
  .where(eq(serviceRequests.id, serviceRequestId))
  .returning();

console.log(`[Storage] assignServiceRequest: Updated request ${serviceRequestId}, assignedTechnicianId=${updated?.assignedTechnicianId}, status=${updated?.status}`);

// Verify the assignment was saved
if (updated && updated.assignedTechnicianId !== technicianId) {
  console.error(`[Storage] WARNING: Assignment mismatch! Expected ${technicianId}, got ${updated.assignedTechnicianId}`);
}

return updated;
  }

  async startServiceRequest(serviceRequestId: string): Promise < ServiceRequest > {
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

  async completeServiceRequest(serviceRequestId: string, resolutionNotes: string, usedParts: string[], beforePhotos: string[], afterPhotos: string[]): Promise < ServiceRequest > {
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

  async cancelServiceRequest(serviceRequestId: string, reason: string): Promise < ServiceRequest > {
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

  async getServiceRequestTimeline(serviceRequestId: string): Promise < any[] > {
  // This would typically involve querying audit logs or a timeline table
  // For now, return basic timeline based on service request status changes
  const serviceRequest = await this.getServiceRequest(serviceRequestId);
  if(!serviceRequest) return [];

  const timeline = [];

  if(serviceRequest.requestedAt) {
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

  async getScheduledService(id: string): Promise < ScheduledService | undefined > {
  const [svc] = await db
    .select()
    .from(scheduledServices)
    .where(eq(scheduledServices.id, id))
    .limit(1);
  return svc;
}

  // ==================== Courier Shipment Methods ====================

  async getCourierShipment(id: string): Promise < CourierShipment | undefined > {
  const [shipment] = await db
    .select()
    .from(courierShipments)
    .where(eq(courierShipments.id, id))
    .limit(1);
  return shipment;
}

  async getCourierShipmentByAwb(awbNumber: string): Promise < CourierShipment | undefined > {
  const [shipment] = await db
    .select()
    .from(courierShipments)
    .where(eq(courierShipments.awbNumber, awbNumber))
    .limit(1);
  return shipment;
}

  async getCourierShipmentsByServiceRequest(serviceRequestId: string): Promise < CourierShipment[] > {
  const shipments = await db
    .select()
    .from(courierShipments)
    .where(eq(courierShipments.serviceRequestId, serviceRequestId))
    .orderBy(desc(courierShipments.createdAt));
  return shipments;
}

  async getAllCourierShipments(): Promise < CourierShipment[] > {
  const shipments = await db
    .select()
    .from(courierShipments)
    .orderBy(desc(courierShipments.createdAt));
  return shipments;
}

  async createCourierShipment(shipment: InsertCourierShipment): Promise < CourierShipment > {
  const [newShipment] = await db
    .insert(courierShipments)
    .values(shipment as any)
    .returning();
  return newShipment;
}

  async updateCourierShipment(id: string, shipment: Partial<InsertCourierShipment>): Promise < CourierShipment > {
  const [updated] = await db
    .update(courierShipments)
    .set({ ...shipment, updatedAt: new Date() })
    .where(eq(courierShipments.id, id))
    .returning();
  return updated;
}

  async deleteCourierShipment(id: string): Promise < void> {
  await db
      .delete(courierShipments)
    .where(eq(courierShipments.id, id));
}

  // ==================== End Courier Shipment Methods ====================

  // Enhanced Technician Management Methods according to PRD
  async getTechnicianPerformance(technicianId: string): Promise < any > {
  const technician = await this.getTechnician(technicianId);
  if(!technician) return null;

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

  async getTechnicianSchedule(technicianId: string, date ?: string): Promise < any[] > {
  // Build the where conditions
  const conditions = [eq(serviceRequests.assignedTechnicianId, technicianId)];

  // Add date filter if provided
  if(date) {
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    conditions.push(
      sql`${serviceRequests.scheduledDate} >= ${startOfDay}`,
      sql`${serviceRequests.scheduledDate} <= ${endOfDay}`
    );
  }

    const results = await db
    .select({
      // Service request fields
      id: serviceRequests.id,
      requestNumber: serviceRequests.requestNumber,
      jobOrder: serviceRequests.jobOrder,
      status: serviceRequests.status,
      priority: serviceRequests.priority,
      issueDescription: serviceRequests.issueDescription,
      scheduledDate: serviceRequests.scheduledDate,
      scheduledTimeWindow: serviceRequests.scheduledTimeWindow,
      actualStartTime: serviceRequests.actualStartTime,
      actualEndTime: serviceRequests.actualEndTime,
      durationMinutes: serviceRequests.durationMinutes,
      containerId: serviceRequests.containerId,
      customerId: serviceRequests.customerId,
      assignedTechnicianId: serviceRequests.assignedTechnicianId,
      excelData: serviceRequests.excelData,
      // Container fields
      container: {
        id: containers.id,
        containerCode: containers.containerCode,
        type: containers.type,
        status: containers.status,
        currentLocation: containers.currentLocation
      },
      // Customer fields
      customer: {
        id: customers.id,
        companyName: customers.companyName,
        contactPerson: customers.contactPerson,
        phone: customers.phone
      }
    })
    .from(serviceRequests)
    .leftJoin(containers, eq(serviceRequests.containerId, containers.id))
    .leftJoin(customers, eq(serviceRequests.customerId, customers.id))
    .where(and(...conditions))
    .orderBy(serviceRequests.scheduledDate);

  return results;
}

  async getTechniciansBySkill(skill: string): Promise < Technician[] > {
  return await db
    .select()
    .from(technicians)
    .where(sql`${technicians.skills} @> ${JSON.stringify([skill])}`)
    .orderBy(technicians.id);
}

  async getTechniciansByLocation(location: string): Promise < Technician[] > {
  // This would typically involve geographic proximity calculation
  // For now, return technicians whose base location contains the location string
  return await db
    .select()
    .from(technicians)
    .where(sql`${technicians.baseLocation}::text ILIKE ${`%${location}%`}`)
    .orderBy(technicians.id);
}

  async updateTechnicianLocation(technicianId: string, location: any): Promise < Technician > {
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

  async createTechnician(technicianData: any): Promise < Technician > {
  const [technician] = await db
    .insert(technicians)
    .values({
      ...technicianData,
      createdAt: new Date()
    })
    .returning();
  return technician;
}

  async updateTechnician(technicianId: string, technicianData: any): Promise < Technician > {
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

  async getTechnicianByUserId(userId: string): Promise < Technician | undefined > {
  try {
    const [row] = await db
      .select({
        // Explicitly select only existing columns to avoid migration issues
        id: technicians.id,
        userId: technicians.userId,
        employeeCode: technicians.employeeCode,
        experienceLevel: technicians.experienceLevel,
        skills: technicians.skills,
        baseLocation: technicians.baseLocation,
        serviceAreas: technicians.serviceAreas,
        status: technicians.status,
        averageRating: technicians.averageRating,
        totalJobsCompleted: technicians.totalJobsCompleted,
        grade: technicians.grade,
        designation: technicians.designation,
        hotelAllowance: technicians.hotelAllowance,
        localTravelAllowance: technicians.localTravelAllowance,
        foodAllowance: technicians.foodAllowance,
        personalAllowance: technicians.personalAllowance,
        serviceRequestCost: technicians.serviceRequestCost,
        pmCost: technicians.pmCost,
        tasksPerDay: technicians.tasksPerDay,
        latitude: technicians.latitude,
        longitude: technicians.longitude,
        locationAddress: technicians.locationAddress,
        createdAt: technicians.createdAt,
        updatedAt: technicians.updatedAt,
        userName: users.name,
        userEmail: users.email,
        userPhone: users.phoneNumber,
      })
      .from(technicians)
      .leftJoin(users, eq(technicians.userId, users.id))
      .where(eq(technicians.userId, userId));
    if(!row) return undefined as any;
    return {
      id: row.id,
      userId: row.userId,
      employeeCode: row.employeeCode,
      experienceLevel: row.experienceLevel,
      skills: row.skills,
      baseLocation: row.baseLocation,
      serviceAreas: row.serviceAreas,
      status: row.status,
      averageRating: row.averageRating,
      totalJobsCompleted: row.totalJobsCompleted,
      grade: row.grade,
      designation: row.designation,
      hotelAllowance: row.hotelAllowance,
      localTravelAllowance: row.localTravelAllowance,
      foodAllowance: row.foodAllowance,
      personalAllowance: row.personalAllowance,
      serviceRequestCost: row.serviceRequestCost,
      pmCost: row.pmCost,
      tasksPerDay: row.tasksPerDay,
      latitude: row.latitude,
      longitude: row.longitude,
      locationAddress: row.locationAddress,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      name: row.userName,
      email: row.userEmail,
      phone: row.userPhone,
    } as any;
  } catch(error) {
    console.error("Error in getTechnicianByUserId:", error);
    throw error;
  }
}

  // Technician document management methods
  async getTechnicianDocuments(technicianId: string): Promise<any[]> {
    return await db
      .select({
        id: technicianDocuments.id,
        technicianId: technicianDocuments.technicianId,
        documentType: technicianDocuments.documentType,
        filename: technicianDocuments.filename,
        fileUrl: technicianDocuments.fileUrl,
        fileSize: technicianDocuments.fileSize,
        uploadedAt: technicianDocuments.uploadedAt,
        updatedAt: technicianDocuments.updatedAt,
        contentType: technicianDocuments.contentType,
      })
      .from(technicianDocuments)
      .where(eq(technicianDocuments.technicianId, technicianId))
      .orderBy(desc(technicianDocuments.uploadedAt));
  }

  async getTechnicianDocument(documentId: string): Promise<any | undefined> {
    const [document] = await db
      .select()
      .from(technicianDocuments)
      .where(eq(technicianDocuments.id, documentId))
      .limit(1);
    return document;
  }

  async createTechnicianDocument(documentData: any): Promise<any> {
    const [document] = await db
      .insert(technicianDocuments)
      .values(documentData)
      .returning();
    return document;
  }

  async updateTechnicianDocument(documentId: string, documentData: any): Promise<any> {
    const [updated] = await db
      .update(technicianDocuments)
      .set({
        ...documentData,
        updatedAt: new Date()
      })
      .where(eq(technicianDocuments.id, documentId))
      .returning();
    return updated;
  }

  async deleteTechnicianDocument(documentId: string): Promise<void> {
    await db
      .delete(technicianDocuments)
      .where(eq(technicianDocuments.id, documentId));
  }

  // Invoice management methods
  async getAllInvoices(): Promise < any[] > {
  return await db
    .select()
    .from(invoices)
    .orderBy(desc(invoices.issueDate));
}

  async getInvoice(invoiceId: string): Promise < any > {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  return invoice;
}

  async createInvoice(invoiceData: any): Promise < any > {
  const [invoice] = await db
    .insert(invoices)
    .values({
      ...invoiceData,
      createdAt: new Date()
    })
    .returning();
  return invoice;
}

  async updateInvoice(invoiceId: string, invoiceData: any): Promise < any > {
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

  async getInvoicesByCustomer(customerId: string): Promise < Invoice[] > {
  return await db
    .select()
    .from(invoices)
    .where(eq(invoices.customerId, customerId))
    .orderBy(desc(invoices.createdAt));
}

  // Feedback management methods
  async getAllFeedback(): Promise < any[] > {
  return await db
    .select()
    .from(feedback)
    .orderBy(desc(feedback.submittedAt));
}

  async getFeedbackByServiceRequest(serviceRequestId: string): Promise < any > {
  const [fb] = await db
    .select()
    .from(feedback)
    .where(eq(feedback.serviceRequestId, serviceRequestId))
    .limit(1);
  return fb;
}

  async getFeedbackByTechnician(technicianId: string): Promise < any[] > {
  return await db
    .select()
    .from(feedback)
    .where(eq(feedback.technicianId, technicianId))
    .orderBy(desc(feedback.submittedAt));
}

  async createFeedback(feedbackData: any): Promise < any > {
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
  async updateServiceRequest(serviceRequestId: string, serviceRequestData: any): Promise < any > {
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
  async getAllInventoryItems(): Promise < any[] > {
  // If an external source table is configured, read live from it
  const srcTable = process.env.INVENTORY_SOURCE_TABLE;
  if(srcTable) {
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
      const externalPool = await createExternalPool(externalUrl);
      try {
        const res = await externalPool.query(queryText);
        rows = res.rows as any[];
      } finally {
        await externalPool.end();
      }
    } else {
      const q = sql.raw(queryText);
      rows = (await db.execute(q) as unknown) as any[];
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

  async getInventoryItem(itemId: string): Promise < any > {
  const [item] = await db
    .select()
    .from(inventory)
    .where(eq(inventory.id, itemId))
    .limit(1);
  return item;
}

  async createInventoryItem(itemData: any): Promise < any > {
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

  async updateInventoryItem(itemId: string, itemData: any): Promise < any > {
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

  async deleteInventoryItem(itemId: string): Promise < void> {
  await db
      .delete(inventory)
    .where(eq(inventory.id, itemId));
}

  async searchInventoryByName(partName: string): Promise < any[] > {
  return await db
    .select()
    .from(inventory)
    .where(ilike(inventory.partName, `%${partName}%`))
    .limit(10);
}

  async getInventoryTransactions(itemId ?: string, limit: number = 100): Promise < any[] > {
  if(itemId) {
    return await db
      .select()
      .from(inventoryTransactions)
      .where(eq(inventoryTransactions.itemId, itemId))
      .orderBy(desc(inventoryTransactions.timestamp))
      .limit(limit);
  }
  
  return await db
    .select()
    .from(inventoryTransactions)
    .orderBy(desc(inventoryTransactions.timestamp))
    .limit(limit);
}

  async createInventoryTransaction(transactionData: any): Promise < any > {
  const [transaction] = await db
    .insert(inventoryTransactions)
    .values({
      ...transactionData,
      createdAt: new Date()
    })
    .returning();
  return transaction;
}

  // Inventory Indents operations
  async createInventoryIndent(data: { serviceRequestId: string; requestedBy: string; parts: any[] }): Promise < any > {
  const { serviceRequestId, requestedBy, parts } = data;

  // Generate indent number
  const indentNumber = `IND-${Date.now()}${Math.floor(Math.random() * 1000)}`;

  // Calculate total amount
  let totalAmount = 0;
  const enrichedParts = [];

  for(const part of parts) {
    const item = await db.select().from(inventory).where(eq(inventory.id, part.itemId)).limit(1);
    if (item && item[0]) {
      const unitPrice = parseFloat(item[0].unitPrice || '0');
      const totalPrice = unitPrice * part.quantity;
      totalAmount += totalPrice;

      enrichedParts.push({
        itemId: part.itemId,
        partName: item[0].partName,
        partNumber: item[0].partNumber,
        quantity: part.quantity,
        unitPrice: unitPrice.toString(),
        totalPrice: totalPrice.toString()
      });
    }
  }

    // Create indent
    const [indent] = await db
    .insert(inventoryIndents)
    .values({
      indentNumber,
      serviceRequestId,
      status: 'pending',
      priority: 'normal',
      totalAmount: totalAmount.toString(),
      requestedBy,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .returning();

  // Create indent items
  for(const part of enrichedParts) {
    await db.insert(inventoryIndentItems).values({
      indentId: indent.id,
      ...part,
      createdAt: new Date()
    });
  }

    return {
    ...indent,
    items: enrichedParts
  };
}

  // Scheduled Services operations
  async getScheduledServicesByDate(date: string): Promise < ScheduledService[] > {
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

  async getScheduledServicesByTechnician(technicianId: string, date ?: string): Promise < ScheduledService[] > {
  if(date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await db
      .select()
      .from(scheduledServices)
      .where(and(
        eq(scheduledServices.technicianId, technicianId),
        sql`${scheduledServices.scheduledDate} >= ${startOfDay}`,
        sql`${scheduledServices.scheduledDate} <= ${endOfDay}`
      ))
      .orderBy(scheduledServices.sequenceNumber);
  }

  return await db
    .select()
    .from(scheduledServices)
    .where(eq(scheduledServices.technicianId, technicianId))
    .orderBy(scheduledServices.sequenceNumber);
}

  async createScheduledService(service: any): Promise < ScheduledService > {
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

  async updateScheduledService(id: string, service: any): Promise < ScheduledService > {
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

  async getNextScheduledService(technicianId: string): Promise < ScheduledService | undefined > {
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

  // Technician Travel Planning operations
  async createTechnicianTrip(trip: any): Promise < TechnicianTrip > {
  const [newTrip] = await db.insert(technicianTrips).values({
    ...trip,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();
  return newTrip;
}

  async getTechnicianTrip(id: string): Promise < TechnicianTrip | undefined > {
  const [trip] = await db
    .select()
    .from(technicianTrips)
    .where(eq(technicianTrips.id, id))
    .limit(1);
  return trip;
}

  async getTechnicianTrips(filters ?: { technicianId?: string; startDate?: Date; endDate?: Date; destinationCity?: string; tripStatus?: string | string[] }): Promise < TechnicianTrip[] > {
  let query = db.select().from(technicianTrips);
  const conditions = [];

  if(filters?.technicianId) {
    conditions.push(eq(technicianTrips.technicianId, filters.technicianId));
  }
    if(filters?.startDate) {
    conditions.push(gte(technicianTrips.startDate, filters.startDate));
  }
    if(filters?.endDate) {
    conditions.push(sql`${technicianTrips.endDate} <= ${filters.endDate}`);
  }
    if(filters?.destinationCity) {
    conditions.push(ilike(technicianTrips.destinationCity, `%${filters.destinationCity}%`));
  }
    if(filters?.tripStatus) {
    if (Array.isArray(filters.tripStatus)) {
      conditions.push(inArray(technicianTrips.tripStatus, filters.tripStatus));
    } else {
      conditions.push(eq(technicianTrips.tripStatus, filters.tripStatus));
    }
  }

    if(conditions.length > 0) {
  query = query.where(and(...conditions)) as any;
}

const trips = await query.orderBy(desc(technicianTrips.createdAt));
return trips;
  }

  async updateTechnicianTrip(id: string, trip: any): Promise < TechnicianTrip > {
  const [updated] = await db
    .update(technicianTrips)
    .set({
      ...trip,
      updatedAt: new Date(),
    })
    .where(eq(technicianTrips.id, id))
    .returning();
  return updated;
}

  async deleteTechnicianTrip(id: string): Promise < void> {
  // Soft delete: set status to cancelled instead of hard delete
  await db
      .update(technicianTrips)
    .set({
      tripStatus: 'cancelled' as any,
      updatedAt: new Date(),
    })
    .where(eq(technicianTrips.id, id));
}

  async getTechnicianTripCosts(tripId: string): Promise < TechnicianTripCost | undefined > {
  const [costs] = await db
    .select()
    .from(technicianTripCosts)
    .where(eq(technicianTripCosts.tripId, tripId))
    .limit(1);
  return costs;
}

  async updateTechnicianTripCosts(tripId: string, costs: any): Promise < TechnicianTripCost > {
  const existing = await this.getTechnicianTripCosts(tripId);

  const numberOr = (value: any, fallback: number) => {
    if (value === undefined || value === null || value === "") return fallback;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? fallback : parsed;
  };

  const boolOr = (value: any, fallback: boolean) => {
    if (value === undefined || value === null) return fallback;
    return Boolean(value);
  };

  // Calculate numeric values first
  const travelFareNum = numberOr(costs.travelFare, Number(existing?.travelFare ?? 0));
  const stayCostNum = numberOr(costs.stayCost, Number(existing?.stayCost ?? 0));
  const dailyAllowanceNum = numberOr(costs.dailyAllowance, Number(existing?.dailyAllowance ?? 0));
  const localTravelCostNum = numberOr(costs.localTravelCost, Number(existing?.localTravelCost ?? 0));
  const miscCostNum = numberOr(costs.miscCost, Number(existing?.miscCost ?? 0));

  const totalEstimatedCost = (
    travelFareNum + stayCostNum + dailyAllowanceNum + localTravelCostNum + miscCostNum
  ).toFixed(2);

  // Convert to strings for decimal columns
  const normalized = {
    currency: costs.currency ?? existing?.currency ?? "INR",
    travelFare: travelFareNum.toFixed(2),
    travelFareIsManual: boolOr(costs.travelFareIsManual, Boolean(existing?.travelFareIsManual)),
    stayCost: stayCostNum.toFixed(2),
    stayCostIsManual: boolOr(costs.stayCostIsManual, Boolean(existing?.stayCostIsManual)),
    dailyAllowance: dailyAllowanceNum.toFixed(2),
    dailyAllowanceIsManual: boolOr(costs.dailyAllowanceIsManual, Boolean(existing?.dailyAllowanceIsManual)),
    localTravelCost: localTravelCostNum.toFixed(2),
    localTravelCostIsManual: boolOr(costs.localTravelCostIsManual, Boolean(existing?.localTravelCostIsManual)),
    miscCost: miscCostNum.toFixed(2),
    miscCostIsManual: boolOr(costs.miscCostIsManual, Boolean(existing?.miscCostIsManual)),
    totalEstimatedCost,
  };

  if(existing) {
    const [updated] = await db
      .update(technicianTripCosts)
      .set({
        ...normalized,
        updatedAt: new Date(),
      } as any)
      .where(eq(technicianTripCosts.tripId, tripId))
      .returning();
    return updated;
  }

    const [created] = await db
    .insert(technicianTripCosts)
    .values({
      tripId,
      ...normalized,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)
    .returning();
  return created;
}

  async getTechnicianTripTasks(tripId: string): Promise < TechnicianTripTask[] > {
  const tasks = await db
    .select()
    .from(technicianTripTasks)
    .where(eq(technicianTripTasks.tripId, tripId))
    .orderBy(asc(technicianTripTasks.scheduledDate));
  return tasks;
}

  async createTechnicianTripTask(task: any): Promise < TechnicianTripTask > {
  const [newTask] = await db.insert(technicianTripTasks).values({
    ...task,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();
  return newTask;
}

  async updateTechnicianTripTask(id: string, task: any): Promise < TechnicianTripTask > {
  const [updated] = await db
    .update(technicianTripTasks)
    .set({
      ...task,
      updatedAt: new Date(),
    })
    .where(eq(technicianTripTasks.id, id))
    .returning();
  return updated;
}

  async getUsersByRole(role: string): Promise < User[] > {
  return await db
    .select()
    .from(users)
    .where(and(
      eq(users.role, role as any),
      eq(users.isActive, true)
    ))
    .orderBy(users.name);
}

  async getAllUsers(): Promise < User[] > {
  return await db.select().from(users);
}

  async getLocationMultiplier(city: string): Promise < number > {
  if(!city) {
    return 1;
  }
    const normalized = city.trim().toLowerCase();
  const [record] = await db
    .select({ multiplier: locationMultipliers.multiplier })
    .from(locationMultipliers)
    .where(ilike(locationMultipliers.city, normalized))
    .limit(1);
  if(record?.multiplier != null) {
  const value = Number(record.multiplier);
  return Number.isNaN(value) ? 1 : value;
}
return 1;
  }

  async getClientAnalytics(range: number): Promise<any[]> {
    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - range);

    // Fetch all customers
    const allCustomers = await this.getAllCustomers();

    // For each customer, gather stats
    const results = await Promise.all(allCustomers.map(async (customer) => {
      // Get containers
      const customerContainers = await this.getContainersByCustomer(customer.id);

      // Get service requests
      const customerSRs = await this.getServiceRequestsByCustomer(customer.id);

      const completedSRs = customerSRs.filter(sr =>
        sr.status === 'completed' &&
        sr.actualEndTime && new Date(sr.actualEndTime) >= startDate
      );

      const pendingSRs = customerSRs.filter(sr =>
        ['pending', 'approved', 'scheduled', 'in_progress'].includes(sr.status)
      );

      const overdueSRs = customerSRs.filter(sr =>
        sr.status !== 'completed' &&
        sr.status !== 'cancelled' &&
        sr.scheduledDate && new Date(sr.scheduledDate) < new Date()
      );

      const totalPMs = customerSRs.length;

      // Compliance: (Completed / (Completed + Overdue)) * 100
      // If no completed or overdue, 100% compliance? Or 0?
      // Let's use a simple metric: Completed / (Completed + Overdue + Pending)
      const totalActive = completedSRs.length + overdueSRs.length + pendingSRs.length;
      const compliance = totalActive > 0 ? (completedSRs.length / totalActive) * 100 : 100;

      // Last activity
      const lastActivity = customerSRs.length > 0 ? customerSRs[0].updatedAt : null;

      return {
        client_id: customer.id,
        client_name: customer.companyName,
        container_count: customerContainers.length,
        total_pms: totalPMs,
        completed: completedSRs.length,
        pending: pendingSRs.length,
        overdue: overdueSRs.length,
        never: 0, // Placeholder
        compliance_percentage: Math.round(compliance * 10) / 10,
        last_activity: lastActivity ? new Date(lastActivity).toISOString().split('T')[0] : null
      };
    }));

    return results;
  }

  async getTechnicianAnalytics(range: number): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - range);

    const allTechnicians = await this.getAllTechnicians();

    const results = await Promise.all(allTechnicians.map(async (tech) => {
      // Get user details for name
      const user = await this.getUser(tech.userId);

      // Get assigned service requests
      const techSRs = await db
        .select()
        .from(serviceRequests)
        .where(eq(serviceRequests.assignedTechnicianId, tech.id));

      const completedSRs = techSRs.filter(sr =>
        sr.status === 'completed' &&
        sr.actualEndTime && new Date(sr.actualEndTime) >= startDate
      );

      const pendingSRs = techSRs.filter(sr =>
        ['pending', 'approved', 'scheduled', 'in_progress'].includes(sr.status)
      );

      const overdueSRs = techSRs.filter(sr =>
        sr.status !== 'completed' &&
        sr.status !== 'cancelled' &&
        sr.scheduledDate && new Date(sr.scheduledDate) < new Date()
      );

      // Travel Cost from trips
      const trips = await this.getTechnicianTrips({ technicianId: tech.id, startDate });
      let totalTravelCost = 0;

      for (const trip of trips) {
        const costs = await this.getTechnicianTripCosts(trip.id);
        if (costs && costs.totalEstimatedCost) {
          totalTravelCost += Number(costs.totalEstimatedCost);
        }
      }

      const totalAssigned = techSRs.length;
      const completionRate = totalAssigned > 0 ? (completedSRs.length / totalAssigned) * 100 : 0;

      // Last completed date
      const lastCompleted = completedSRs.length > 0
        ? completedSRs.sort((a, b) => new Date(b.actualEndTime!).getTime() - new Date(a.actualEndTime!).getTime())[0].actualEndTime
        : null;

      return {
        technician_id: tech.id,
        technician_name: user?.name || 'Unknown',
        total_assigned: totalAssigned,
        completed: completedSRs.length,
        pending: pendingSRs.length,
        overdue: overdueSRs.length,
        travel_cost: totalTravelCost,
        pm_completion_rate: Math.round(completionRate * 10) / 10,
        last_completed_date: lastCompleted ? new Date(lastCompleted).toISOString().split('T')[0] : null
      };
    }));

    return results;
  }
}

export const storage = new DatabaseStorage();
