import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { authenticateUser, requireRole, authorizeWhatsAppMessage, AuthRequest } from "./middleware/auth";
import { classifyAlert } from "./services/gemini";
import { fetchOrbcommDeviceData, detectAnomalies } from "./services/orbcomm";
import {
  sendTextMessage,
  sendInteractiveButtons,
  formatAlertMessage,
  formatServiceScheduleMessage,
  sendListMessage,
  sendMediaMessage,
  sendTemplateMessage,
  sendFlowMessage,
  formatCriticalAlertMessage,
  formatInvoiceMessage,
  formatFeedbackRequestMessage,
  sendTechnicianSchedule,
  sendServiceStartPrompt,
  sendServiceCompletePrompt,
  sendCustomerFeedbackRequest
} from "./services/whatsapp";
import { runDailyScheduler, startScheduler } from "./services/scheduling";
import { simpleSeed } from "./simple-seed";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  const clients = new Set<WebSocket>();

  wss.on("connection", (ws) => {
    clients.add(ws);
    console.log("WebSocket client connected");

    ws.on("close", () => {
      clients.delete(ws);
      console.log("WebSocket client disconnected");
    });
  });

  // Broadcast function for real-time updates
  function broadcast(data: any) {
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { phoneNumber, verificationCode } = req.body;

      if (!phoneNumber || !verificationCode) {
        return res.status(400).json({ error: "Phone number and verification code required" });
      }

      const user = await storage.getUserByPhoneNumber(phoneNumber);

      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // For demo, accept any 6-digit code
      if (!/^\d{6}$/.test(verificationCode)) {
        return res.status(401).json({ error: "Invalid verification code" });
      }

      res.json({ user, token: user.id });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { phoneNumber, name, email, role } = req.body;

      const existingUser = await storage.getUserByPhoneNumber(phoneNumber);
      if (existingUser) {
        return res.status(400).json({ error: "Phone number already registered" });
      }

      const user = await storage.createUser({
        phoneNumber,
        name,
        email,
        role: role || "client",
        isActive: true,
        whatsappVerified: false,
      });

      res.json({ user, token: user.id });
    } catch (error) {
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", authenticateUser, async (req: any, res) => {
    try {
      const role = (req.user?.role || '').toLowerCase();
      // For clients, scope stats to their containers only
      if (role === 'client') {
        const customer = await storage.getCustomerByUserId(req.user.id);
        if (!customer) return res.json({ totalContainers: 0, activeContainers: 0, activeAlerts: 0, pendingServices: 0, fleetUtilization: 0 });

        const containers = await storage.getContainersByCustomer(customer.id);
        const containerIds = new Set(containers.map((c) => c.id));

        const allAlerts = await storage.getAllAlerts();
        const activeAlerts = allAlerts.filter((a) => !a.resolvedAt && containerIds.has(a.containerId)).length;

        const clientSRs = await storage.getServiceRequestsByCustomer(customer.id);
        const pendingServices = clientSRs.filter((sr) => !sr.actualStartTime && !sr.actualEndTime).length;

        const activeContainers = containers.filter((c) => !!c.currentCustomerId).length;
        const totalContainers = containers.length;
        const fleetUtilization = totalContainers ? Math.round((activeContainers / totalContainers) * 100) : 0;

        return res.json({ totalContainers, activeContainers, activeAlerts, pendingServices, fleetUtilization });
      }

      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Container routes
  app.get("/api/containers", authenticateUser, async (req: any, res) => {
    try {
      const role = (req.user?.role || '').toLowerCase();
      const isPrivileged = ["admin", "coordinator", "super_admin"].includes(role);
      if (!isPrivileged) {
        const customer = await storage.getCustomerByUserId(req.user.id);
        if (!customer) return res.json([]);
        const own = await storage.getContainersByCustomer(customer.id);
        return res.json(own);
      }
      const containers = await storage.getAllContainers();
      res.json(containers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch containers" });
    }
  });

  app.get("/api/containers/:id", authenticateUser, async (req, res) => {
    try {
      const container = await storage.getContainer(req.params.id);
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }
      // Enforce client scoping: clients can only access their own containers
      const role = ((req as any).user?.role || '').toLowerCase();
      if (role === 'client') {
        const customer = await storage.getCustomerByUserId((req as any).user.id);
        if (!customer || container.currentCustomerId !== customer.id) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }
      res.json(container);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch container" });
    }
  });

  app.post("/api/containers", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const container = await storage.createContainer(req.body);
      broadcast({ type: "container_created", data: container });
      res.json(container);
    } catch (error) {
      res.status(500).json({ error: "Failed to create container" });
    }
  });

  app.put("/api/containers/:id", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const container = await storage.updateContainer(req.params.id, req.body);
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }
      broadcast({ type: "container_updated", data: container });
      res.json(container);
    } catch (error) {
      res.status(500).json({ error: "Failed to update container" });
    }
  });

  // Enhanced Container Management according to PRD
  app.get("/api/containers/:id/location-history", authenticateUser, async (req, res) => {
    try {
      const history = await storage.getContainerLocationHistory(req.params.id);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch location history" });
    }
  });

  app.get("/api/containers/:id/service-history", authenticateUser, async (req, res) => {
    try {
      const history = await storage.getContainerServiceHistory(req.params.id);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch service history" });
    }
  });

  app.get("/api/containers/:id/metrics", authenticateUser, async (req, res) => {
    try {
      const metrics = await storage.getContainerMetrics(req.params.id);
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch container metrics" });
    }
  });

  app.post("/api/containers/:id/assign", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const { customerId, assignmentDate, expectedReturnDate } = req.body;
      const container = await storage.assignContainerToCustomer(
        req.params.id, 
        customerId, 
        assignmentDate, 
        expectedReturnDate
      );
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }
      broadcast({ type: "container_assigned", data: container });
      res.json(container);
    } catch (error) {
      res.status(500).json({ error: "Failed to assign container" });
    }
  });

  app.post("/api/containers/:id/unassign", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const container = await storage.unassignContainer(req.params.id);
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }
      broadcast({ type: "container_unassigned", data: container });
      res.json(container);
    } catch (error) {
      res.status(500).json({ error: "Failed to unassign container" });
    }
  });

  app.get("/api/containers/iot/enabled", authenticateUser, async (req, res) => {
    try {
      const containers = await storage.getIotEnabledContainers();
      res.json(containers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch IoT containers" });
    }
  });

  app.get("/api/containers/status/:status", authenticateUser, async (req: any, res) => {
    try {
      const role = (req.user?.role || '').toLowerCase();
      const isPrivileged = ["admin", "coordinator", "super_admin"].includes(role);
      if (!isPrivileged) {
        const customer = await storage.getCustomerByUserId(req.user.id);
        if (!customer) return res.json([]);
        const all = await storage.getContainersByStatus(req.params.status);
        return res.json(all.filter((c) => c.currentCustomerId === customer.id));
      }
      const all = await storage.getContainersByStatus(req.params.status);
      res.json(all);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch containers by status" });
    }
  });

  // Alert routes
  app.get("/api/alerts", authenticateUser, async (req: any, res) => {
    try {
      const role = (req.user?.role || '').toLowerCase();
      if (role === 'client') {
        const customer = await storage.getCustomerByUserId(req.user.id);
        if (!customer) return res.json([]);
        const containers = await storage.getContainersByCustomer(customer.id);
        const containerIds = new Set(containers.map((c) => c.id));
        const alerts = await storage.getAllAlerts();
        return res.json(alerts.filter((a) => containerIds.has(a.containerId)));
      }
      const alerts = await storage.getAllAlerts();
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  app.get("/api/alerts/open", authenticateUser, async (req: any, res) => {
    try {
      const role = (req.user?.role || '').toLowerCase();
      const open = await storage.getOpenAlerts();
      if (role === 'client') {
        const customer = await storage.getCustomerByUserId(req.user.id);
        if (!customer) return res.json([]);
        const containers = await storage.getContainersByCustomer(customer.id);
        const containerIds = new Set(containers.map((c) => c.id));
        return res.json(open.filter((a) => containerIds.has(a.containerId)));
      }
      res.json(open);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch open alerts" });
    }
  });

  app.post("/api/alerts", authenticateUser, async (req, res) => {
    try {
      const { containerId, errorCode, description } = req.body;

      const container = await storage.getContainer(containerId);
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }

      // Classify with Gemini AI
      const classification = await classifyAlert(errorCode, description, container);

      const alert = await storage.createAlert({
        alertCode: `ALT-${Date.now()}`,
        containerId,
        severity: classification.severity,
        status: "open",
        title: `${classification.category.replace(/_/g, " ").toUpperCase()}`,
        description,
        aiClassification: classification,
        errorCode,
        detectedAt: new Date(),
        resolutionSteps: classification.resolutionSteps,
        requiredParts: classification.requiredParts,
        estimatedServiceTime: classification.estimatedServiceTime,
      });

      // Send WhatsApp notification if critical/high
      if (["critical", "high"].includes(classification.severity) && container.currentCustomerId) {
        const customer = await storage.getCustomer(container.currentCustomerId);
        if (customer) {
          const customerUser = await storage.getUser(customer.userId);
          if (customerUser) {
            const message = formatAlertMessage(alert, container);
            await sendInteractiveButtons(customerUser.phoneNumber, message, [
              { id: "approve_service", title: "Approve Service" },
              { id: "schedule_later", title: "Schedule Later" },
              { id: "more_info", title: "More Info" },
            ]);
          }
        }
      }

      broadcast({ type: "alert_created", data: alert });
      res.json(alert);
    } catch (error) {
      console.error("Alert creation error:", error);
      res.status(500).json({ error: "Failed to create alert" });
    }
  });

  // Enhanced Alert Management according to PRD
  app.get("/api/alerts/severity/:severity", authenticateUser, async (req, res) => {
    try {
      const alerts = await storage.getAlertsBySeverity(req.params.severity);
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch alerts by severity" });
    }
  });

  app.get("/api/alerts/source/:source", authenticateUser, async (req, res) => {
    try {
      const alerts = await storage.getAlertsBySource(req.params.source);
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch alerts by source" });
    }
  });

  app.put("/api/alerts/:id/acknowledge", authenticateUser, async (req, res) => {
    try {
      const alert = await storage.acknowledgeAlert(req.params.id, req.user!.id);
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      broadcast({ type: "alert_acknowledged", data: alert });
      res.json(alert);
    } catch (error) {
      res.status(500).json({ error: "Failed to acknowledge alert" });
    }
  });

  app.put("/api/alerts/:id/resolve", authenticateUser, async (req, res) => {
    try {
      const { resolutionMethod = "service" } = req.body;
      const alert = await storage.resolveAlert(req.params.id, resolutionMethod);
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      broadcast({ type: "alert_resolved", data: alert });
      res.json(alert);
    } catch (error) {
      res.status(500).json({ error: "Failed to resolve alert" });
    }
  });

  app.get("/api/alerts/container/:containerId", authenticateUser, async (req, res) => {
    try {
      const alerts = await storage.getAlertsByContainer(req.params.containerId);
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch container alerts" });
    }
  });

  // Service Request routes
  app.get("/api/service-requests", authenticateUser, async (req: any, res) => {
    try {
      const role = (req.user?.role || '').toLowerCase();
      if (role === 'client') {
        const customer = await storage.getCustomerByUserId(req.user.id);
        if (!customer) return res.json([]);
        return res.json(await storage.getServiceRequestsByCustomer(customer.id));
      }
      if (role === 'technician') {
        const tech = await storage.getTechnician(req.user.id);
        if (!tech) return res.json([]);
        return res.json(await storage.getServiceRequestsByTechnician(tech.id));
      }
      const requests = await storage.getAllServiceRequests();
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch service requests" });
    }
  });

  app.get("/api/service-requests/pending", authenticateUser, requireRole("admin", "coordinator"), async (req, res) => {
    try {
      const requests = await storage.getPendingServiceRequests();
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending requests" });
    }
  });

  app.post("/api/service-requests", authenticateUser, async (req, res) => {
    try {
      const request = await storage.createServiceRequest({
        requestNumber: `SR-${Date.now()}`,
        ...req.body,
        status: "pending",
        createdAt: new Date(),
      });

      broadcast({ type: "service_request_created", data: request });
      res.json(request);
    } catch (error) {
      res.status(500).json({ error: "Failed to create service request" });
    }
  });

  app.patch("/api/service-requests/:id", authenticateUser, async (req, res) => {
    try {
      const request = await storage.updateServiceRequest(req.params.id, req.body);
      broadcast({ type: "service_request_updated", data: request });
      res.json(request);
    } catch (error) {
      res.status(500).json({ error: "Failed to update service request" });
    }
  });

  // Enhanced Service Request Management according to PRD
  app.get("/api/service-requests/status/:status", authenticateUser, async (req, res) => {
    try {
      const requests = await storage.getServiceRequestsByStatus(req.params.status);
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch service requests by status" });
    }
  });

  app.get("/api/service-requests/priority/:priority", authenticateUser, async (req, res) => {
    try {
      const requests = await storage.getServiceRequestsByPriority(req.params.priority);
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch service requests by priority" });
    }
  });

  app.get("/api/service-requests/technician/:technicianId", authenticateUser, async (req, res) => {
    try {
      const requests = await storage.getServiceRequestsByTechnician(req.params.technicianId);
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch technician service requests" });
    }
  });

  app.get("/api/service-requests/customer/:customerId", authenticateUser, async (req, res) => {
    try {
      const requests = await storage.getServiceRequestsByCustomer(req.params.customerId);
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer service requests" });
    }
  });

  app.post("/api/service-requests/:id/assign", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const { technicianId, scheduledDate, scheduledTimeWindow } = req.body;
      const request = await storage.assignServiceRequest(
        req.params.id, 
        technicianId, 
        scheduledDate, 
        scheduledTimeWindow
      );
      if (!request) {
        return res.status(404).json({ error: "Service request not found" });
      }
      broadcast({ type: "service_request_assigned", data: request });
      res.json(request);
    } catch (error) {
      res.status(500).json({ error: "Failed to assign service request" });
    }
  });

  app.post("/api/service-requests/:id/start", authenticateUser, async (req, res) => {
    try {
      const request = await storage.startServiceRequest(req.params.id);
      if (!request) {
        return res.status(404).json({ error: "Service request not found" });
      }
      broadcast({ type: "service_request_started", data: request });
      res.json(request);
    } catch (error) {
      res.status(500).json({ error: "Failed to start service request" });
    }
  });

  app.post("/api/service-requests/:id/complete", authenticateUser, async (req, res) => {
    try {
      const { resolutionNotes, usedParts, beforePhotos, afterPhotos } = req.body;
      const request = await storage.completeServiceRequest(
        req.params.id, 
        resolutionNotes, 
        usedParts, 
        beforePhotos, 
        afterPhotos
      );
      if (!request) {
        return res.status(404).json({ error: "Service request not found" });
      }
      broadcast({ type: "service_request_completed", data: request });
      res.json(request);
    } catch (error) {
      res.status(500).json({ error: "Failed to complete service request" });
    }
  });

  app.post("/api/service-requests/:id/cancel", authenticateUser, async (req, res) => {
    try {
      const { reason } = req.body;
      const request = await storage.cancelServiceRequest(req.params.id, reason);
      if (!request) {
        return res.status(404).json({ error: "Service request not found" });
      }
      broadcast({ type: "service_request_cancelled", data: request });
      res.json(request);
    } catch (error) {
      res.status(500).json({ error: "Failed to cancel service request" });
    }
  });

  app.get("/api/service-requests/:id/timeline", authenticateUser, async (req, res) => {
    try {
      const timeline = await storage.getServiceRequestTimeline(req.params.id);
      res.json(timeline);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch service request timeline" });
    }
  });

  // Technician routes
  app.get("/api/technicians", authenticateUser, async (req, res) => {
    try {
      const technicians = await storage.getAllTechnicians();
      res.json(technicians);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch technicians" });
    }
  });

  app.get("/api/technicians/available", authenticateUser, async (req, res) => {
    try {
      const technicians = await storage.getAvailableTechnicians();
      res.json(technicians);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch available technicians" });
    }
  });

  // Enhanced Technician Management according to PRD
  app.get("/api/technicians/:id", authenticateUser, async (req, res) => {
    try {
      const technician = await storage.getTechnician(req.params.id);
      if (!technician) {
        return res.status(404).json({ error: "Technician not found" });
      }
      res.json(technician);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch technician" });
    }
  });

  app.get("/api/technicians/:id/performance", authenticateUser, async (req, res) => {
    try {
      const performance = await storage.getTechnicianPerformance(req.params.id);
      res.json(performance);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch technician performance" });
    }
  });

  app.get("/api/technicians/:id/schedule", authenticateUser, async (req, res) => {
    try {
      const { date } = req.query;
      const schedule = await storage.getTechnicianSchedule(req.params.id, date as string);
      res.json(schedule);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch technician schedule" });
    }
  });

  app.get("/api/technicians/skills/:skill", authenticateUser, async (req, res) => {
    try {
      const technicians = await storage.getTechniciansBySkill(req.params.skill);
      res.json(technicians);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch technicians by skill" });
    }
  });

  app.get("/api/technicians/location/:location", authenticateUser, async (req, res) => {
    try {
      const technicians = await storage.getTechniciansByLocation(req.params.location);
      res.json(technicians);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch technicians by location" });
    }
  });

  app.put("/api/technicians/:id/status", authenticateUser, async (req, res) => {
    try {
      const { status } = req.body;
      const technician = await storage.updateTechnicianStatus(req.params.id, status);
      if (!technician) {
        return res.status(404).json({ error: "Technician not found" });
      }
      broadcast({ type: "technician_status_updated", data: technician });
      res.json(technician);
    } catch (error) {
      res.status(500).json({ error: "Failed to update technician status" });
    }
  });

  app.put("/api/technicians/:id/location", authenticateUser, async (req, res) => {
    try {
      const { location } = req.body;
      const technician = await storage.updateTechnicianLocation(req.params.id, location);
      if (!technician) {
        return res.status(404).json({ error: "Technician not found" });
      }
      broadcast({ type: "technician_location_updated", data: technician });
      res.json(technician);
    } catch (error) {
      res.status(500).json({ error: "Failed to update technician location" });
    }
  });

  app.post("/api/technicians", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const technician = await storage.createTechnician(req.body);
      broadcast({ type: "technician_created", data: technician });
      res.json(technician);
    } catch (error) {
      res.status(500).json({ error: "Failed to create technician" });
    }
  });

  app.put("/api/technicians/:id", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const technician = await storage.updateTechnician(req.params.id, req.body);
      if (!technician) {
        return res.status(404).json({ error: "Technician not found" });
      }
      broadcast({ type: "technician_updated", data: technician });
      res.json(technician);
    } catch (error) {
      res.status(500).json({ error: "Failed to update technician" });
    }
  });

  // Clients routes (compat shim) -> use customers storage
  app.get("/api/clients", authenticateUser, requireRole("admin", "coordinator"), async (_req, res) => {
    try {
      const list = await storage.getAllCustomers();
      res.json(list);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.post("/api/clients", authenticateUser, requireRole("admin", "coordinator"), async (req, res) => {
    try {
      const created = await storage.createCustomer(req.body);
      res.json(created);
    } catch (error) {
      res.status(500).json({ error: "Failed to create client" });
    }
  });

  app.put("/api/clients/:id", authenticateUser, requireRole("admin", "coordinator"), async (req, res) => {
    try {
      // @ts-ignore add method exists in storage
      const updated = await storage.updateCustomer(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update client" });
    }
  });

  app.delete("/api/clients/:id", authenticateUser, requireRole("admin", "coordinator"), async (req, res) => {
    try {
      // @ts-ignore add method exists in storage
      const deleted = await storage.deleteCustomer(req.params.id);
      res.json(deleted);
    } catch (error) {
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  // Inventory routes
  app.get("/api/inventory", authenticateUser, async (req, res) => {
    try {
      // This would need a getAllInventory method in storage
      res.json([]);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch inventory" });
    }
  });

  // Scheduling routes
  app.post("/api/scheduling/run", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const result = await runDailyScheduler();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Scheduling failed" });
    }
  });

  // IoT polling endpoint (called by cron job)
  app.post("/api/iot/poll", async (req, res) => {
    try {
      const containers = await storage.getAllContainers();
      const iotContainers = containers.filter((c) => c.hasIot && c.orbcommDeviceId);

      const results = [];

      for (const container of iotContainers) {
        try {
          const data = await fetchOrbcommDeviceData(container.orbcommDeviceId!);
          const anomalies = detectAnomalies(data);

          // Update container location
          await storage.updateContainer(container.id, {
            currentLocation: {
              lat: data.location.latitude,
              lng: data.location.longitude,
            },
          });

          // Create alerts for anomalies
          if (anomalies.length > 0) {
            for (const anomaly of anomalies) {
              const classification = await classifyAlert(anomaly, `Detected: ${anomaly}`, container);

              await storage.createAlert({
                alertCode: `ALT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                containerId: container.id,
                alertType: "error",
                severity: classification.severity,
                description: `Anomaly detected: ${anomaly}`,
                source: "orbcomm",
                detectedAt: new Date(),
                metadata: {
                  aiClassification: classification,
                  errorCode: anomaly,
                  resolutionSteps: classification.resolutionSteps,
                  requiredParts: classification.requiredParts,
                  estimatedServiceTime: classification.estimatedServiceTime,
                },
              });
            }

            broadcast({ type: "anomaly_detected", data: { containerId: container.id, anomalies } });
          }

          results.push({ containerId: container.containerCode || container.containerId, status: "success", anomalies });
        } catch (error) {
          console.error(`Error polling container ${container.containerCode || container.containerId}:`, error);
          results.push({ containerId: container.containerCode || container.containerId, status: "error" });
        }
      }

      res.json({ polled: iotContainers.length, results });
    } catch (error) {
      res.status(500).json({ error: "Polling failed" });
    }
  });

  // Orbcomm device population endpoint
  app.post("/api/orbcomm/populate", authenticateUser, async (req, res) => {
    try {
      const { populateOrbcommDevices } = await import("./services/orbcomm");
      await populateOrbcommDevices();
      res.json({ message: "Orbcomm devices populated successfully" });
    } catch (error) {
      res.status(500).json({ error: "Device population failed" });
    }
  });

  // Orbcomm connection status endpoint
  app.get("/api/orbcomm/status", authenticateUser, async (req, res) => {
    try {
      const { getOrbcommClient } = await import("./services/orbcomm");
      const client = getOrbcommClient();
      res.json({ 
        connected: client.isConnected,
        url: process.env.ORBCOMM_URL || 'wss://integ.tms-orbcomm.com:44355/cdh'
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get connection status" });
    }
  });

  // Orbcomm data refresh endpoint
  app.post("/api/orbcomm/refresh", authenticateUser, async (req, res) => {
    try {
      const { getOrbcommClient } = await import("./services/orbcomm");
      const client = getOrbcommClient();
      
      if (!client.isConnected) {
        return res.status(400).json({ error: "Orbcomm not connected" });
      }
      
      // Request fresh device list
      const devices = await client.getAllDevices();
      
      res.json({ 
        message: "Data refresh initiated",
        devicesFound: devices.length,
        devices: devices
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to refresh data" });
    }
  });

  // Enhanced Orbcomm test endpoint
  app.post("/api/orbcomm/test", authenticateUser, async (req, res) => {
    try {
      const { getEnhancedOrbcommClient } = await import("./services/orbcomm");
      const client = getEnhancedOrbcommClient();
      
      const result = await client.testConnection();
      
      res.json({
        message: "Enhanced Orbcomm connection test completed",
        success: result.success,
        authenticationMethod: result.method,
        devicesFound: result.devices,
        connected: client.isConnected
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to test enhanced connection" });
    }
  });

  // Orbcomm INTEG test endpoint
  app.post("/api/orbcomm/integ-test", authenticateUser, async (req, res) => {
    try {
      const { getOrbcommIntegClient } = await import("./services/orbcomm");
      const client = getOrbcommIntegClient();
      
      const result = await client.testConnection();
      
      res.json({
        message: "Orbcomm INTEG Environment test completed",
        success: result.success,
        environment: result.environment,
        devicesFound: result.devices,
        connected: client.isConnected
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to test INTEG connection" });
    }
  });

  // WhatsApp webhook verification
  app.get("/api/webhook/whatsapp", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token === process.env.WEBHOOK_VERIFICATION_TOKEN) {
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  });

  // WhatsApp webhook for incoming messages
  app.post("/api/webhook/whatsapp", async (req, res) => {
    try {
      const data = req.body;

      if (data.entry?.[0]?.changes?.[0]?.value?.messages) {
        const messages = data.entry[0].changes[0].value.messages;

        for (const message of messages) {
          const phoneNumber = message.from;

          // Authorize phone number
          const authResult = await authorizeWhatsAppMessage(phoneNumber);

          if (!authResult.authorized) {
            await sendTextMessage(phoneNumber, authResult.error || "Not authorized");
            continue;
          }

          // Get or create session
          let session = await storage.getWhatsappSession(phoneNumber);
          if (!session) {
            session = await storage.createWhatsappSession({
              phoneNumber,
              userId: authResult.user.id,
              conversationState: {},
              lastMessageAt: new Date(),
              isActive: true,
            });
          }

          // Log message
          await storage.createWhatsappMessage({
            recipientType: (authResult.user.role === 'technician' ? 'technician' : 'customer'),
            recipientId: authResult.user.id,
            phoneNumber,
            messageType: message.type,
            templateName: null,
            messageContent: message,
            whatsappMessageId: message.id,
            status: 'delivered',
            conversationId: session.id,
            relatedEntityType: 'whatsapp_inbound',
            relatedEntityId: message.id,
            sentAt: new Date(),
          });

          // Handle message based on type and user role
          if (message.type === "text") {
            const text = message.text.body.toLowerCase();

            if (authResult.user.role === "client") {
              // Client commands
              if (text.includes("status") || text.includes("container")) {
                const customer = await storage.getCustomerByUserId(authResult.user.id);
                if (customer) {
                  const containers = await storage.getContainersByCustomer(customer.id);
                  await sendTextMessage(
                    phoneNumber,
                    `You have ${containers.length} containers. ${containers.filter((c) => c.status === "active").length} active.`
                  );
                }
              } else {
                await sendTextMessage(phoneNumber, "Commands: 'status', 'containers', 'help'");
              }
            } else if (authResult.user.role === "technician") {
              // Technician commands
              if (text.includes("schedule")) {
                await sendTextMessage(phoneNumber, "Your schedule will be sent at 7 PM daily.");
              }
            }
          }

          // Update session
          await storage.updateWhatsappSession(session.id, {
            lastMessageAt: new Date(),
          });
        }
      }

      res.sendStatus(200);
    } catch (error) {
      console.error("WhatsApp webhook error:", error);
      res.sendStatus(500);
    }
  });

  // Seed database route (for development)
  app.post("/api/seed", async (req, res) => {
    try {
      await simpleSeed();
      res.json({ message: "Database seeded successfully" });
    } catch (error) {
      console.error("Seed error:", error);
      res.status(500).json({ error: "Failed to seed database", details: error.message });
    }
  });

  // Start scheduler
  startScheduler();

  // Customer routes
  app.get("/api/customers", authenticateUser, requireRole("admin", "coordinator", "super_admin"), async (req, res) => {
    try {
      const customers = await storage.getAllCustomers();
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  // Current user's customer profile
  app.get("/api/customers/me", authenticateUser, async (req: any, res) => {
    try {
      const customer = await storage.getCustomerByUserId(req.user.id);
      if (!customer) return res.status(404).json({ error: "Customer not found" });
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer profile" });
    }
  });

  app.get("/api/customers/:id", authenticateUser, async (req: any, res) => {
    try {
      const role = (req.user?.role || '').toLowerCase();
      // Admins/coordinators can view any customer profile
      if (["admin","coordinator","super_admin"].includes(role)) {
        const customer = await storage.getCustomer(req.params.id);
        if (!customer) return res.status(404).json({ error: "Customer not found" });
        return res.json(customer);
      }

      // Clients can only view their own profile
      if (role === 'client') {
        const self = await storage.getCustomerByUserId(req.user.id);
        if (!self) return res.status(404).json({ error: "Customer not found" });
        if (self.id !== req.params.id) return res.status(403).json({ error: "Forbidden" });
        return res.json(self);
      }

      return res.status(403).json({ error: "Forbidden" });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  app.post("/api/customers", authenticateUser, requireRole("admin", "coordinator", "super_admin"), async (req, res) => {
    try {
      const customer = await storage.createCustomer(req.body);
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  // Invoice routes
  app.get("/api/invoices", authenticateUser, async (req, res) => {
    try {
      const invoices = await storage.getAllInvoices();
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  app.get("/api/invoices/:id", authenticateUser, async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invoice" });
    }
  });

  app.post("/api/invoices", authenticateUser, async (req, res) => {
    try {
      const invoice = await storage.createInvoice(req.body);
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "Failed to create invoice" });
    }
  });

  // Feedback routes
  app.get("/api/feedback", authenticateUser, async (req, res) => {
    try {
      const feedback = await storage.getAllFeedback();
      res.json(feedback);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch feedback" });
    }
  });

  app.post("/api/feedback", authenticateUser, async (req, res) => {
    try {
      const feedback = await storage.createFeedback(req.body);
      res.json(feedback);
    } catch (error) {
      res.status(500).json({ error: "Failed to create feedback" });
    }
  });

  // WhatsApp API routes
  app.post("/api/whatsapp/send", authenticateUser, async (req, res) => {
    try {
      const { to, message, type = "text" } = req.body;
      const result = await sendTextMessage(to, message);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to send WhatsApp message" });
    }
  });

  app.post("/api/whatsapp/send-buttons", authenticateUser, async (req, res) => {
    try {
      const { to, message, buttons } = req.body;
      const result = await sendInteractiveButtons(to, message, buttons);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to send WhatsApp buttons" });
    }
  });

  app.post("/api/whatsapp/send-list", authenticateUser, async (req, res) => {
    try {
      const { to, bodyText, buttonText, listItems } = req.body;
      const result = await sendListMessage(to, bodyText, buttonText, listItems);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to send WhatsApp list" });
    }
  });

  app.post("/api/whatsapp/send-media", authenticateUser, async (req, res) => {
    try {
      const { to, mediaType, mediaUrl, caption } = req.body;
      const result = await sendMediaMessage(to, mediaType, mediaUrl, caption);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to send WhatsApp media" });
    }
  });

  app.post("/api/whatsapp/send-template", authenticateUser, async (req, res) => {
    try {
      const { to, templateName, languageCode, parameters } = req.body;
      const result = await sendTemplateMessage(to, templateName, languageCode, parameters);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to send WhatsApp template" });
    }
  });

  app.post("/api/whatsapp/send-flow", authenticateUser, async (req, res) => {
    try {
      const { to, flowData } = req.body;
      const result = await sendFlowMessage(to, flowData);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to send WhatsApp flow" });
    }
  });

  // PRD-specific WhatsApp workflows
  app.post("/api/whatsapp/send-critical-alert", authenticateUser, async (req, res) => {
    try {
      const { alertId, customerId } = req.body;
      const alert = await storage.getAlert(alertId);
      const container = await storage.getContainer(alert.containerId);
      const customer = await storage.getCustomer(customerId);
      
      const message = formatCriticalAlertMessage(alert, container);
      const result = await sendTextMessage(customer.phoneNumber, message);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to send critical alert" });
    }
  });

  app.post("/api/whatsapp/send-technician-schedule", authenticateUser, async (req, res) => {
    try {
      const { technicianId, date } = req.body;
      const technician = await storage.getTechnician(technicianId);
      const services = await storage.getTechnicianSchedule(technicianId, date);
      
      const result = await sendTechnicianSchedule(technician, services);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to send technician schedule" });
    }
  });

  app.post("/api/whatsapp/send-invoice", authenticateUser, async (req, res) => {
    try {
      const { invoiceId, customerId } = req.body;
      const invoice = await storage.getInvoice(invoiceId);
      const customer = await storage.getCustomer(customerId);
      
      const message = formatInvoiceMessage(invoice);
      const result = await sendTextMessage(customer.phoneNumber, message);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to send invoice" });
    }
  });

  app.post("/api/whatsapp/send-feedback-request", authenticateUser, async (req, res) => {
    try {
      const { serviceRequestId, customerId } = req.body;
      const serviceRequest = await storage.getServiceRequest(serviceRequestId);
      const customer = await storage.getCustomer(customerId);
      
      const result = await sendCustomerFeedbackRequest(customer, serviceRequest);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to send feedback request" });
    }
  });

  // AI Scheduling API routes
  app.post("/api/scheduling/optimize", authenticateUser, async (req, res) => {
    try {
      const { date, constraints } = req.body;
      const { optimizeDailySchedules } = await import('./services/ai-scheduling');
      const optimizations = await optimizeDailySchedules(new Date(date));
      res.json(optimizations);
    } catch (error) {
      res.status(500).json({ error: "Failed to optimize schedules" });
    }
  });

  app.get("/api/scheduling/technician/:technicianId", authenticateUser, async (req, res) => {
    try {
      const { date } = req.query;
      const { generateTechnicianSchedule } = await import('./services/ai-scheduling');
      const schedule = await generateTechnicianSchedule(req.params.technicianId, new Date(date as string));
      res.json(schedule);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate technician schedule" });
    }
  });

  app.post("/api/scheduling/reschedule", authenticateUser, async (req, res) => {
    try {
      const { serviceRequestId, newDate, reason } = req.body;
      const { rescheduleServiceRequest } = await import('./services/ai-scheduling');
      const optimization = await rescheduleServiceRequest(serviceRequestId, new Date(newDate), reason);
      res.json(optimization);
    } catch (error) {
      res.status(500).json({ error: "Failed to reschedule service request" });
    }
  });

  app.get("/api/scheduling/daily/:date", authenticateUser, async (req: any, res) => {
    try {
      const schedule = await storage.getScheduledServicesByDate(req.params.date);
      res.json(schedule);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch daily schedule" });
    }
  });

  // Invoicing API routes
  app.post("/api/invoicing/generate", authenticateUser, async (req, res) => {
    try {
      const { serviceRequestId } = req.body;
      const { generateInvoice } = await import('./services/invoicing');
      const invoice = await generateInvoice(serviceRequestId);
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate invoice" });
    }
  });

  app.post("/api/invoicing/payment", authenticateUser, async (req, res) => {
    try {
      const { invoiceId, amount, paymentMethod, paymentReference } = req.body;
      const { processPayment } = await import('./services/invoicing');
      const invoice = await processPayment(invoiceId, amount, paymentMethod, paymentReference);
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ error: "Failed to process payment" });
    }
  });

  app.post("/api/invoicing/send", authenticateUser, async (req, res) => {
    try {
      const { invoiceId } = req.body;
      const { sendInvoiceToCustomer } = await import('./services/invoicing');
      await sendInvoiceToCustomer(invoiceId);
      res.json({ message: "Invoice sent successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to send invoice" });
    }
  });

  app.get("/api/invoicing/analytics", authenticateUser, async (req, res) => {
    try {
      const { period = 'month' } = req.query;
      const { getInvoiceAnalytics } = await import('./services/invoicing');
      const analytics = await getInvoiceAnalytics(period as 'month' | 'quarter' | 'year');
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: "Failed to get invoice analytics" });
    }
  });

  // Feedback Collection API routes
  app.post("/api/feedback/request", authenticateUser, async (req, res) => {
    try {
      const { serviceRequestId } = req.body;
      const { sendFeedbackRequest } = await import('./services/feedback-collection');
      await sendFeedbackRequest(serviceRequestId);
      res.json({ message: "Feedback request sent successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to send feedback request" });
    }
  });

  app.post("/api/feedback/submit", authenticateUser, async (req, res) => {
    try {
      const { serviceRequestId, customerId, response } = req.body;
      const { processFeedbackResponse } = await import('./services/feedback-collection');
      const feedback = await processFeedbackResponse(serviceRequestId, customerId, response);
      res.json(feedback);
    } catch (error) {
      res.status(500).json({ error: "Failed to process feedback response" });
    }
  });

  app.get("/api/feedback/analytics", authenticateUser, async (req, res) => {
    try {
      const { period = 'month' } = req.query;
      const { getFeedbackAnalytics } = await import('./services/feedback-collection');
      const analytics = await getFeedbackAnalytics(period as 'month' | 'quarter' | 'year');
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: "Failed to get feedback analytics" });
    }
  });

  app.get("/api/feedback/technician/:technicianId", authenticateUser, async (req, res) => {
    try {
      const { getTechnicianFeedbackSummary } = await import('./services/feedback-collection');
      const summary = await getTechnicianFeedbackSummary(req.params.technicianId);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to get technician feedback summary" });
    }
  });

  app.post("/api/feedback/reminder", authenticateUser, async (req, res) => {
    try {
      const { serviceRequestId } = req.body;
      const { sendFeedbackReminder } = await import('./services/feedback-collection');
      await sendFeedbackReminder(serviceRequestId);
      res.json({ message: "Feedback reminder sent successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to send feedback reminder" });
    }
  });

  // Inventory Management API routes
  app.get("/api/inventory", authenticateUser, async (req, res) => {
    try {
      const { getAllInventoryItems } = await import('./services/inventory');
      const items = await getAllInventoryItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch inventory items" });
    }
  });

  app.get("/api/inventory/:id", authenticateUser, async (req, res) => {
    try {
      const { getInventoryItem } = await import('./services/inventory');
      const item = await getInventoryItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Inventory item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch inventory item" });
    }
  });

  app.post("/api/inventory", authenticateUser, async (req, res) => {
    try {
      const { createInventoryItem } = await import('./services/inventory');
      const item = await createInventoryItem(req.body);
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to create inventory item" });
    }
  });

  app.put("/api/inventory/:id", authenticateUser, async (req, res) => {
    try {
      const { getInventoryService } = await import('./services/inventory');
      const service = getInventoryService();
      const item = await service.updateItem(req.params.id, req.body);
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to update inventory item" });
    }
  });

  app.delete("/api/inventory/:id", authenticateUser, async (req, res) => {
    try {
      const { getInventoryService } = await import('./services/inventory');
      const service = getInventoryService();
      await service.deleteItem(req.params.id);
      res.json({ message: "Inventory item deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete inventory item" });
    }
  });

  app.post("/api/inventory/add-stock", authenticateUser, async (req, res) => {
    try {
      const { itemId, quantity, reason, userId } = req.body;
      const { getInventoryService } = await import('./services/inventory');
      const service = getInventoryService();
      const transaction = await service.addStock(itemId, quantity, reason, userId);
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ error: "Failed to add stock" });
    }
  });

  app.post("/api/inventory/remove-stock", authenticateUser, async (req, res) => {
    try {
      const { itemId, quantity, reason, userId } = req.body;
      const { getInventoryService } = await import('./services/inventory');
      const service = getInventoryService();
      const transaction = await service.removeStock(itemId, quantity, reason, userId);
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ error: "Failed to remove stock" });
    }
  });

  app.post("/api/inventory/adjust-stock", authenticateUser, async (req, res) => {
    try {
      const { itemId, newQuantity, reason, userId } = req.body;
      const { getInventoryService } = await import('./services/inventory');
      const service = getInventoryService();
      const transaction = await service.adjustStock(itemId, newQuantity, reason, userId);
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ error: "Failed to adjust stock" });
    }
  });

  app.get("/api/inventory/reorder-alerts", authenticateUser, async (req, res) => {
    try {
      const { getReorderAlerts } = await import('./services/inventory');
      const alerts = await getReorderAlerts();
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reorder alerts" });
    }
  });

  app.get("/api/inventory/analytics", authenticateUser, async (req, res) => {
    try {
      const { getInventoryAnalytics } = await import('./services/inventory');
      const analytics = await getInventoryAnalytics();
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch inventory analytics" });
    }
  });

  app.get("/api/inventory/search", authenticateUser, async (req, res) => {
    try {
      const { query } = req.query;
      const { getInventoryService } = await import('./services/inventory');
      const service = getInventoryService();
      const items = await service.searchItems(query as string);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to search inventory items" });
    }
  });

  app.get("/api/inventory/category/:category", authenticateUser, async (req, res) => {
    try {
      const { getInventoryService } = await import('./services/inventory');
      const service = getInventoryService();
      const items = await service.getItemsByCategory(req.params.category);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch items by category" });
    }
  });

  app.get("/api/inventory/transactions", authenticateUser, async (req, res) => {
    try {
      const { itemId, limit } = req.query;
      const { getInventoryService } = await import('./services/inventory');
      const service = getInventoryService();
      const transactions = await service.getTransactions(itemId as string, parseInt(limit as string) || 100);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch inventory transactions" });
    }
  });

  // Start IoT polling every 5 minutes
  setInterval(
    async () => {
      try {
        await fetch(`http://localhost:${process.env.PORT || 5000}/api/iot/poll`, {
          method: "POST",
        });
      } catch (error) {
        console.error("IoT polling error:", error);
      }
    },
    5 * 60 * 1000
  );

  return httpServer;
}
