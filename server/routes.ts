

import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import axios from "axios";
import { storage } from "./storage";
import { z } from "zod";
import { authenticateUser, requireRole, authorizeWhatsAppMessage } from "./middleware/auth";
import type { AuthRequest } from "./middleware/auth";
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

  // Enhanced WebSocket for real-time updates with user authentication
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  interface AuthenticatedWebSocket extends WebSocket {
    userId?: string;
    userRole?: string;
    isAuthenticated?: boolean;
  }

  const clients = new Map<string, AuthenticatedWebSocket>();

  wss.on("connection", (ws: AuthenticatedWebSocket) => {
    ws.isAuthenticated = false;
    console.log("WebSocket client connected");

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'authenticate') {
          // Authenticate WebSocket connection
          const { token } = message;
          if (token) {
            // Verify JWT token (simplified for demo)
            const user = await storage.getUser(token);
            if (user) {
              ws.userId = user.id;
              ws.userRole = user.role;
              ws.isAuthenticated = true;
              clients.set(user.id, ws);

              console.log(`WebSocket authenticated for user: ${user.name} (${user.role})`);

              // Send authentication success
              ws.send(JSON.stringify({
                type: 'authenticated',
                user: { id: user.id, name: user.name, role: user.role }
              }));

              // Send recent WhatsApp messages for this user
              const recentMessages = await storage.getRecentWhatsAppMessages(user.id, 50);
              ws.send(JSON.stringify({
                type: 'recent_messages',
                messages: recentMessages
              }));
            } else {
              ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid token' }));
            }
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on("close", () => {
      if (ws.userId) {
        clients.delete(ws.userId);
      }
      console.log("WebSocket client disconnected");
    });

    // Send heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'heartbeat' }));
      } else {
        clearInterval(heartbeat);
      }
    }, 30000);
  });

  // Enhanced broadcast function with role-based filtering
  function broadcast(data: any, targetUserId?: string, targetRole?: string) {
    clients.forEach((client, userId) => {
      if (client.readyState === WebSocket.OPEN && client.isAuthenticated) {
        // Filter by user or role if specified
        if (targetUserId && userId !== targetUserId) return;
        if (targetRole && client.userRole !== targetRole) return;

        client.send(JSON.stringify(data));
      }
    });
  }

  // Expose broadcast globally for services (e.g., Orbcomm) to emit realtime events
  (global as any).broadcast = broadcast;

  // Broadcast WhatsApp message to specific user or role
  function broadcastWhatsAppMessage(messageData: any, targetUserId?: string, targetRole?: string) {
    broadcast({
      type: 'whatsapp_message',
      timestamp: new Date(),
      data: messageData
    }, targetUserId, targetRole);
  }

  // Global reference for WhatsApp service to use
  ;(global as any).broadcastWhatsAppMessage = broadcastWhatsAppMessage;

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(401).json({ error: "Invalid credentials" });

      const { comparePasswords } = await import('./services/auth');
      const ok = await comparePasswords(password, user.password || '');
      if (!ok) return res.status(401).json({ error: "Invalid credentials" });

      if (!user.emailVerified) {
        return res.status(403).json({ error: "Email not verified" });
      }

      // Temporary token compatibility using user.id
      res.json({ user, token: user.id });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { name, email, phoneNumber, password, role } = req.body;

      if (!email || !password || !name || !phoneNumber) {
        return res.status(400).json({ error: "Name, email, phone and password are required" });
      }

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) return res.status(400).json({ error: "Email already registered" });

      const existingPhone = await storage.getUserByPhoneNumber(phoneNumber);
      if (existingPhone) return res.status(400).json({ error: "Phone already registered" });

      const { hashPassword, createAndSendEmailOTP } = await import('./services/auth');
      const passwordHash = await hashPassword(password);

      const user = await storage.createUser({
        phoneNumber,
        name,
        email,
        password: passwordHash,
        role: role || "client",
        isActive: true,
        whatsappVerified: false,
        emailVerified: false,
      });

      await createAndSendEmailOTP(user);

      res.json({ user, token: user.id, message: 'Verification code sent to email' });
    } catch (error) {
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // Forgot password (send OTP)
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email required' });
      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(404).json({ error: 'User not found' });
      const { createAndSendEmailOTP } = await import('./services/auth');
      await createAndSendEmailOTP(user);
      res.json({ message: 'OTP sent to email' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to send OTP' });
    }
  });

  // Reset password with OTP
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { email, code, newPassword } = req.body;
      if (!email || !code || !newPassword) return res.status(400).json({ error: 'Email, code and newPassword required' });
      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(404).json({ error: 'User not found' });
      const { verifyEmailCode, hashPassword } = await import('./services/auth');
      const ok = await verifyEmailCode(user.id, code);
      if (!ok) return res.status(401).json({ error: 'Invalid or expired code' });
      const passwordHash = await hashPassword(newPassword);
      await storage.updateUser(user.id, { password: passwordHash, emailVerified: true } as any);
      res.json({ message: 'Password reset successful' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  // Email OTP verification
  app.post('/api/auth/verify-email', async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) return res.status(400).json({ error: 'Email and code required' });

      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const { verifyEmailCode } = await import('./services/auth');
      const ok = await verifyEmailCode(user.id, code);
      if (!ok) return res.status(401).json({ error: 'Invalid or expired code' });

      await storage.updateUser(user.id, { emailVerified: true });
      res.json({ message: 'Email verified', user, token: user.id });
    } catch (error) {
      res.status(500).json({ error: 'Verification failed' });
    }
  });

  // Resend email OTP
  app.post('/api/auth/resend-email', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email required' });

      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(404).json({ error: 'User not found' });
      if (user.emailVerified) return res.json({ message: 'Email already verified' });

      const { createAndSendEmailOTP } = await import('./services/auth');
      await createAndSendEmailOTP(user);
      res.json({ message: 'Verification code resent' });
    } catch (error) {
      res.status(500).json({ error: 'Resend failed' });
    }
  });

  // Test endpoint to get all users (for development only)
  app.get("/api/test/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  // Test endpoint to create a test user (for development only)
  app.post("/api/test/create-user", async (req, res) => {
    try {
      const testUserId = "test-admin-123";
      
      // Check if user already exists
      const existingUser = await storage.getUser(testUserId);
      if (existingUser) {
        return res.json({ 
          success: true, 
          user: { 
            id: existingUser.id, 
            name: existingUser.name, 
            role: existingUser.role 
          },
          message: "Test user already exists"
        });
      }
      
      const { hashPassword } = await import('./services/auth');
      const defaultPassword = await hashPassword('test123');
      
      const user = await storage.createUser({
        id: testUserId, // Set specific ID for testing
        phoneNumber: '+1234567890',
        name: 'Test Admin',
        email: 'test@example.com',
        password: defaultPassword,
        role: 'admin',
        isActive: true,
        whatsappVerified: false,
        emailVerified: false,
      });
      
      res.json({ 
        success: true, 
        user: { 
          id: user.id, 
          name: user.name, 
          role: user.role 
        } 
      });
    } catch (error) {
      console.error("Test user creation error:", error);
      res.status(500).json({ error: "Failed to create test user", details: error.message });
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
  // Zod: pagination schema
  const paginationSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100000).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  });

  // Zod: container create/update schema (subset)
  const containerBodySchema = z.object({
    containerCode: z.string().min(1),
    type: z.enum(["refrigerated", "dry", "special", "iot_enabled", "manual"]).optional(),
    hasIot: z.boolean().optional(),
    orbcommDeviceId: z.string().optional(),
    status: z.enum(["active", "in_service", "maintenance", "retired", "in_transit", "for_sale", "sold"]).optional(),
    currentCustomerId: z.string().uuid().optional().nullable(),
    currentLocation: z.any().optional(),
  });

  // Zod: service request create schema (subset)
  const srCreateSchema = z.object({
    containerId: z.string().min(1),
    customerId: z.string().min(1),
    priority: z.enum(["urgent", "high", "normal", "low"]).optional(),
    issueDescription: z.string().min(3),
    estimatedDuration: z.number().int().positive().optional(),
  });

  app.get("/api/containers", authenticateUser, async (req: AuthRequest, res) => {
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
      // Optional pagination: only apply if query includes limit or offset
      const hasLimit = Object.prototype.hasOwnProperty.call(req.query, 'limit');
      const hasOffset = Object.prototype.hasOwnProperty.call(req.query, 'offset');
      if (hasLimit || hasOffset) {
        const { limit, offset } = paginationSchema.parse(req.query);
        res.setHeader('x-total-count', String(containers.length));
        return res.json(containers.slice(offset, offset + limit));
      }
      // Default: return full list (backward compatible)
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

  app.post("/api/containers", authenticateUser, requireRole("admin"), async (req: AuthRequest, res) => {
    try {
      const parsed = containerBodySchema.parse(req.body);
      const container = await storage.createContainer(parsed);
      broadcast({ type: "container_created", data: container });
      res.json(container);
    } catch (error) {
      const message = (error as any)?.issues ? "Validation failed" : "Failed to create container";
      res.status(400).json({ error: message, details: (error as any)?.issues });
    }
  });

  app.put("/api/containers/:id", authenticateUser, requireRole("admin"), async (req: AuthRequest, res) => {
    try {
      const parsed = containerBodySchema.partial().parse(req.body);
      const container = await storage.updateContainer(req.params.id, parsed);
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }
      broadcast({ type: "container_updated", data: container });
      res.json(container);
    } catch (error) {
      const message = (error as any)?.issues ? "Validation failed" : "Failed to update container";
      res.status(400).json({ error: message, details: (error as any)?.issues });
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
  app.get("/api/service-requests", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const role = (req.user?.role || '').toLowerCase();
      if (role === 'client') {
        const customer = await storage.getCustomerByUserId(req.user.id);
        if (!customer) return res.json([]);
        const list = await storage.getServiceRequestsByCustomer(customer.id);
        const hasLimit = Object.prototype.hasOwnProperty.call(req.query, 'limit');
        const hasOffset = Object.prototype.hasOwnProperty.call(req.query, 'offset');
        if (hasLimit || hasOffset) {
          const { limit, offset } = paginationSchema.parse(req.query);
          res.setHeader('x-total-count', String(list.length));
          return res.json(list.slice(offset, offset + limit));
        }
        return res.json(list);
      }
      if (role === 'technician') {
        const tech = await storage.getTechnician(req.user.id);
        if (!tech) return res.json([]);
        const list = await storage.getServiceRequestsByTechnician(tech.id);
        const hasLimit = Object.prototype.hasOwnProperty.call(req.query, 'limit');
        const hasOffset = Object.prototype.hasOwnProperty.call(req.query, 'offset');
        if (hasLimit || hasOffset) {
          const { limit, offset } = paginationSchema.parse(req.query);
          res.setHeader('x-total-count', String(list.length));
          return res.json(list.slice(offset, offset + limit));
        }
        return res.json(list);
      }
      const requests = await storage.getAllServiceRequests();
      const hasLimit = Object.prototype.hasOwnProperty.call(req.query, 'limit');
      const hasOffset = Object.prototype.hasOwnProperty.call(req.query, 'offset');
      if (hasLimit || hasOffset) {
        const { limit, offset } = paginationSchema.parse(req.query);
        res.setHeader('x-total-count', String(requests.length));
        return res.json(requests.slice(offset, offset + limit));
      }
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch service requests" });
    }
  });

  // Single service request with relations for detail view
  app.get("/api/service-requests/:id", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const request = await storage.getServiceRequest(id);
      if (!request) return res.status(404).json({ error: "Not found" });

      const [container, customer, technician] = await Promise.all([
        storage.getContainer(request.containerId),
        storage.getCustomer(request.customerId),
        request.assignedTechnicianId ? storage.getTechnician(request.assignedTechnicianId) : Promise.resolve(undefined)
      ]);

      const response = {
        ...request,
        container: container ? { id: container.id, containerCode: container.containerCode, currentLocation: container.currentLocation } : undefined,
        customer: customer ? { id: customer.id, companyName: customer.companyName } : undefined,
        technician: technician ? { id: technician.id, name: (await storage.getUser(technician.userId))?.name || technician.employeeCode } : undefined,
      };

      res.json(response);
    } catch (error) {
      console.error("Fetch service request detail error:", error);
      res.status(500).json({ error: "Failed to fetch service request detail" });
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

  app.post("/api/service-requests", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const body = srCreateSchema.safeParse(req.body || {});
      if (!body.success) {
        return res.status(400).json({ error: "Validation failed", details: body.error.issues });
      }
      let { containerId, customerId, priority, issueDescription, estimatedDuration } = body.data;

      const role = (req.user?.role || '').toLowerCase();
      if (role === 'client') {
        const me = await storage.getCustomerByUserId(req.user.id);
        if (me) customerId = me.id;
      }

      const [container, customer] = await Promise.all([
        storage.getContainer(containerId),
        storage.getCustomer(customerId),
      ]);

      if (!container) {
        return res.status(400).json({ error: "Invalid containerId" });
      }
      if (!customer) {
        return res.status(400).json({ error: "Invalid customerId" });
      }

      const finalPriority = priority || "normal";

      // Choose a valid createdBy: prefer req.user if exists in DB, else fallback to customer's userId
      let createdById = req.user?.id as string | undefined;
      const creatorUser = createdById ? await storage.getUser(createdById) : undefined;
      if (!creatorUser) {
        createdById = customer.userId;
      }

      const request = await storage.createServiceRequest({
        requestNumber: `SR-${Date.now()}`,
        containerId,
        customerId,
        priority: finalPriority,
        issueDescription,
        estimatedDuration: typeof estimatedDuration === 'number' ? estimatedDuration : undefined,
        status: "pending",
        createdAt: new Date(),
        createdBy: createdById!,
        requestedAt: new Date(),
      });

      broadcast({ type: "service_request_created", data: request });
      // Auto-assign best technician based on proximity/availability
      try {
        const { schedulerService } = await import('./services/scheduler');
        const result = await schedulerService.autoAssignBestTechnician(request.id);
        if (result.assigned && result.request) {
          broadcast({ type: "service_request_assigned", data: result.request });
          return res.json({ ...result.request, autoAssigned: true, technicianId: result.technicianId });
        }
      } catch (autoErr) {
        // Log but don't fail the creation
        console.warn('Auto-assign failed:', (autoErr as any)?.message || autoErr);
      }

      res.json({ ...request, autoAssigned: false });
    } catch (error: unknown) {
      const message = (error as any)?.issues ? "Validation failed" : "Failed to create service request";
      const details = (error as any)?.cause?.message || (error as any)?.detail;
      res.status(400).json({ error: message, details });
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
      const { technicianId, scheduledDate, scheduledTimeWindow } = req.body || {};
      if (!technicianId) {
        return res.status(400).json({ error: "technicianId is required" });
      }
      const schedDate = scheduledDate ? new Date(scheduledDate) : undefined;
      const request = await storage.assignServiceRequest(
        req.params.id, 
        technicianId, 
        schedDate, 
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
      // In development, if :id looks like a user id, try resolving by userId too
      let technician = await storage.getTechnician(req.params.id);
      if (!technician && process.env.NODE_ENV === 'development') {
        const all = await storage.getAllTechnicians();
        technician = all.find((t: any) => t.userId === req.params.id) as any;
      }
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
      console.log("Received technician creation request:", req.body);
      const technicianData = req.body;
      
      // Create a user first (required for technician)
      const { hashPassword } = await import('./services/auth');
      const defaultPassword = await hashPassword('ChangeMe@123');
      
      console.log("Creating user for technician...");
      const user = await storage.createUser({
        phoneNumber: technicianData.phone || technicianData.whatsappNumber,
        name: technicianData.name,
        email: technicianData.email,
        password: defaultPassword,
        role: "technician",
        isActive: true,
        whatsappVerified: false,
        emailVerified: false,
      });
      console.log("User created:", user);
      
      // Generate employee code
      const employeeCode = `TECH-${Date.now().toString().slice(-6)}`;
      
      // Create the technician with the user ID
      const techData = {
        userId: user.id,
        employeeCode: employeeCode, // Use camelCase as defined in schema
        experienceLevel: technicianData.experienceLevel,
        skills: technicianData.specialization ? [technicianData.specialization] : ['general'],
        baseLocation: technicianData.baseLocation ? { city: technicianData.baseLocation } : null,
        serviceAreas: technicianData.baseLocation ? [technicianData.baseLocation] : [],
        status: 'available',
        averageRating: 0,
        totalJobsCompleted: 0,
      };
      console.log("Creating technician with data:", techData);
      
      const technician = await storage.createTechnician(techData);
      console.log("Technician created:", technician);
      
      broadcast({ type: "technician_created", data: technician });
      res.json(technician);
    } catch (error) {
      console.error("Technician creation error:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        technicianData: req.body
      });
      res.status(500).json({ error: "Failed to create technician", details: error.message });
    }
  });

  app.put("/api/technicians/:id", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      // Fetch existing to get userId
      const existing = await storage.getTechnician(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Technician not found" });
      }

      // Map incoming camelCase from UI to DB columns
      const body = req.body || {};

      // Update user profile fields when provided
      const userUpdate: any = {};
      if (typeof body.name === 'string') userUpdate.name = body.name;
      if (typeof body.email === 'string') userUpdate.email = body.email;
      // Prefer whatsappNumber when provided; otherwise fall back to phone
      const hasWhatsApp = typeof body.whatsappNumber === 'string' && body.whatsappNumber.trim().length > 0;
      const hasPhone = typeof body.phone === 'string' && body.phone.trim().length > 0;
      if (hasWhatsApp) {
        userUpdate.phoneNumber = body.whatsappNumber;
      } else if (hasPhone) {
        userUpdate.phoneNumber = body.phone;
      }
      if (Object.keys(userUpdate).length > 0) {
        await storage.updateUser(existing.userId, userUpdate);
      }

      const payload: any = {
        experienceLevel: body.experienceLevel ?? body.experience_level,
        skills: Array.isArray(body.skills)
          ? body.skills
          : (body.specialization ? [body.specialization] : undefined),
        baseLocation: body.baseLocation ?? body.home_location ?? (body.baseLocationCity ? { city: body.baseLocationCity } : undefined),
        serviceAreas: body.serviceAreas ?? body.service_areas,
        status: body.status,
        averageRating: body.averageRating ?? body.rating,
        totalJobsCompleted: body.totalJobsCompleted ?? body.servicesCompleted,
      };
      // Remove undefined keys so we don't overwrite with null/undefined
      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

      const technician = await storage.updateTechnician(req.params.id, payload);
      if (!technician) {
        return res.status(404).json({ error: "Technician not found" });
      }
      broadcast({ type: "technician_updated", data: technician });
      res.json(technician);
    } catch (error) {
      console.error("Technician update error:", error);
      res.status(500).json({ error: "Failed to update technician" });
    }
  });

  app.delete("/api/technicians/:id", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const existing = await storage.getTechnician(req.params.id);
      if (!existing) return res.status(404).json({ error: "Technician not found" });
      // Soft delete: mark user inactive and remove technician row
      await storage.updateUser(existing.userId, { isActive: false } as any);
      const { db } = await import('./db');
      const { technicians } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      await db.delete(technicians).where(eq(technicians.id, req.params.id));
      broadcast({ type: "technician_deleted", data: { id: req.params.id } });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete technician" });
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
      const { containerIds, ...clientData } = req.body;
      
      // Create a user first (required for customer)
      const { hashPassword } = await import('./services/auth');
      const defaultPassword = await hashPassword('ChangeMe@123');
      
      const user = await storage.createUser({
        phoneNumber: clientData.phone,
        name: clientData.contactPerson,
        email: clientData.email,
        password: defaultPassword,
        role: "client",
        isActive: true,
        whatsappVerified: false,
        emailVerified: false,
      });
      
      // Create the customer with the user ID
      const customerData = {
        ...clientData,
        userId: user.id,
        status: 'active'
      };
      
      const created = await storage.createCustomer(customerData);
      
      // If containers are specified, assign them to the customer
      if (containerIds && Array.isArray(containerIds) && containerIds.length > 0) {
        const assignmentPromises = containerIds.map(async (containerId: string) => {
          try {
            await storage.assignContainerToCustomer(
              containerId, 
              created.id, 
              new Date(), 
              new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
            );
          } catch (assignError) {
            console.error(`Failed to assign container ${containerId}:`, assignError);
            // Don't fail the entire request if individual container assignment fails
          }
        });
        
        await Promise.all(assignmentPromises);
      }
      
      res.json(created);
    } catch (error) {
      console.error("Client creation error:", error);
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
  app.post("/api/scheduling/run", authenticateUser, requireRole("admin", "coordinator"), async (req, res) => {
    try {
      // Get all pending service requests
      const pendingRequests = await storage.getServiceRequestsByStatus("pending");
      const assignments = [];

      const { schedulerService } = await import('./services/scheduler');
      
      for (const request of pendingRequests) {
        try {
          const assignment = await schedulerService.autoAssignBestTechnician(request.id);
          assignments.push(assignment);
        } catch (error: any) {
          console.error(`Failed to assign request ${request.id}:`, error);
          assignments.push({ assigned: false, requestId: request.id, reason: error.message });
        }
      }

      const successCount = assignments.filter(a => a.assigned).length;
      
      res.json({ 
        success: true, 
        assignments,
        assignedCount: successCount,
        totalRequests: pendingRequests.length
      });
    } catch (error: any) {
      console.error('Auto-assignment error:', error);
      res.status(500).json({ error: "Failed to run auto-assignment", details: error?.message });
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
  app.get("/api/orbcomm/status", async (req, res) => {
    try {
      const { getOrbcommClient } = await import("./services/orbcomm");
      const client = getOrbcommClient();
      res.json({ 
        connected: client.isConnected,
        url: process.env.ORBCOMM_URL || 'wss://wamc.wamcentral.net:44355/cdh',
        subprotocol: 'cdh.orbcomm.com'
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get connection status" });
    }
  });

  // Orbcomm data refresh endpoint
  app.post("/api/orbcomm/refresh", async (req, res) => {
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
  app.post("/api/orbcomm/test", async (req, res) => {
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
  app.post("/api/orbcomm/integ-test", async (req, res) => {
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

  // WhatsApp webhook verification (matches ngrok URL path)
  app.get("/api/whatsapp/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    console.log('📱 WhatsApp webhook verification:', {
      mode,
      hasToken: !!token,
      challenge: challenge ? '[PROVIDED]' : '[NONE]',
      expectedToken: process.env.WHATSAPP_VERIFY_TOKEN ? '[SET]' : '[NOT SET]'
    });

    // Accept both token names for compatibility
    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || process.env.WEBHOOK_VERIFICATION_TOKEN;
    const verified = mode === 'subscribe' && token === expectedToken;

    if (verified) {
      console.log('✅ WhatsApp webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      console.log('❌ WhatsApp webhook verification failed');
      console.log('Expected token:', expectedToken ? 'is set' : 'is not set');
      console.log('Received token:', token ? 'provided' : 'not provided');
      res.status(403).send('Forbidden');
    }
  });

  // WhatsApp webhook for incoming messages (matches ngrok URL path)
  app.post("/api/whatsapp/webhook", async (req, res) => {
    try {
      const { whatsappService } = await import('./services/whatsapp');
      const result = await whatsappService.handleWebhook(req.body);
      res.json({ status: 'ok', result });
    } catch (error) {
      console.error('WhatsApp webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // WhatsApp media proxy: fetch media binary via Graph API and stream
  app.get("/api/whatsapp/media/:ref", async (req, res) => {
    try {
      const ref = decodeURIComponent(req.params.ref || "");
      if (!ref.startsWith("wa:")) return res.status(400).send("Invalid reference");

      const mediaId = ref.slice(3);
      const { default: axios } = await import("axios");
      const { WHATSAPP_TOKEN, GRAPH_VERSION } = await (async () => {
        const mod = await import("./services/whatsapp");
        // Pull token safely from module scope; fallback to env if not exported
        const token = (mod as any).WHATSAPP_TOKEN || process.env.CLOUD_API_ACCESS_TOKEN || "";
        const ver = (mod as any).GRAPH_VERSION || process.env.GRAPH_VERSION || "v20.0";
        return { WHATSAPP_TOKEN: token, GRAPH_VERSION: ver };
      })();

      if (!WHATSAPP_TOKEN) return res.status(500).send("Missing WhatsApp token");

      // Step 1: get media URL
      const metaUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`;
      const metaResp = await axios.get(metaUrl, { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } });
      const directUrl = metaResp.data?.url;
      if (!directUrl) return res.status(404).send("Media URL not found");

      // Step 2: download binary
      const binResp = await axios.get(directUrl, {
        headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
        responseType: "arraybuffer"
      });

      // Infer content type
      const contentType = binResp.headers["content-type"] || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=300");
      res.status(200).send(Buffer.from(binResp.data));
    } catch (error: any) {
      console.error("WhatsApp media proxy error:", error?.response?.data || error?.message);
      res.status(500).send("Media fetch failed");
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

  // Containers for current user's customer
  app.get("/api/customers/me/containers", authenticateUser, async (req: any, res) => {
    try {
      const customer = await storage.getCustomerByUserId(req.user.id);
      if (!customer) return res.json([]);
      const containers = await storage.getContainersByCustomer(customer.id);
      res.json(containers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer containers" });
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

  // Containers for a given customer (RBAC)
  app.get("/api/customers/:id/containers", authenticateUser, async (req: any, res) => {
    try {
      const role = (req.user?.role || '').toLowerCase();

      if (["admin","coordinator","super_admin"].includes(role)) {
        const list = await storage.getContainersByCustomer(req.params.id);
        return res.json(list);
      }

      if (role === 'client') {
        const self = await storage.getCustomerByUserId(req.user.id);
        if (!self) return res.json([]);
        if (self.id !== req.params.id) return res.status(403).json({ error: "Forbidden" });
        const list = await storage.getContainersByCustomer(self.id);
        return res.json(list);
      }

      return res.status(403).json({ error: "Forbidden" });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer containers" });
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

  app.put("/api/customers/:id", authenticateUser, requireRole("admin", "coordinator", "super_admin"), async (req, res) => {
    try {
      const customer = await storage.updateCustomer(req.params.id, req.body);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  // Admin: Toggle client access (enable/disable)
  app.post('/api/admin/customers/:id/toggle-access', authenticateUser, requireRole('admin','super_admin','coordinator'), async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) return res.status(404).json({ error: 'Customer not found' });

      const newStatus = customer.status === 'active' ? 'inactive' : 'active';
      const updated = await storage.updateCustomer(req.params.id, { status: newStatus });

      // Log the action
      const user = await storage.getUser(req.user!.id);
      await storage.createAuditLog({
        userId: user?.id,
        action: `client_access_${newStatus}`,
        entityType: 'customer',
        entityId: req.params.id,
        source: 'admin_dashboard',
      });

      res.json({ message: `Client access ${newStatus === 'active' ? 'enabled' : 'disabled'}`, customer: updated });
    } catch (error) {
      res.status(500).json({ error: 'Failed to toggle client access' });
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

  // Import inventory from external API (admin/coordinator only)
  app.post("/api/inventory/import", authenticateUser, requireRole("admin", "coordinator", "super_admin"), async (req, res) => {
    try {
      const { apiKey, baseUrl, endpointPath } = req.body || {};
      if (!apiKey || !baseUrl) {
        return res.status(400).json({ error: "apiKey and baseUrl are required" });
      }
      const { getInventoryService } = await import('./services/inventory');
      const service = getInventoryService();
      const result = await service.importFromExternal({ apiKey, baseUrl, endpointPath });
      // Return updated list after import
      const items = await service.getAllItems();
      res.json({ success: true, ...result, items });
    } catch (error: any) {
      console.error('Inventory import error:', error);
      // Provide more detailed error information
      const errorMessage = error?.message || "Unknown error occurred";
      const isConnectionError = errorMessage.includes("External API connection failed") ||
                               errorMessage.includes("Server returned HTML page") ||
                               errorMessage.includes("Non-JSON response");

      if (isConnectionError) {
        res.status(400).json({
          error: "External API connection failed",
          details: errorMessage,
          suggestions: [
            "Check if the Base URL is correct",
            "Verify the Endpoint Path matches your API",
            "Ensure the API key is valid",
            "Make sure your external server is running and accessible",
            "Try a different endpoint path (e.g., /products, /api/v1/products)",
            "Check if the external API requires different authentication"
          ]
        });
      } else {
        res.status(500).json({ error: "Failed to import inventory", details: errorMessage });
      }
    }
  });

  // Debug/test external API connection (admin/coordinator only)
  app.post("/api/inventory/debug", authenticateUser, requireRole("admin", "coordinator", "super_admin"), async (req, res) => {
    try {
      const { apiKey, baseUrl, endpointPath } = req.body || {};
      if (!apiKey || !baseUrl) {
        return res.status(400).json({ error: "apiKey and baseUrl are required" });
      }

      const base = baseUrl.replace(/\/$/, '');
      const path = (endpointPath || '/api/products').replace(/^\//, '');
      const fullUrl = /^(http|https):\/\//i.test(path) ? path : `${base}/${path}`;

      let debugInfo = `Testing connection to: ${fullUrl}\n`;

      // Try header-based auth first
      try {
        const axRes = await axios.get(fullUrl, {
          headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' },
          timeout: 10000,
          validateStatus: () => true,
        });

        debugInfo += `Header auth: status=${axRes.status}, content-type=${String(axRes.headers['content-type'] || '')}\n`;

        if (String(axRes.data).trim().startsWith('<')) {
          debugInfo += `Response starts with HTML: ${String(axRes.data).substring(0, 200)}...\n`;
          return res.json({
            success: false,
            error: "Server returned HTML instead of JSON",
            debugInfo,
            htmlResponse: String(axRes.data).substring(0, 500) + (String(axRes.data).length > 500 ? '...' : ''),
            suggestions: [
              "Check if the endpoint path is correct - try /api/products, /products, /api/v1/products",
              "Verify your API key is valid and has permission to access this endpoint",
              "Make sure the external server is running and the API is accessible",
              "Check if the external server requires a different authentication method",
              "Try the full URL in your browser to see what page loads",
              "Check firewall/network settings if the server is on a different network",
              "Verify the external API returns JSON, not HTML"
            ]
          });
        }

        if (axRes.headers['content-type']?.includes('application/json')) {
          debugInfo += `✓ Server accepts header auth and returns JSON\n`;
          const sampleData = Array.isArray(axRes.data) ? axRes.data.slice(0, 3) : axRes.data;
          return res.json({
            success: true,
            message: "Connection successful",
            debugInfo,
            sampleData,
            totalItems: Array.isArray(axRes.data) ? axRes.data.length : 'unknown'
          });
        }
      } catch (headerErr) {
        const msg = (headerErr as any)?.message || String(headerErr);
        debugInfo += `Header auth failed: ${msg}\n`;
      }

      // Try query param auth
      const urlWithQuery = `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(apiKey)}`;
      debugInfo += `Trying query param auth: ${urlWithQuery}\n`;

      try {
        const axRes2 = await axios.get(urlWithQuery, {
          headers: { 'Accept': 'application/json' },
          timeout: 10000,
          validateStatus: () => true,
        });

        debugInfo += `Query auth: status=${axRes2.status}, content-type=${String(axRes2.headers['content-type'] || '')}\n`;

        if (String(axRes2.data).trim().startsWith('<')) {
          debugInfo += `Response starts with HTML: ${String(axRes2.data).substring(0, 200)}...\n`;
          return res.json({
            success: false,
            error: "Server returned HTML instead of JSON",
            debugInfo,
            htmlResponse: String(axRes2.data).substring(0, 500) + (String(axRes2.data).length > 500 ? '...' : ''),
            suggestions: [
              "Check if the endpoint path is correct - try /api/products, /products, /api/v1/products",
              "Verify your API key is valid and has permission to access this endpoint",
              "Make sure the external server is running and the API is accessible",
              "Check if the external server requires a different authentication method",
              "Try the full URL in your browser to see what page loads",
              "Check firewall/network settings if the server is on a different network",
              "Verify the external API returns JSON, not HTML"
            ]
          });
        }

        if (axRes2.headers['content-type']?.includes('application/json')) {
          debugInfo += `✓ Server accepts query param auth and returns JSON\n`;
          const sampleData = Array.isArray(axRes2.data) ? axRes2.data.slice(0, 3) : axRes2.data;
          return res.json({
            success: true,
            message: "Connection successful",
            debugInfo,
            sampleData,
            totalItems: Array.isArray(axRes2.data) ? axRes2.data.length : 'unknown'
          });
        }
      } catch (queryErr) {
        const msg = (queryErr as any)?.message || String(queryErr);
        debugInfo += `Query auth also failed: ${msg}\n`;
      }

      return res.json({
        success: false,
        error: "Could not connect to external API",
        debugInfo,
        suggestions: [
          "Check if the Base URL is correct",
          "Verify the API key is valid",
          "Make sure the external server is running and accessible",
          "Try a different endpoint path",
          "Check firewall/network settings"
        ]
      });

    } catch (error: any) {
      console.error('Inventory debug error:', error);
      res.status(500).json({ error: "Debug failed", details: error?.message });
    }
  });

  // Simple proxy for testing external APIs (admin/coordinator only)
  app.get("/api/test-external", authenticateUser, requireRole("admin", "coordinator", "super_admin"), async (req, res) => {
    try {
      const { url, apiKey } = req.query || {};
      if (!url || !apiKey) {
        return res.status(400).json({ error: "url and apiKey query parameters are required" });
      }

      const response = await axios.get(String(url), {
        headers: { 'X-API-Key': String(apiKey), 'Accept': 'application/json' },
        timeout: 10000,
        validateStatus: () => true,
      });

      res.json({
        status: response.status,
        contentType: response.headers['content-type'],
        data: response.data,
        headers: response.headers,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to test external API", details: error?.message });
    }
  });

  // Alert automation endpoint - trigger the full workflow
  app.post("/api/alerts/process", authenticateUser, async (req, res) => {
    try {
      const { alertService } = await import('./services/alerts');
      const result = await alertService.processNewAlert(req.body);
      res.json(result);
    } catch (error: any) {
      console.error('Alert processing error:', error);
      res.status(500).json({ error: "Failed to process alert", details: error?.message });
    }
  });

  // Send daily schedule to technician
  app.post("/api/scheduling/notify-technician", authenticateUser, requireRole("admin", "coordinator"), async (req, res) => {
    try {
      const { technicianId, date } = req.body;
      
      if (!technicianId) {
        return res.status(400).json({ error: "technicianId is required" });
      }

      const scheduleDate = date ? new Date(date) : new Date();
      const { schedulerService } = await import('./services/scheduler');
      await schedulerService.sendDailyScheduleToTechnician(technicianId, scheduleDate);
      
      res.json({ success: true, message: "Schedule sent to technician" });
    } catch (error: any) {
      console.error('Schedule notification error:', error);
      res.status(500).json({ error: "Failed to send schedule", details: error?.message });
    }
  });

  // Send daily schedules to all technicians
  app.post("/api/scheduling/notify-all", authenticateUser, requireRole("admin", "coordinator"), async (req, res) => {
    try {
      const { date } = req.body;
      const scheduleDate = date ? new Date(date) : new Date();
      
      const { schedulerService } = await import('./services/scheduler');
      await schedulerService.sendDailySchedulesToAllTechnicians(scheduleDate);
      
      res.json({ success: true, message: "Schedules sent to all technicians" });
    } catch (error: any) {
      console.error('Bulk schedule notification error:', error);
      res.status(500).json({ error: "Failed to send schedules", details: error?.message });
    }
  });

  // Manual trigger for testing automation
  app.post("/api/alerts/simulate", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const { containerId, alertType = "temperature", severity = "critical" } = req.body;
      
      if (!containerId) {
        return res.status(400).json({ error: "containerId is required" });
      }

      const container = await storage.getContainer(containerId);
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }

      const simulatedAlert = {
        containerId,
        alertCode: `SIM_${Date.now()}`,
        alertType: alertType,
        severity,
        source: "simulation",
        title: `Simulated ${alertType} alert`,
        description: `Test ${alertType} issue detected on container ${container.containerCode}`,
        detectedAt: new Date(),
        status: "open", // Add status field to match working examples
      };

      const { alertService } = await import('./services/alerts');
      const result = await alertService.processNewAlert(simulatedAlert);
      
      res.json({ 
        success: true, 
        message: "Alert simulation completed",
        ...result 
      });
    } catch (error: any) {
      console.error('Alert simulation error:', error);
      res.status(500).json({ error: "Failed to simulate alert", details: error?.message });
    }
  });

  // WhatsApp webhook for receiving messages
  app.post("/api/whatsapp/webhook", async (req, res) => {
    try {
      const { whatsappService } = await import('./services/whatsapp');
      const result = await whatsappService.handleWebhook(req.body);
      res.json({ status: 'ok', result });
    } catch (error) {
      console.error('WhatsApp webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // WhatsApp template management routes
  app.post("/api/whatsapp/templates/register-all", async (req, res) => {
    try {
      const { registerAllTemplates, WHATSAPP_TEMPLATES } = await import('./services/whatsapp');
      const results = await registerAllTemplates();
      res.json({ message: "Template registration completed", results, templates: WHATSAPP_TEMPLATES });
    } catch (error) {
      res.status(500).json({ error: "Template registration failed" });
    }
  });

  app.get("/api/whatsapp/templates", async (req, res) => {
    try {
      const mod = await import('./services/whatsapp');
      const templates = await mod.getWhatsAppTemplates();
      const localTemplates = (mod as any).WHATSAPP_TEMPLATES || {};
      res.json({ templates, localTemplates });
    } catch (error) {
      console.error("Templates fetch error:", error);
      // Return local templates as fallback
      try {
        const mod = await import('./services/whatsapp');
        const localTemplates = (mod as any).WHATSAPP_TEMPLATES || {};
        res.json({ templates: [], localTemplates });
      } catch {
        res.json({ templates: [], localTemplates: {} });
      }
    }
  });

  app.post("/api/whatsapp/templates/register", async (req, res) => {
    try {
      const { registerWhatsAppTemplate } = await import('./services/whatsapp');
      const result = await registerWhatsAppTemplate(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Template registration failed" });
    }
  });

  app.put("/api/whatsapp/templates/:name", async (req, res) => {
    try {
      const { updateWhatsAppTemplate } = await import('./services/whatsapp');
      const result = await updateWhatsAppTemplate(req.params.name, req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Template update failed" });
    }
  });

  app.delete("/api/whatsapp/templates/:name", async (req, res) => {
    try {
      const { deleteWhatsAppTemplate } = await import('./services/whatsapp');
      const result = await deleteWhatsAppTemplate(req.params.name);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Template deletion failed" });
    }
  });

  // ORBCOMM data endpoints
  app.get('/api/orbcomm/devices', async (req, res) => {
    try {
      // For now, return mock data to test the UI
      const mockDevices = [
        {
          deviceId: 'QUAD622180045',
          assetId: 'QUAD622180045',
          lastUpdate: new Date().toISOString(),
          location: { lat: 28.6139, lng: 77.2090 },
          temperature: 22.5,
          doorStatus: 'closed',
          powerStatus: 'on',
          batteryLevel: 85,
          errorCodes: [],
          rawData: { mock: true, timestamp: new Date().toISOString() }
        },
        {
          deviceId: 'QUAD622340186',
          assetId: 'QUAD622340186',
          lastUpdate: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
          location: { lat: 28.6145, lng: 77.2095 },
          temperature: 18.2,
          doorStatus: 'open',
          powerStatus: 'on',
          batteryLevel: 92,
          errorCodes: ['DOOR_OPEN'],
          rawData: { mock: true, timestamp: new Date(Date.now() - 300000).toISOString() }
        }
      ];
      
      console.log('📱 Returning mock ORBCOMM devices:', mockDevices.length);
      res.json(mockDevices);
      
      // TODO: Uncomment when ORBCOMM client is working
      // const { getOrbcommClient } = await import('./services/orbcomm-real');
      // const orbcommClient = getOrbcommClient();
      // const devices = await orbcommClient.getAllDevices();
      // res.json(devices);
    } catch (error) {
      console.error('ORBCOMM devices error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch ORBCOMM devices',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/orbcomm/devices/:deviceId', async (req, res) => {
    try {
      const { deviceId } = req.params;
      
      // Mock device data for testing
      const mockDeviceData = {
        deviceId,
        assetId: deviceId,
        lastUpdate: new Date().toISOString(),
        location: { lat: 28.6139 + Math.random() * 0.01, lng: 77.2090 + Math.random() * 0.01 },
        temperature: 20 + Math.random() * 10,
        doorStatus: Math.random() > 0.5 ? 'open' : 'closed',
        powerStatus: 'on',
        batteryLevel: 80 + Math.random() * 20,
        errorCodes: Math.random() > 0.7 ? ['DOOR_OPEN', 'TEMP_HIGH'] : [],
        rawData: {
          mock: true,
          timestamp: new Date().toISOString(),
          deviceId,
          additionalData: {
            signalStrength: 85,
            lastHeartbeat: new Date().toISOString(),
            firmwareVersion: '1.2.3'
          }
        }
      };
      
      console.log('📱 Returning mock device data for:', deviceId);
      res.json(mockDeviceData);
      
      // TODO: Uncomment when ORBCOMM client is working
      // const { getOrbcommClient } = await import('./services/orbcomm-real');
      // const orbcommClient = getOrbcommClient();
      // const deviceData = await orbcommClient.getDeviceData(deviceId);
      // if (!deviceData) {
      //   return res.status(404).json({ error: 'Device not found' });
      // }
      // res.json(deviceData);
    } catch (error) {
      console.error('ORBCOMM device data error:', error);
      res.status(500).json({ error: 'Failed to fetch device data' });
    }
  });

  // Admin: Verify client for WhatsApp access
  app.post('/api/admin/whatsapp/verify-client', authenticateUser, requireRole('admin','super_admin','coordinator'), async (req, res) => {
    try {
      const { phoneNumber, name, email, role } = req.body || {};
      if (!phoneNumber || !name || !email) return res.status(400).json({ error: 'phoneNumber, name, email required' });

      const clean = String(phoneNumber).replace(/\D/g, '');
      let user = await storage.getUserByPhoneNumber(clean);

      const { hashPassword } = await import('./services/auth');
      const defaultPassword = await hashPassword('ChangeMe@123');

      if (!user) {
        user = await storage.createUser({
          phoneNumber: clean,
          name,
          email,
          role: (role || 'client') as any,
          password: defaultPassword,
          isActive: true,
          whatsappVerified: true,
          emailVerified: false,
        } as any);
      } else {
        user = await storage.updateUser(user.id, {
          name,
          email,
          role: (role || user.role) as any,
          isActive: true,
          whatsappVerified: true,
        } as any);
      }

      // Ensure a customer record exists
      const existingCustomer = await storage.getCustomerByUserId(user.id);
      if (!existingCustomer) {
        await storage.createCustomer({
          userId: user.id,
          companyName: name,
          contactPerson: name,
          email,
          phone: clean,
          whatsappNumber: clean,
          billingAddress: 'N/A',
          status: 'active',
        } as any);
      }

      res.json({ message: 'Client verified for WhatsApp', user });
    } catch (error) {
      res.status(500).json({ error: 'Failed to verify client' });
    }
  });

  // Admin: Revoke WhatsApp access
  app.post('/api/admin/whatsapp/revoke-client', authenticateUser, requireRole('admin','super_admin','coordinator'), async (req, res) => {
    try {
      const { phoneNumber } = req.body || {};
      if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber required' });
      const clean = String(phoneNumber).replace(/\D/g, '');
      const user = await storage.getUserByPhoneNumber(clean);
      if (!user) return res.status(404).json({ error: 'User not found' });
      const updated = await storage.updateUser(user.id, { whatsappVerified: false } as any);
      res.json({ message: 'WhatsApp access revoked', user: updated });
    } catch (error) {
      res.status(500).json({ error: 'Failed to revoke client' });
    }
  });

  // Admin: List users (filter by verified)
  app.get('/api/admin/whatsapp/users', authenticateUser, requireRole('admin','super_admin','coordinator'), async (req, res) => {
    try {
      const { verified } = req.query as any;
      const { db } = await import('./db');
      const { users } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      let rows: any[] = [];
      if (verified === 'true') {
        rows = await db.select().from(users).where(eq(users.whatsappVerified, true));
      } else if (verified === 'false') {
        rows = await db.select().from(users).where(eq(users.whatsappVerified, false));
      } else {
        rows = await db.select().from(users);
      }
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: 'Failed to list users' });
    }
  });

  // Admin: send text/template (any number)
  app.post('/api/admin/whatsapp/send-text', authenticateUser, requireRole('admin','super_admin','coordinator'), async (req, res) => {
    try {
      const { to, text } = req.body || {};
      if (!to || !text) return res.status(400).json({ error: 'to and text required' });
      const result = await sendTextMessage(String(to).replace(/\D/g, ''), text);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to send text' });
    }
  });

  app.post('/api/admin/whatsapp/send-template', authenticateUser, requireRole('admin','super_admin','coordinator'), async (req, res) => {
    try {
      const { to, templateName, parameters, languageCode } = req.body || {};
      if (!to || !templateName) return res.status(400).json({ error: 'to and templateName required' });
      const result = await sendTemplateMessage(String(to).replace(/\D/g, ''), templateName, languageCode || 'en', parameters || []);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to send template' });
    }
  });


  return httpServer;
}
