import {
  users,
  clients,
  technicians,
  containers,
  containerMetrics,
  alerts,
  serviceRequests,
  invoices,
  whatsappSessions,
  whatsappMessages,
  inventory,
  auditLogs,
  type User,
  type InsertUser,
  type Client,
  type InsertClient,
  type Technician,
  type Container,
  type Alert,
  type ServiceRequest,
  type Invoice,
  type WhatsappSession,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User>;

  // Client operations
  getClient(id: string): Promise<Client | undefined>;
  getClientByUserId(userId: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;

  // Container operations
  getAllContainers(): Promise<Container[]>;
  getContainer(id: string): Promise<Container | undefined>;
  getContainerByContainerId(containerId: string): Promise<Container | undefined>;
  getContainersByClient(clientId: string): Promise<Container[]>;
  createContainer(container: any): Promise<Container>;
  updateContainer(id: string, container: any): Promise<Container>;

  // Alert operations
  getAllAlerts(): Promise<Alert[]>;
  getAlert(id: string): Promise<Alert | undefined>;
  getAlertsByContainer(containerId: string): Promise<Alert[]>;
  getOpenAlerts(): Promise<Alert[]>;
  createAlert(alert: any): Promise<Alert>;
  updateAlert(id: string, alert: any): Promise<Alert>;

  // Service Request operations
  getAllServiceRequests(): Promise<ServiceRequest[]>;
  getServiceRequest(id: string): Promise<ServiceRequest | undefined>;
  getServiceRequestsByClient(clientId: string): Promise<ServiceRequest[]>;
  getServiceRequestsByTechnician(technicianId: string): Promise<ServiceRequest[]>;
  getPendingServiceRequests(): Promise<ServiceRequest[]>;
  createServiceRequest(request: any): Promise<ServiceRequest>;
  updateServiceRequest(id: string, request: any): Promise<ServiceRequest>;

  // Technician operations
  getAllTechnicians(): Promise<Technician[]>;
  getTechnician(id: string): Promise<Technician | undefined>;
  getAvailableTechnicians(): Promise<Technician[]>;
  updateTechnicianStatus(id: string, status: string): Promise<Technician>;

  // WhatsApp operations
  getWhatsappSession(phoneNumber: string): Promise<WhatsappSession | undefined>;
  createWhatsappSession(session: any): Promise<WhatsappSession>;
  updateWhatsappSession(id: string, session: any): Promise<WhatsappSession>;
  createWhatsappMessage(message: any): Promise<any>;

  // Dashboard stats
  getDashboardStats(): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phoneNumber, phoneNumber));
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

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async getClientByUserId(userId: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.userId, userId));
    return client;
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const [client] = await db.insert(clients).values(insertClient).returning();
    return client;
  }

  async getAllContainers(): Promise<Container[]> {
    return await db.select().from(containers).orderBy(containers.containerId);
  }

  async getContainer(id: string): Promise<Container | undefined> {
    const [container] = await db.select().from(containers).where(eq(containers.id, id));
    return container;
  }

  async getContainerByContainerId(containerId: string): Promise<Container | undefined> {
    const [container] = await db.select().from(containers).where(eq(containers.containerId, containerId));
    return container;
  }

  async getContainersByClient(clientId: string): Promise<Container[]> {
    return await db.select().from(containers).where(eq(containers.assignedClientId, clientId));
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
      .where(eq(alerts.status, "open"))
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

  async getServiceRequestsByClient(clientId: string): Promise<ServiceRequest[]> {
    return await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.clientId, clientId))
      .orderBy(desc(serviceRequests.createdAt));
  }

  async getServiceRequestsByTechnician(technicianId: string): Promise<ServiceRequest[]> {
    return await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.assignedTechnicianId, technicianId))
      .orderBy(desc(serviceRequests.createdAt));
  }

  async getPendingServiceRequests(): Promise<ServiceRequest[]> {
    return await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.status, "pending"))
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
    return await db.select().from(technicians);
  }

  async getTechnician(id: string): Promise<Technician | undefined> {
    const [technician] = await db.select().from(technicians).where(eq(technicians.id, id));
    return technician;
  }

  async getAvailableTechnicians(): Promise<Technician[]> {
    return await db.select().from(technicians).where(eq(technicians.status, "available"));
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

  async getDashboardStats(): Promise<any> {
    const totalContainers = await db
      .select({ count: sql<number>`count(*)` })
      .from(containers);

    const activeAlerts = await db
      .select({ count: sql<number>`count(*)` })
      .from(alerts)
      .where(eq(alerts.status, "open"));

    const pendingServices = await db
      .select({ count: sql<number>`count(*)` })
      .from(serviceRequests)
      .where(eq(serviceRequests.status, "pending"));

    const activeContainersCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(containers)
      .where(eq(containers.status, "active"));

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
}

export const storage = new DatabaseStorage();
