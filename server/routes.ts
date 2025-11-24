import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import axios from "axios";
import * as fs from "fs";
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
import { RagAdapter } from "./services/ragAdapter";
import { runDiagnosis } from "./services/ragGraph";
import { DocumentProcessor } from "./services/documentProcessor";
import { vectorStore } from "./services/vectorStore";
import multer from 'multer';

// Initialize RAG services
const ragAdapter = new RagAdapter();
const documentProcessor = new DocumentProcessor();
import { simpleSeed } from "./simple-seed";

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow PDF, Word documents, and text files (for testing)
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and Word documents are allowed.'));
    }
  },
  storage: multer.memoryStorage() // Store in memory for processing
});

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // RAG API Endpoints
  app.post("/api/rag/query", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const { query, unit_id, unit_model, alarm_code, context } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }
      
      const response = await ragAdapter.query({
        user_id: req.user?.id,
        unit_id,
        unit_model,
        alarm_code,
        query,
        context
      });
      
      res.json(response);
    } catch (error) {
      console.error("RAG query error:", error);
      res.status(500).json({ error: "Failed to process RAG query" });
    }
  });

  app.get("/api/rag/history", authenticateUser, requireRole("admin", "technician"), async (req: AuthRequest, res) => {
    try {
      const userId = req.query.user_id as string || req.user?.id;
      const limit = parseInt(req.query.limit as string || "20");
      
      const history = await storage.getRagQueryHistory(userId, limit);
      res.json(history);
    } catch (error) {
      console.error("RAG history error:", error);
      res.status(500).json({ error: "Failed to retrieve RAG query history" });
    }
  });

  // RAG diagnosis endpoint (manual-grounded)
  app.post("/api/rag/diagnose", authenticateUser, async (req: any, res) => {
    try {
      const { containerId, alarmCode, unitModel, query } = req.body || {};
      const out = await runDiagnosis({ containerId, alarmCode, unitModel, query });
      res.json(out);
    } catch (e: any) {
      console.error('[RAG] diagnose failed:', e?.message || e);
      res.status(500).json({ error: 'Diagnosis failed' });
    }
  });

  app.post("/api/rag/upload", authenticateUser, requireRole("admin"), upload.single('file'), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { title, description, brand, model } = req.body;
      
      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }
      
      // Save file to disk
      const fileName = `${Date.now()}-${req.file.originalname}`;
      const filePath = `uploads/manuals/${fileName}`;
      
      fs.mkdirSync('uploads/manuals', { recursive: true });
      fs.writeFileSync(filePath, req.file.buffer);
      
      // Create manual record
      const manualId = await storage.createManual({
        title,
        description: description || '',
        fileName,
        filePath,
        uploadedBy: req.user?.id || '',
        brand: brand || '',
        model: model || '',
      });
      
      // Process document and create embeddings
      const result = await documentProcessor.processPDFFile(filePath, manualId);
      
      res.json({
        success: true,
        manual_id: manualId,
        processing_result: result
      });
    } catch (error) {
      console.error("RAG upload error:", error);
      res.status(500).json({ error: "Failed to process document upload" });
    }
  });

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

      const emailResult = await createAndSendEmailOTP(user);

      const message = emailResult.success
        ? 'Verification code sent to email'
        : `Account created. ${emailResult.error || 'Check server logs for verification code.'}`;

      res.json({
        user,
        token: user.id,
        message,
        emailSent: emailResult.success,
        verificationCode: emailResult.code // Only for development/debugging
      });
    } catch (error) {
      console.error('Registration error:', error.message);
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
      const emailResult = await createAndSendEmailOTP(user);
      const message = emailResult.success
        ? 'OTP sent to email'
        : `Reset code generated. ${emailResult.error || 'Check server logs for reset code.'}`;
      res.json({
        message,
        emailSent: emailResult.success,
        resetCode: emailResult.code // Only for development/debugging
      });
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
      const emailResult = await createAndSendEmailOTP(user);
      const message = emailResult.success
        ? 'Verification code resent'
        : `Code regenerated. ${emailResult.error || 'Check server logs for verification code.'}`;
      res.json({
        message,
        emailSent: emailResult.success,
        verificationCode: emailResult.code // Only for development/debugging
      });
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

  // Get current user endpoint
  app.get("/api/auth/me", authenticateUser, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        isActive: user.isActive
      });
    } catch (error) {
      console.error("Get current user error:", error);
      res.status(500).json({ error: "Failed to get current user" });
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
      console.error("Error fetching containers:", error);
      res.status(500).json({ error: "Failed to fetch containers", details: error instanceof Error ? error.message : String(error) });
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

  app.get("/api/containers/:id/ownership-history", authenticateUser, async (req, res) => {
    try {
      const history = await storage.getContainerOwnershipHistory(req.params.id);
      res.json(history);
    } catch (error) {
      console.error("Failed to fetch ownership history:", error);
      res.status(500).json({ error: "Failed to fetch ownership history" });
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

  // Service Request routes - specific routes first
  app.get("/api/service-requests/pending", authenticateUser, requireRole("admin", "coordinator"), async (req, res) => {
    try {
      const requests = await storage.getPendingServiceRequests();
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending requests" });
    }
  });

  // Single service request with relations for detail view
  app.get("/api/service-requests/:id", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      const request = await storage.getServiceRequest(id);
      if (!request) return res.status(404).json({ error: "Not found" });

      console.log(`[API] Service Request ${id} media check:`, {
        clientUploadedPhotos: request.clientUploadedPhotos,
        clientUploadedVideos: request.clientUploadedVideos,
        beforePhotos: request.beforePhotos,
        afterPhotos: request.afterPhotos
      });

      const [container, customer, technician] = await Promise.all([
        storage.getContainer(request.containerId),
        storage.getCustomer(request.customerId),
        request.assignedTechnicianId ? storage.getTechnician(request.assignedTechnicianId) : Promise.resolve(undefined)
      ]);

      // Get technician user data if technician is assigned
      const technicianUser = technician ? await storage.getUser(technician.userId) : undefined;

      // Parse multiple containers from issue description if present
      let allContainers = [];
      const containerCodes: string[] = [];
      
      // Parse containers from issue description
      if (request.issueDescription) {
        const description = request.issueDescription;
        console.log(`[API] Parsing issue description for containers (full length: ${description.length}):`, description.substring(0, 1000));
        
        // Method 1: Extract from "Multiple Containers:" line (handles both with and without emoji)
        // This line contains ALL containers, so use it as primary source
        let multipleMatch = description.match(/📦\s*Multiple Containers:\s*([^\n]+)/i);
        if (!multipleMatch) {
          multipleMatch = description.match(/Multiple Containers:\s*([^\n]+)/i);
        }
        if (multipleMatch && multipleMatch[1]) {
          const codes = multipleMatch[1].split(',').map((code: string) => code.trim()).filter(Boolean);
          console.log(`[API] Found codes from "Multiple Containers:" line:`, codes);
          // Clear and use these codes as the source of truth
          containerCodes.length = 0;
          codes.forEach(code => {
            if (code && code.length > 0) {
              containerCodes.push(code);
              console.log(`[API] Added container code: ${code}`);
            }
          });
        }
        
        // Method 2: If "Multiple Containers:" not found, try combining Primary + Additional
        if (containerCodes.length === 0) {
          const primaryMatch = description.match(/Primary Container:\s*([^\n]+)/i);
          const additionalMatch = description.match(/Additional Containers:\s*([^\n]+)/i);
          
          if (primaryMatch && primaryMatch[1]) {
            const code = primaryMatch[1].trim();
            if (code && code.length > 0) {
              containerCodes.push(code);
              console.log(`[API] Found code from "Primary Container:" line:`, code);
            }
          }
          
          if (additionalMatch && additionalMatch[1]) {
            const codes = additionalMatch[1].split(',').map((code: string) => code.trim()).filter(Boolean);
            console.log(`[API] Found codes from "Additional Containers:" line:`, codes);
            codes.forEach(code => {
              if (code && code.length > 0 && !containerCodes.includes(code)) {
                containerCodes.push(code);
                console.log(`[API] Added container code from Additional: ${code}`);
              }
            });
          }
        }
        
        // Method 3: Fallback - if still no containers, use primary container from containerId
        if (containerCodes.length === 0 && container && container.containerCode) {
          containerCodes.push(container.containerCode);
          console.log(`[API] Using primary container from containerId: ${container.containerCode}`);
        }
        
        // Method 4: Fallback - try to extract all container codes mentioned (more flexible pattern)
        // Try multiple patterns: [A-Z]{4}\d{7}, [A-Z]{3}\d{7}, [A-Z]{2}\d{7}, etc.
        if (containerCodes.length <= 1) {
          // More flexible pattern: 4-5 uppercase letters followed by 6-8 digits
          const containerCodePatterns = [
            /[A-Z]{4,5}\d{6,8}/g,  // Most common: TRIU6617292, TDRU7152244
            /[A-Z]{3}\d{7,8}/g,     // Alternative: ABC1234567
            /[A-Z]{2}\d{8,9}/g      // Alternative: AB12345678
          ];
          
          for (const pattern of containerCodePatterns) {
            const allMatches = description.match(pattern);
            if (allMatches && allMatches.length > 0) {
              console.log(`[API] Fallback: Found container codes via pattern ${pattern}:`, allMatches);
              allMatches.forEach(code => {
                if (!containerCodes.includes(code)) {
                  containerCodes.push(code);
                }
              });
              break; // Use first pattern that finds matches
            }
          }
        }
        
        // Method 6: Look for container codes anywhere in the description (last resort)
        // This searches for any alphanumeric codes that might be container codes
        if (containerCodes.length <= 1) {
          // Look for patterns like "CODE1, CODE2" or "CODE1 CODE2" after keywords
          const keywordPatterns = [
            /containers?[:\s]+([A-Z0-9,\s]+)/i,
            /container\s+codes?[:\s]+([A-Z0-9,\s]+)/i,
            /selected[:\s]+([A-Z0-9,\s]+)/i
          ];
          
          for (const pattern of keywordPatterns) {
            const match = description.match(pattern);
            if (match && match[1]) {
              const potentialCodes = match[1].split(/[,\s]+/).map((code: string) => code.trim()).filter((code: string) => code.length >= 6);
              potentialCodes.forEach(code => {
                if (code && code.length > 0 && !containerCodes.includes(code)) {
                  containerCodes.push(code);
                }
              });
              if (potentialCodes.length > 0) {
                console.log(`[API] Found potential codes via keyword pattern:`, potentialCodes);
                break;
              }
            }
          }
        }
      }
      
      // Remove duplicates and fetch containers
      const uniqueCodes = [...new Set(containerCodes)];
      console.log(`[API] All unique container codes for SR ${request.id}:`, uniqueCodes);
      
      if (uniqueCodes.length > 0) {
        // Fetch all containers by their codes
        const containers = await storage.getAllContainers();
        console.log(`[API] Total containers in database: ${containers.length}`);
        
        // Try to find each container, but include it even if not found (with limited data)
        allContainers = uniqueCodes.map((code: string) => {
          const found = containers.find((c: any) => 
            c.containerCode === code || 
            c.containerCode?.toUpperCase() === code.toUpperCase() ||
            c.id === code
          );
          if (found) {
            console.log(`[API] Found container for code "${code}": ${found.containerCode} (id: ${found.id})`);
            return {
              id: found.id,
              containerCode: found.containerCode,
              type: found.type,
              status: found.status,
              currentLocation: found.currentLocation,
              iotEnabled: found.iotEnabled || false
            };
          } else {
            console.warn(`[API] Container with code "${code}" not found in database, including with limited data`);
            // Include container even if not found, so user can see it was mentioned
            return {
              id: null,
              containerCode: code,
              type: null,
              status: null,
              currentLocation: null,
              iotEnabled: false
            };
          }
        });
        
        console.log(`[API] Returning ${allContainers.length} containers for service request ${request.id}:`, 
          allContainers.map(c => c.containerCode));
      }

      // Fallback 1: Try to get containers from WhatsApp messages if parsing failed
      if (allContainers.length <= 1) {
        try {
          const whatsappMessages = await storage.getWhatsAppMessagesByServiceRequest(request.id);
          console.log(`[API] Checking ${whatsappMessages.length} WhatsApp messages for container info`);
          
          const foundCodesInMessages: string[] = [...containerCodes];
          
          // Look for container codes in WhatsApp message content
          for (const msg of whatsappMessages) {
            if (msg.content) {
              // Try to extract container codes from message content
              const containerCodePatterns = [
                /[A-Z]{4,5}\d{6,8}/g,
                /[A-Z]{3}\d{7,8}/g,
                /[A-Z]{2}\d{8,9}/g
              ];
              
              for (const pattern of containerCodePatterns) {
                const matches = msg.content.match(pattern);
                if (matches) {
                  matches.forEach(code => {
                    if (!foundCodesInMessages.includes(code)) {
                      foundCodesInMessages.push(code);
                      console.log(`[API] Found container code "${code}" in WhatsApp message`);
                    }
                  });
                }
              }
            }
          }
          
          // Re-fetch containers if we found new codes
          if (foundCodesInMessages.length > containerCodes.length) {
            const updatedUniqueCodes = [...new Set(foundCodesInMessages)];
            console.log(`[API] Re-fetching containers with updated codes:`, updatedUniqueCodes);
            const containers = await storage.getAllContainers();
            
            allContainers = updatedUniqueCodes.map((code: string) => {
              const found = containers.find((c: any) => 
                c.containerCode === code || 
                c.containerCode?.toUpperCase() === code.toUpperCase() ||
                c.id === code
              );
              if (found) {
                return {
                  id: found.id,
                  containerCode: found.containerCode,
                  type: found.type,
                  status: found.status,
                  currentLocation: found.currentLocation,
                  iotEnabled: found.iotEnabled || false
                };
              } else {
                return {
                  id: null,
                  containerCode: code,
                  type: null,
                  status: null,
                  currentLocation: null,
                  iotEnabled: false
                };
              }
            });
            
            console.log(`[API] Updated containers from WhatsApp messages: ${allContainers.length} containers`);
          }
        } catch (error) {
          console.error(`[API] Error checking WhatsApp messages for containers:`, error);
          // Continue with existing containers
        }
      }

      // Fallback 2: If no containers found, use the primary container
      if (allContainers.length === 0 && container) {
        console.log(`[API] No containers parsed, using primary container only`);
        allContainers = [{
          id: container.id,
          containerCode: container.containerCode,
          type: container.type,
          status: container.status,
          currentLocation: container.currentLocation,
          iotEnabled: container.iotEnabled || false
        }];
      }

      const response = {
        ...request,
        container: container ? { id: container.id, containerCode: container.containerCode, currentLocation: container.currentLocation } : undefined,
        allContainers, // Array of all containers involved in this service request
        customer: customer ? { id: customer.id, companyName: customer.companyName } : undefined,
        technician: technician ? {
          id: technician.id,
          employeeCode: technician.employeeCode,
          experienceLevel: technician.experienceLevel,
          skills: technician.skills,
          status: technician.status,
          user: technicianUser ? {
            id: technicianUser.id,
            name: technicianUser.name,
            phoneNumber: technicianUser.phoneNumber,
            email: technicianUser.email
          } : undefined
        } : undefined,
      };

      res.json(response);
    } catch (error) {
      console.error("Fetch service request detail error:", error);
      res.status(500).json({ error: "Failed to fetch service request detail" });
    }
  });

  // Generic service requests route - must come after specific routes
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
      console.error("Error fetching service requests:", error);
      res.status(500).json({ error: "Failed to fetch service requests", details: error instanceof Error ? error.message : String(error) });
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
      // Get previous data to detect status changes
      const previousRequest = await storage.getServiceRequest(req.params.id);
      const request = await storage.updateServiceRequest(req.params.id, req.body);
      broadcast({ type: "service_request_updated", data: request });
      
      // Notify client via WhatsApp if status changed or significant update
      try {
        const { customerCommunicationService } = await import('./services/whatsapp');
        const statusChanged = previousRequest && previousRequest.status !== request.status;
        const updateType = statusChanged ? 'status_changed' : 'updated';
        await customerCommunicationService.notifyServiceRequestUpdate(request.id, updateType, previousRequest);
      } catch (notifError) {
        console.error('Failed to send WhatsApp notification:', notifError);
        // Don't fail the request if notification fails
      }
      
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
      
      // Notify client via WhatsApp
      try {
        const { customerCommunicationService } = await import('./services/whatsapp');
        await customerCommunicationService.notifyServiceRequestUpdate(request.id, 'assigned');
      } catch (notifError) {
        console.error('Failed to send WhatsApp notification:', notifError);
        // Don't fail the request if notification fails
      }
      
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
      
      // Notify client via WhatsApp
      try {
        const { customerCommunicationService } = await import('./services/whatsapp');
        await customerCommunicationService.notifyServiceRequestUpdate(request.id, 'started');
      } catch (notifError) {
        console.error('Failed to send WhatsApp notification:', notifError);
        // Don't fail the request if notification fails
      }
      
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
      
      // Notify client via WhatsApp
      try {
        const { customerCommunicationService } = await import('./services/whatsapp');
        await customerCommunicationService.notifyServiceRequestUpdate(request.id, 'completed');
      } catch (notifError) {
        console.error('Failed to send WhatsApp notification:', notifError);
        // Don't fail the request if notification fails
      }
      
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

  app.post("/api/service-requests/:id/raise-indent", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const { parts } = req.body;
      if (!parts || !Array.isArray(parts) || parts.length === 0) {
        return res.status(400).json({ error: "No parts specified for indent" });
      }

      const serviceRequest = await storage.getServiceRequest(req.params.id);
      if (!serviceRequest) {
        return res.status(404).json({ error: "Service request not found" });
      }

      // Create the indent
      const indent = await storage.createInventoryIndent({
        serviceRequestId: req.params.id,
        requestedBy: req.user.id,
        parts
      });

      broadcast({ type: "indent_created", data: indent });
      res.json(indent);
    } catch (error) {
      console.error("Error raising indent:", error);
      res.status(500).json({ error: "Failed to raise indent" });
    }
  });

  app.post("/api/service-requests/:id/raise-indent-from-parts", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const { parts } = req.body;
      if (!parts || !Array.isArray(parts) || parts.length === 0) {
        return res.status(400).json({ error: "No parts specified for indent" });
      }

      const serviceRequest = await storage.getServiceRequest(req.params.id);
      if (!serviceRequest) {
        return res.status(404).json({ error: "Service request not found" });
      }

      // Look up inventory items by part name
      const matchedParts = [];
      const unmatchedParts = [];

      for (const part of parts) {
        const items = await storage.searchInventoryByName(part.partName);
        if (items && items.length > 0) {
          // Use the first matching item
          matchedParts.push({
            itemId: items[0].id,
            partName: items[0].partName,
            quantity: part.quantity
          });
        } else {
          unmatchedParts.push(part.partName);
        }
      }

      if (matchedParts.length === 0) {
        return res.status(400).json({
          error: "No matching inventory items found",
          unmatchedParts
        });
      }

      // Create the indent with matched parts
      const indent = await storage.createInventoryIndent({
        serviceRequestId: req.params.id,
        requestedBy: req.user.id,
        parts: matchedParts
      });

      broadcast({ type: "indent_created", data: indent });

      const response: any = {
        ...indent,
        itemCount: matchedParts.length
      };

      // Add warning if some parts weren't matched
      if (unmatchedParts.length > 0) {
        response.warning = `${unmatchedParts.length} part(s) not found in inventory`;
        response.unmatchedParts = unmatchedParts;
      }

      res.json(response);
    } catch (error) {
      console.error("Error raising indent from parts:", error);
      res.status(500).json({ error: "Failed to raise indent" });
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

  // Get all WhatsApp messages for a service request
  app.get("/api/service-requests/:id/whatsapp-messages", authenticateUser, async (req, res) => {
    try {
      const messages = await storage.getWhatsAppMessagesByServiceRequest(req.params.id);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching WhatsApp messages for service request:", error);
      res.status(500).json({ error: "Failed to fetch WhatsApp messages" });
    }
  });

  // Technician routes
  app.get("/api/technicians", authenticateUser, async (req, res) => {
    try {
      const technicians = await storage.getAllTechnicians();
      res.json(technicians);
    } catch (error) {
      console.error("Error fetching technicians:", error);
      res.status(500).json({ error: "Failed to fetch technicians" });
    }
  });

  // Get schedules for all technicians for a specific date - MUST come before /:id routes
  app.get("/api/technicians/schedules", authenticateUser, async (req, res) => {
    console.log("Technician schedules route called with query:", req.query);
    try {
      const { date } = req.query;
      const targetDate = date ? new Date(date as string) : new Date();
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const technicians = await storage.getAllTechnicians();
      console.log(`Found ${technicians.length} technicians`);

      const activeStatuses = new Set(["pending", "approved", "scheduled", "in_progress"]);

      const schedules = await Promise.all(
        technicians.map(async (technician: any) => {
          try {
            const requests = await storage.getServiceRequestsByTechnician(technician.id);

            const scheduledJobs = requests
              .filter((req: any) => {
                if (!req.scheduledDate) return false;
                const jobDate = new Date(req.scheduledDate);
                if (isNaN(jobDate.getTime())) return false;
                return jobDate >= startOfDay && jobDate <= endOfDay;
              })
              .sort((a: any, b: any) => {
                const aDate = new Date(a.scheduledDate).getTime();
                const bDate = new Date(b.scheduledDate).getTime();
                return aDate - bDate;
              })
              .map((job: any) => ({ ...job, isPending: false }));

            const pendingAssignments = requests
              .filter((req: any) => {
                const status = (req.status || "").toLowerCase();
                return !req.scheduledDate && activeStatuses.has(status);
              })
              .sort((a: any, b: any) => {
                const aDate = new Date(a.updatedAt || a.createdAt || Date.now()).getTime();
                const bDate = new Date(b.updatedAt || b.createdAt || Date.now()).getTime();
                return bDate - aDate;
              })
              .map((job: any) => ({ ...job, isPending: true }));

            return {
              technician,
              schedule: [...scheduledJobs, ...pendingAssignments]
            };
          } catch (error) {
            console.error(`Error fetching schedule for technician ${technician.id}:`, error);
            return {
              technician,
              schedule: []
            };
          }
        })
      );

      console.log(`Returning ${schedules.length} technician schedules`);
      console.log(`Sample: ${schedules[0]?.technician?.name || schedules[0]?.technician?.employeeCode} has ${schedules[0]?.schedule?.length || 0} jobs (including pending)`);

      res.json({
        date: targetDate.toISOString().split('T')[0],
        schedules
      });
    } catch (error) {
      console.error("Error fetching technician schedules:", error);
      res.status(500).json({ error: "Failed to fetch technician schedules" });
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

  app.get("/api/technicians/:id/service-history", authenticateUser, async (req, res) => {
    try {
      const serviceHistory = await storage.getServiceRequestsByTechnician(req.params.id);
      res.json(serviceHistory);
    } catch (error) {
      console.error("Failed to fetch technician service history:", error);
      res.status(500).json({ error: "Failed to fetch technician service history" });
    }
  });

  // Test route to check if routes are being registered
  app.get("/api/test-schedules", (req, res) => {
    res.json({ message: "Test route works", query: req.query });
  });

  app.get("/api/technicians/skills/:skill", authenticateUser, async (req, res) => {
    try {
      const technicians = await storage.getTechniciansBySkill(req.params.skill);
      res.json(technicians);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch technicians by skill" });
    }
  });

  // Get technician by user ID (for My Profile)
  app.get("/api/technicians/user/:userId", authenticateUser, async (req, res) => {
    try {
      const technician = await storage.getTechnicianByUserId(req.params.userId);
      if (!technician) {
        return res.status(404).json({ error: "Technician not found" });
      }
      res.json(technician);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch technician" });
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

  // Database Analysis Endpoint
  app.get("/api/debug/analyze-db", authenticateUser, async (req, res) => {
    try {
      const { db } = require('./db');

      // Get all tables
      const tablesResult = await db.execute(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);

      const analysis = {
        tables: [],
        issues: {}
      };

      // Analyze each table
      for (const tableRow of tablesResult.rows) {
        const tableName = tableRow.table_name;

        // Get columns
        const columnsResult = await db.execute(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = $1 AND table_schema = 'public'
          ORDER BY ordinal_position
        `, [tableName]);

        // Get row count
        let rowCount = 0;
        try {
          const countResult = await db.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
          rowCount = parseInt(countResult.rows[0].count);
        } catch (e) {
          rowCount = -1;
        }

        analysis.tables.push({
          name: tableName,
          columns: columnsResult.rows,
          rowCount
        });
      }

      // Check technicians table for wage columns
      const techTable = analysis.tables.find(t => t.name === 'technicians');
      if (techTable) {
        const existingColumns = techTable.columns.map(c => c.column_name);
        const requiredColumns = ['grade', 'designation', 'hotel_allowance', 'local_travel_allowance', 'food_allowance', 'personal_allowance'];
        const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

        if (missingColumns.length > 0) {
          console.log('Adding missing wage columns:', missingColumns);

          for (const column of missingColumns) {
            let sql;
            if (['grade', 'designation'].includes(column)) {
              sql = `ALTER TABLE technicians ADD COLUMN IF NOT EXISTS ${column} TEXT`;
            } else {
              sql = `ALTER TABLE technicians ADD COLUMN IF NOT EXISTS ${column} INTEGER DEFAULT 0`;
            }

            await db.execute(sql);
            console.log(`✅ Added column: ${column}`);
          }

          analysis.issues.wageColumns = { status: 'fixed', added: missingColumns };
        } else {
          analysis.issues.wageColumns = { status: 'ok' };
        }
      }

      res.json(analysis);
    } catch (error) {
      console.error('Database analysis failed:', error);
      res.status(500).json({ error: 'Database analysis failed', details: error.message });
    }
  });

  // Wage Breakdown API Endpoints
  app.get("/api/technicians/:id/wage", authenticateUser, async (req, res) => {
    try {
      const technician = await storage.getTechnician(req.params.id);
      if (!technician) {
        return res.status(404).json({ error: "Technician not found" });
      }

      // Calculate total from allowances
      const total = (technician.hotelAllowance || 0) +
                   (technician.localTravelAllowance || 0) +
                   (technician.foodAllowance || 0) +
                   (technician.personalAllowance || 0);

      const wageData = {
        grade: technician.grade,
        designation: technician.designation,
        hotelAllowance: technician.hotelAllowance || 0,
        localTravelAllowance: technician.localTravelAllowance || 0,
        foodAllowance: technician.foodAllowance || 0,
        personalAllowance: technician.personalAllowance || 0,
        total: total
      };

      res.json(wageData);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch wage details" });
    }
  });

  app.put("/api/technicians/:id/wage", authenticateUser, async (req, res) => {
    try {
      console.log("Updating wage for technician:", req.params.id, req.body);
      const { grade, designation, hotelAllowance, localTravelAllowance, foodAllowance, personalAllowance } = req.body;

      // Calculate total
      const total = (hotelAllowance || 0) + (localTravelAllowance || 0) + (foodAllowance || 0) + (personalAllowance || 0);

      console.log("Calculated total:", total);

      // Try to update technician wage details
      try {
        const updatedTechnician = await storage.updateTechnician(req.params.id, {
          grade,
          designation,
          hotelAllowance: hotelAllowance || 0,
          localTravelAllowance: localTravelAllowance || 0,
          foodAllowance: foodAllowance || 0,
          personalAllowance: personalAllowance || 0,
          updatedAt: new Date()
        });

        console.log("Update result:", updatedTechnician ? "success" : "failed");

        if (!updatedTechnician) {
          return res.status(404).json({ error: "Technician not found" });
        }

        // Broadcast update
        broadcast({ type: "technician_wage_updated", data: { technicianId: req.params.id, wageData: { ...req.body, total } } });

        return res.json({
          status: "success",
          total: total,
          message: "Wage details updated successfully"
        });
      } catch (updateError) {
        console.error("Update failed, trying raw SQL:", updateError);

        // Fallback: try raw SQL update
        const db = require('./db').db;
        await db.execute(`
          UPDATE technicians
          SET grade = $1, designation = $2, hotel_allowance = $3, local_travel_allowance = $4,
              food_allowance = $5, personal_allowance = $6, updated_at = NOW()
          WHERE id = $7
        `, [grade, designation, hotelAllowance || 0, localTravelAllowance || 0, foodAllowance || 0, personalAllowance || 0, req.params.id]);

        return res.json({
          status: "success",
          total: total,
          message: "Wage details updated successfully (fallback)"
        });
      }
    } catch (error) {
      console.error("Error updating wage:", error);
      res.status(500).json({ error: "Failed to update wage details", details: error.message });
    }
  });

  app.post("/api/technicians", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      console.log("Received technician creation request:", req.body);
      const technicianData = req.body;
      
      const phoneNumber = technicianData.phone || technicianData.whatsappNumber;
      const email = technicianData.email;
      
      let user;
      let isExistingUser = false;
      
      // Check if user with this phone number already exists
      if (phoneNumber) {
        const existingUserByPhone = await storage.getUserByPhoneNumber(phoneNumber);
        if (existingUserByPhone) {
          // Check if this user already has a technician record
          const existingTechnician = await storage.getTechnicianByUserId(existingUserByPhone.id);
          if (existingTechnician) {
            // Update existing technician record instead of creating a new one
            console.log(`[CREATE TECHNICIAN] User ${existingUserByPhone.id} already has technician record, updating it`);
            const employeeCode = existingTechnician.employeeCode || `TECH-${Date.now().toString().slice(-6)}`;
            const techData = {
              experienceLevel: technicianData.experienceLevel || existingTechnician.experienceLevel,
              skills: technicianData.specialization ? [technicianData.specialization] : (existingTechnician.skills || ['general']),
              baseLocation: technicianData.baseLocation ? { city: technicianData.baseLocation } : existingTechnician.baseLocation,
              serviceAreas: technicianData.baseLocation ? [technicianData.baseLocation] : (existingTechnician.serviceAreas || []),
              status: existingTechnician.status || 'available',
            };
            const updatedTechnician = await storage.updateTechnician(existingTechnician.id, techData);
            
            // Update user info if provided
            const userUpdates: any = { isActive: true };
            if (technicianData.name) userUpdates.name = technicianData.name;
            if (email) userUpdates.email = email;
            await storage.updateUser(existingUserByPhone.id, userUpdates);
            
            broadcast({ type: "technician_updated", data: updatedTechnician });
            return res.json(updatedTechnician);
          }
          
          // User exists but is not a technician - allow them to be both client and technician
          // Update user info but keep their existing role (they can be both)
          console.log(`[CREATE TECHNICIAN] Found existing user ${existingUserByPhone.id}, adding technician role (can be both client and technician)`);
          const userUpdates: any = { isActive: true };
          if (technicianData.name) userUpdates.name = technicianData.name;
          if (email) userUpdates.email = email;
          // Don't change role - user can be both client and technician
          user = await storage.updateUser(existingUserByPhone.id, userUpdates);
          isExistingUser = true;
          console.log("User updated:", user);
        }
      }
      
      // If no user found by phone, check by email
      if (!user && email) {
        const existingUserByEmail = await storage.getUserByEmail(email);
        if (existingUserByEmail) {
          // Check if this user already has a technician record
          const existingTechnician = await storage.getTechnicianByUserId(existingUserByEmail.id);
          if (existingTechnician) {
            // Update existing technician record instead of creating a new one
            console.log(`[CREATE TECHNICIAN] User ${existingUserByEmail.id} already has technician record, updating it`);
            const employeeCode = existingTechnician.employeeCode || `TECH-${Date.now().toString().slice(-6)}`;
            const techData = {
              experienceLevel: technicianData.experienceLevel || existingTechnician.experienceLevel,
              skills: technicianData.specialization ? [technicianData.specialization] : (existingTechnician.skills || ['general']),
              baseLocation: technicianData.baseLocation ? { city: technicianData.baseLocation } : existingTechnician.baseLocation,
              serviceAreas: technicianData.baseLocation ? [technicianData.baseLocation] : (existingTechnician.serviceAreas || []),
              status: existingTechnician.status || 'available',
            };
            const updatedTechnician = await storage.updateTechnician(existingTechnician.id, techData);
            
            // Update user info if provided
            const userUpdates: any = { isActive: true };
            if (technicianData.name) userUpdates.name = technicianData.name;
            if (phoneNumber) userUpdates.phoneNumber = phoneNumber;
            await storage.updateUser(existingUserByEmail.id, userUpdates);
            
            broadcast({ type: "technician_updated", data: updatedTechnician });
            return res.json(updatedTechnician);
          }
          
          // User exists but is not a technician - allow them to be both client and technician
          console.log(`[CREATE TECHNICIAN] Found existing user ${existingUserByEmail.id} by email, adding technician role (can be both client and technician)`);
          const userUpdates: any = { isActive: true };
          if (technicianData.name) userUpdates.name = technicianData.name;
          if (phoneNumber) userUpdates.phoneNumber = phoneNumber;
          // Don't change role - user can be both client and technician
          user = await storage.updateUser(existingUserByEmail.id, userUpdates);
          isExistingUser = true;
          console.log("User updated:", user);
        }
      }
      
      // If no existing user found, create a new one
      if (!user) {
        const { hashPassword } = await import('./services/auth');
        const defaultPassword = await hashPassword('ChangeMe@123');
        
        console.log("Creating new user for technician...");
        // Set role to technician, but user can also be a client if needed
        user = await storage.createUser({
          phoneNumber: phoneNumber,
          name: technicianData.name,
          email: email,
          password: defaultPassword,
          role: "technician", // Default to technician, but can be changed later
          isActive: true,
          whatsappVerified: false,
          emailVerified: false,
        });
        console.log("User created:", user);
      }
      
      // Generate employee code
      const employeeCode = `TECH-${Date.now().toString().slice(-6)}`;
      
      // Create the technician with the user ID
      // Note: User can have both customer and technician records
      const techData = {
        userId: user.id,
        employeeCode: employeeCode, // Use camelCase as defined in schema
        experienceLevel: technicianData.experienceLevel || 'intermediate',
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
      console.log(`[CREATE TECHNICIAN] ✅ Technician created for user ${user.id}. User can be both client and technician.`);
      
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
      const technicianId = req.params.id;
      console.log(`[DELETE TECHNICIAN] Attempting to delete technician: ${technicianId}`);
      
      const existing = await storage.getTechnician(technicianId);
      if (!existing) {
        console.log(`[DELETE TECHNICIAN] Technician not found: ${technicianId}`);
        return res.status(404).json({ error: "Technician not found" });
      }
      
      if (!existing.userId) {
        console.log(`[DELETE TECHNICIAN] Technician has no userId: ${technicianId}`);
        return res.status(400).json({ 
          error: "Cannot delete technician", 
          details: "Technician record is missing user association. Please contact support." 
        });
      }
      
      console.log(`[DELETE TECHNICIAN] Found technician: ${technicianId}, userId: ${existing.userId}`);
      
      // Check for active service requests assigned to this technician
      try {
        const { db } = await import('./db');
        const { serviceRequests } = await import('@shared/schema');
        const { eq, and, ne, or, isNull } = await import('drizzle-orm');
        
        // Get all service requests for this technician
        const allServiceRequests = await db
          .select()
          .from(serviceRequests)
          .where(eq(serviceRequests.assignedTechnicianId, technicianId));
        
        // Filter out completed and cancelled statuses
        const trulyActive = allServiceRequests.filter(
          sr => sr.status && sr.status !== 'completed' && sr.status !== 'cancelled'
        );
        
        if (trulyActive.length > 0) {
          console.log(`[DELETE TECHNICIAN] Cannot delete: ${trulyActive.length} active service requests found`);
          const requestNumbers = trulyActive.map(sr => sr.requestNumber).slice(0, 5).join(', ');
          const moreText = trulyActive.length > 5 ? ` and ${trulyActive.length - 5} more` : '';
          return res.status(400).json({ 
            error: "Cannot delete technician", 
            details: `This technician has ${trulyActive.length} active service request(s) (${requestNumbers}${moreText}). Please reassign or complete them first.` 
          });
        }
      } catch (queryError: any) {
        console.error(`[DELETE TECHNICIAN] Error checking service requests:`, queryError);
        // Don't block deletion if query fails - log and continue
        console.warn(`[DELETE TECHNICIAN] Continuing with deletion despite query error`);
      }
      
      // Soft delete: mark user inactive and remove technician row
      try {
        console.log(`[DELETE TECHNICIAN] Marking user inactive: ${existing.userId}`);
        await storage.updateUser(existing.userId, { isActive: false } as any);
      } catch (userError: any) {
        console.error(`[DELETE TECHNICIAN] Error updating user:`, userError);
        // Continue with technician deletion even if user update fails
        console.warn(`[DELETE TECHNICIAN] Continuing with technician deletion despite user update error`);
      }
      
      console.log(`[DELETE TECHNICIAN] Deleting technician record: ${technicianId}`);
      const { db } = await import('./db');
      const { technicians } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      await db.delete(technicians).where(eq(technicians.id, technicianId));
      
      broadcast({ type: "technician_deleted", data: { id: technicianId } });
      console.log(`[DELETE TECHNICIAN] Successfully deleted technician: ${technicianId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error(`[DELETE TECHNICIAN] Error deleting technician ${req.params.id}:`, error);
      console.error(`[DELETE TECHNICIAN] Error details:`, {
        message: error?.message,
        code: error?.code,
        detail: error?.detail,
        constraint: error?.constraint,
        stack: error?.stack
      });
      
      // Provide more specific error messages
      let errorMessage = error?.message || String(error);
      if (error?.code === '23503') {
        errorMessage = "Cannot delete technician: There are related records that depend on this technician. Please remove or reassign them first.";
      } else if (error?.constraint) {
        errorMessage = `Database constraint violation: ${error.constraint}`;
      }
      
      res.status(500).json({ 
        error: "Failed to delete technician", 
        details: errorMessage 
      });
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
        whatsappVerified: true, // Enable WhatsApp by default for new clients
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
      console.log(`[DELETE CLIENT] Attempting to delete client: ${req.params.id}`);
      // @ts-ignore add method exists in storage
      const deleted = await storage.deleteCustomer(req.params.id);
      console.log(`[DELETE CLIENT] Successfully deleted client: ${req.params.id}`);
      res.json(deleted);
    } catch (error) {
      console.error(`[DELETE CLIENT] Error deleting client ${req.params.id}:`, error);
      res.status(500).json({ error: "Failed to delete client", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Enable/Disable WhatsApp for a client
  app.patch("/api/clients/:id/whatsapp", authenticateUser, requireRole("admin", "coordinator"), async (req, res) => {
    try {
      const { enabled } = req.body;
      const customer = await storage.getCustomer(req.params.id);
      
      if (!customer) {
        return res.status(404).json({ error: "Client not found" });
      }

      if (!customer.userId) {
        return res.status(400).json({ error: "Client has no associated user account" });
      }

      // Update user's whatsappVerified status
      await storage.updateUser(customer.userId, {
        whatsappVerified: enabled === true
      });

      res.json({ success: true, whatsappEnabled: enabled });
    } catch (error) {
      console.error("WhatsApp toggle error:", error);
      res.status(500).json({ error: "Failed to update WhatsApp status" });
    }
  });


  // Inventory routes
  app.get("/api/inventory", authenticateUser, async (req, res, next) => {
    try {
      // This would need a getAllInventory method in storage
      return next();
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
      
      // Handle both "wa:mediaId" format and plain "mediaId" format for backward compatibility
      let mediaId: string;
      if (ref.startsWith("wa:")) {
        mediaId = ref.slice(3);
      } else {
        // Assume it's a plain media ID (for backward compatibility with existing records)
        mediaId = ref;
      }
      
      if (!mediaId) return res.status(400).send("Invalid reference");
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

  // ORBCOMM status endpoint for debugging
  app.get('/api/orbcomm/status', async (req, res) => {
    try {
      const { getOrbcommClient } = await import('./services/orbcomm-real');
      const orbcommClient = getOrbcommClient();
      
      console.log('📱 Status endpoint - calling getAllDevices...');
      const devices = await orbcommClient.getAllDevices();
      console.log('📱 Status endpoint - devices count:', devices.length);
      console.log('📱 Status endpoint - devices:', devices);
      res.json({
        connected: orbcommClient.isConnected,
        devicesCount: devices.length,
        lastUpdate: new Date().toISOString()
      });
    } catch (error) {
      console.error('ORBCOMM status error:', error);
      res.status(500).json({ 
        error: 'Failed to get ORBCOMM status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ORBCOMM manual trigger endpoint
  app.post('/api/orbcomm/trigger', async (req, res) => {
    try {
      const { getOrbcommClient } = await import('./services/orbcomm-real');
      const orbcommClient = getOrbcommClient();
      
      console.log('📱 Manual trigger - sending GetEvents request...');
      orbcommClient.sendPeriodicRequest();
      
      // Wait for response
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const devices = await orbcommClient.getAllDevices();
      res.json({
        success: true,
        devicesCount: devices.length,
        message: 'Manual trigger completed'
      });
    } catch (error) {
      console.error('ORBCOMM trigger error:', error);
      res.status(500).json({
        error: 'Failed to trigger ORBCOMM request',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ORBCOMM Real Data Status - Only shows real ORBCOMM data, no simulation
  app.get('/api/orbcomm/real-status', authenticateUser, async (req, res) => {
    try {
      const { getOrbcommClient } = await import('./services/orbcomm-real');
      const client = getOrbcommClient();

      // Check if client exists and is connected
      const isConnected = client && (client as any).isConnected;
      const connectionInfo = {
        connected: isConnected,
        url: process.env.ORBCOMM_URL || 'wss://integ.tms-orbcomm.com:44355/cdh',
        username: process.env.ORBCOMM_USERNAME ? '***configured***' : 'not set',
        lastActivity: isConnected ? new Date().toISOString() : null,
        dataSource: 'REAL_ORBCOMM_ONLY'
      };

      // Get real alert stats
      const allAlerts = await storage.getAllAlerts();
      const realOrbcommAlerts = allAlerts.filter(a => a.source === 'orbcomm');

      res.json({
        success: true,
        status: 'Real ORBCOMM data only - no simulation or fake data',
        connection: connectionInfo,
        alerts: {
          total: realOrbcommAlerts.length,
          last24h: realOrbcommAlerts.filter(a => {
            const alertTime = new Date(a.detectedAt);
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            return alertTime > oneDayAgo;
          }).length
        },
        message: 'System configured for real ORBCOMM data only. All alerts and telemetry come from live ORBCOMM WebSocket events. No simulation data is processed.'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // ORBCOMM data endpoints
  app.get('/api/orbcomm/devices', async (req, res) => {
    try {
      console.log('📱 ORBCOMM devices endpoint called');
      const { getOrbcommClient } = await import('./services/orbcomm-real');
      const orbcommClient = getOrbcommClient();
      
      console.log('🔍 ORBCOMM client connected:', orbcommClient.isConnected);
      console.log('📱 Calling getAllDevices...');
      
      const devices = await orbcommClient.getAllDevices();
      console.log('📱 Retrieved real ORBCOMM devices:', devices.length);
      console.log('📱 Devices:', JSON.stringify(devices, null, 2));
      
      res.json(devices);
    } catch (error) {
      console.error('❌ ORBCOMM devices error:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
      res.status(500).json({ 
        error: 'Failed to fetch ORBCOMM devices',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });

  app.get('/api/orbcomm/devices/:deviceId', async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { getOrbcommClient } = await import('./services/orbcomm-real');
      const orbcommClient = getOrbcommClient();
      console.log('📱 Fetching real device data for:', deviceId);
      const deviceData = await orbcommClient.getDeviceData(deviceId);
      
      if (!deviceData) {
        return res.status(404).json({ error: 'Device not found' });
      }

      res.json(deviceData);
    } catch (error) {
      console.error('ORBCOMM device data error:', error);
      res.status(500).json({ error: 'Failed to fetch device data' });
    }
  });
  // Live ORBCOMM data with container matching - Reefer Units and Device Status tables
  app.get('/api/orbcomm/live-data', authenticateUser, async (req, res) => {
    try {
      console.log('🚀 Fetching live ORBCOMM data with container matching');

      const { getOrbcommClient } = await import('./services/orbcomm-real');
      const orbcommClient = getOrbcommClient();

      if (!orbcommClient.isConnected) {
        return res.status(503).json({
          error: 'ORBCOMM service not connected',
          message: 'Live data feed is currently unavailable'
        });
      }

      // Get all ORBCOMM devices
      const orbcommDevices = await orbcommClient.getAllDevices();
      console.log(`📡 Retrieved ${orbcommDevices.length} ORBCOMM devices`);

      // Get all containers from database
      const allContainers = await storage.getAllContainers();
      console.log(`📦 Retrieved ${allContainers.length} containers from database`);

      const reeferUnits = [];
      const deviceStatus = [];

      // Process each ORBCOMM device and match with containers
      for (const orbcommDevice of orbcommDevices) {
        const deviceData = await orbcommClient.getDeviceData(orbcommDevice.deviceId);

        if (!deviceData) {
          console.log(`⚠️ No data available for device ${orbcommDevice.deviceId}`);
          continue;
        }

        // Find matching container by Reefer ID (AssetID)
        const matchingContainer = allContainers.find(container =>
          container.containerCode === deviceData.lastAssetId ||
          container.containerCode === orbcommDevice.deviceId
        );

        if (!matchingContainer) {
          console.log(`⚠️ No matching container found for Reefer ID: ${deviceData.lastAssetId || orbcommDevice.deviceId}`);
          continue;
        }

        console.log(`✅ Matched Reefer ID ${deviceData.lastAssetId || orbcommDevice.deviceId} to Container ${matchingContainer.containerCode}`);

        // Extract status indicators
        const temperature = deviceData.temperature;
        const powerStatus = deviceData.powerStatus;
        const batteryLevel = deviceData.batteryLevel;
        const errorCodes = deviceData.errorCodes || [];

        // Determine state indicators
        const cc = orbcommDevice.status === 'active' ? '🟢' : '🔴'; // Communication status
        const alm = errorCodes.length > 0 ? '🔔' : '✅'; // Alarm status
        const run = powerStatus === 'on' ? '▶️' : '⏸️'; // Running status
        const pwr = powerStatus === 'on' ? '🔌' : '🔋'; // Power status

        // Extract OEM from device data or use default
        const oem = deviceData.oem || deviceData.OEM || 'ORBCOMM';

        // Format event time to IST
        const eventTime = deviceData.timestamp ?
          new Date(deviceData.timestamp).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }) : 'N/A';

        // Extract location
        const city = deviceData.location ?
          `${deviceData.location.latitude.toFixed(4)}, ${deviceData.location.longitude.toFixed(4)}` :
          'Unknown';

        // Reefer Units Information Table Data
        reeferUnits.push({
          stateIndicators: `${cc} ${alm} ${run} ${pwr}`,
          cc, alm, run, pwr, // Individual indicators for easier processing
          oem,
          reeferId: deviceData.lastAssetId || orbcommDevice.deviceId,
          containerId: matchingContainer.containerCode,
          event: deviceData.eventType || 'Status Update',
          eventTime,
          deviceFence: 'N/A', // ORBCOMM typically doesn't provide geofence data in this format
          serverFence: 'N/A',
          city,
          temperature,
          powerStatus,
          batteryLevel,
          errorCodes,
          container: matchingContainer // Include full container info
        });

        // Device Status Table Data
        deviceStatus.push({
          deviceId: orbcommDevice.deviceId,
          deviceBat: batteryLevel ? `${batteryLevel}V` : 'N/A',
          reporting: deviceData.reportingInterval || '15 min', // Default ORBCOMM reporting interval
          geofenceRevision: 'N/A',
          cellG: deviceData.cellularType || '4G',
          cellSi: deviceData.signalStrength ? `${deviceData.signalStrength}/5` : 'N/A',
          comments: errorCodes.length > 0 ? errorCodes.join(', ') : 'Normal',
          reeferId: deviceData.lastAssetId || orbcommDevice.deviceId,
          containerId: matchingContainer.containerCode,
          status: orbcommDevice.status
        });
      }

      console.log(`✅ Processed ${reeferUnits.length} reefer units and ${deviceStatus.length} device statuses`);

      res.json({
        success: true,
        dataSource: 'REAL_ORBCOMM_LIVE_DATA',
        timestamp: new Date().toISOString(),
        reeferUnits: {
          total: reeferUnits.length,
          data: reeferUnits
        },
        deviceStatus: {
          total: deviceStatus.length,
          data: deviceStatus
        },
        message: 'Live ORBCOMM data matched with container database. Only containers with matching Reefer IDs are included.'
      });

    } catch (error) {
      console.error('❌ ORBCOMM live data error:', error);
      res.status(500).json({
        error: 'Failed to fetch live ORBCOMM data',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
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

  // Proxy endpoint for OpenStreetMap Nominatim API to avoid CORS issues
  app.get("/api/proxy/nominatim", async (req: any, res) => {
    try {
      const { q, ...otherParams } = req.query;
      
      if (!q) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }

      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.append('q', q);
      url.searchParams.append('format', 'json');
      
      // Add other parameters
      Object.entries(otherParams).forEach(([key, value]) => {
        if (key !== 'q') {
          url.searchParams.append(key, value as string);
        }
      });

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'ContainerGenie/1.0 (contact: support@container-genie.local)',
          'Accept-Language': 'en'
        }
      });

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Nominatim proxy error:', error);
      res.status(500).json({ error: 'Failed to fetch location data' });
    }
  });



  // Get troubleshooting suggestions for an alert
  app.post("/api/alerts/:id/troubleshoot", authenticateUser, async (req: any, res) => {
    try {
      const alertId = req.params.id;

      // Get alert details
      const alert = await storage.getAlert(alertId);
      if (!alert) {
        return res.status(404).json({ error: 'Alert not found' });
      }

      // Get container details
      const container = await storage.getContainer(alert.containerId);
      if (!container) {
        return res.status(404).json({ error: 'Container not found' });
      }

      // Get troubleshooting suggestions
      const suggestions = await ragAdapter.getAlertSuggestions(
        container.id,
        alert.alertType,
        container.type
      );

      if (!suggestions) {
        return res.status(404).json({ error: 'No troubleshooting suggestions available' });
      }

      res.json(suggestions);
    } catch (error) {
      console.error('Alert troubleshooting error:', error);
      res.status(500).json({ error: 'Failed to get troubleshooting suggestions' });
    }
  });

  // Admin endpoints for manual management
  app.get("/api/manuals", authenticateUser, requireRole("admin", "coordinator", "super_admin"), async (req: any, res) => {
    try {
      const manuals = await ragAdapter.getManuals();
      res.json(manuals);
    } catch (error) {
      console.error('Failed to get manuals:', error);
      res.status(500).json({ error: 'Failed to retrieve manuals' });
    }
  });

  app.post("/api/manuals/upload", upload.single('file'), authenticateUser, requireRole("admin", "super_admin"), async (req: any, res) => {
    try {
      console.log('=== UPLOAD REQUEST ===');
      console.log('Content-Type:', req.headers['content-type']);
      console.log('Body:', req.body);
      console.log('File:', req.file);
      console.log('Raw body length:', req.rawBody ? req.rawBody.length : 'no raw body');

      const { name, version, meta } = req.body;
      const file = req.file;

      if (!name) {
        return res.status(400).json({ error: 'Manual name is required' });
      }

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Create manual entry first to get the ID
      const manual = await ragAdapter.uploadManual({
        name,
        sourceUrl: `uploaded_${Date.now()}_${file.originalname}`,
        uploadedBy: req.user.id,
        version,
        meta: meta ? JSON.parse(meta) : undefined
      });

      // Save the uploaded file to disk
      const filePath = await documentProcessor.saveUploadedFile(file, manual.id);

      // Update the manual record with the actual file path
      const updatedManual = await ragAdapter.updateManual(manual.id, {
        sourceUrl: filePath
      });

      console.log(`Manual uploaded successfully: ${name} (${file.originalname})`);

      res.json({
        ...updatedManual,
        message: "Manual uploaded successfully",
        fileInfo: {
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          savedPath: filePath
        }
      });
    } catch (error) {
      console.error('Manual upload error:', error);
      res.status(500).json({ error: 'Failed to upload manual' });
    }
  });

  // Delete manual
  app.delete("/api/manuals/:id", authenticateUser, requireRole("admin", "super_admin"), async (req: any, res) => {
    try {
      const manualId = req.params.id;

      await ragAdapter.deleteManual(manualId);
      res.json({ message: 'Manual deleted successfully' });
    } catch (error) {
      console.error('Manual delete error:', error);
      res.status(500).json({ error: 'Failed to delete manual' });
    }
  });

  // Process manual for RAG (extract text and create chunks)
  app.post("/api/manuals/:id/process", authenticateUser, requireRole("admin", "super_admin"), async (req: any, res) => {
    try {
      const manualId = req.params.id;

      // Get manual info
      const manual = await ragAdapter.getManual(manualId);
      if (!manual) {
        return res.status(404).json({ error: 'Manual not found' });
      }

      console.log(`Processing manual: ${manual.name} (${manual.sourceUrl})`);

      // Check if file exists
      if (!fs.existsSync(manual.sourceUrl)) {
        return res.status(404).json({ error: 'Manual file not found on disk' });
      }

      // Process the PDF file
      const result = await documentProcessor.processPDFFile(manual.sourceUrl, manualId);

      if (result.success) {
        res.json({
          message: 'Manual processed successfully for RAG',
          manualId,
          chunksCreated: result.chunksCreated,
          textLength: result.textLength,
          processingTime: result.processingTime
        });
      } else {
        res.status(500).json({
          error: 'Failed to process manual',
          details: result.error
        });
      }
    } catch (error) {
      console.error('Manual processing error:', error);
      res.status(500).json({ error: 'Failed to process manual' });
    }
  });

  // Process all uploaded manuals (bulk)
  app.post("/api/manuals/process-all", authenticateUser, requireRole("admin", "super_admin"), async (req: any, res) => {
    try {
      const manuals = await ragAdapter.getManuals();
      let processed = 0;
      const details: any[] = [];

      for (const m of manuals) {
        try {
          if (!m.sourceUrl) {
            details.push({ id: m.id, name: m.name, status: 'skipped', reason: 'no sourceUrl' });
            continue;
          }
          if (!fs.existsSync(m.sourceUrl)) {
            details.push({ id: m.id, name: m.name, status: 'skipped', reason: 'file missing' });
            continue;
          }
          const result = await documentProcessor.processPDFFile(m.sourceUrl, m.id);
          if (result.success) {
            processed += 1;
            details.push({ id: m.id, name: m.name, status: 'processed', chunksCreated: result.chunksCreated });
          } else {
            details.push({ id: m.id, name: m.name, status: 'failed', error: result.error });
          }
        } catch (e: any) {
          details.push({ id: m.id, name: m.name, status: 'failed', error: e?.message || String(e) });
        }
      }

      res.json({ total: manuals.length, processed, details });
    } catch (error) {
      console.error('Bulk manual processing error:', error);
      res.status(500).json({ error: 'Failed to process manuals' });
    }
  });

  // Get container-specific query history
  app.get("/api/containers/:id/rag-history", authenticateUser, async (req: any, res) => {
    try {
      const containerId = req.params.id;
      const limit = parseInt(req.query.limit) || 20;

      // Check if user has access to this container
      const container = await storage.getContainer(containerId);
      if (!container) {
        return res.status(404).json({ error: 'Container not found' });
      }

      // Allow access if user is admin/super_admin or owns the container
      if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && req.user.role !== 'coordinator') {
        const customer = await storage.getCustomerByUserId(req.user.id);
        if (!customer || container.currentCustomerId !== customer.id) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      const history = await ragAdapter.getContainerQueryHistory(containerId, limit);
      res.json(history);
    } catch (error) {
      console.error('Container RAG history error:', error);
      res.status(500).json({ error: 'Failed to retrieve container query history' });
    }
  });

  // Map My India autosuggest proxy endpoint (to avoid CORS issues)
  app.get("/api/mapmyindia/autosuggest", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const { query } = req.query;

      if (!query || typeof query !== 'string' || query.length < 2) {
        return res.status(400).json({ error: "Query parameter required (minimum 2 characters)" });
      }

      const apiKey = process.env.REACT_APP_MAPMYINDIA_API_KEY || '';

      if (!apiKey) {
        return res.status(500).json({ error: "Map My India API key not configured" });
      }

      console.log('Making API call to Map My India with query:', query);
      console.log('API endpoint:', `https://atlas.mapmyindia.com/api/places/search/json?query=${encodeURIComponent(query)}&region=IND&token=${apiKey.substring(0, 10)}...`);

      // Try Map My India first
      let response;
      let data;
      let apiSuccess = false;

      try {
        response = await fetch(
          `https://atlas.mapmyindia.com/api/places/search/json?query=${encodeURIComponent(query)}&region=IND&token=${apiKey}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        console.log('Map My India API response status:', response.status, response.statusText);

        if (response.ok) {
          data = await response.json();
          console.log('Map My India API response data:', JSON.stringify(data, null, 2));

          // Check if we have valid Map My India response
          if (data && data.suggestedLocations && Array.isArray(data.suggestedLocations)) {
            apiSuccess = true;
            console.log('Map My India API success - found', data.suggestedLocations.length, 'suggestions');
          } else {
            console.log('Map My India API returned unexpected format');
          }
        }
      } catch (error) {
        console.error('Map My India API call failed:', error);
      }

      // If Map My India fails, fallback to OpenStreetMap Nominatim
      if (!apiSuccess) {
        console.log('Falling back to OpenStreetMap Nominatim for query:', query);

        try {
          const nominatimResponse = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=IN&limit=10`,
            {
              method: 'GET',
              headers: {
                'User-Agent': 'ServiceHub/1.0',
              },
            }
          );

          if (nominatimResponse.ok) {
            const nominatimData = await nominatimResponse.json();

            // Transform Nominatim response to match expected format
            data = {
              suggestedLocations: nominatimData.map((item: any, index: number) => ({
                placeName: item.display_name.split(',')[0] || item.display_name,
                placeAddress: item.display_name.split(',').slice(1).join(',').trim() || item.display_name,
                eLoc: `nominatim_${index}`,
                latitude: item.lat,
                longitude: item.lon
              }))
            };

            console.log('OpenStreetMap Nominatim response transformed:', JSON.stringify(data, null, 2));
          } else {
            throw new Error('Nominatim API failed');
          }
        } catch (error) {
          console.error('OpenStreetMap Nominatim fallback failed:', error);
          // Return empty results instead of mock data
          data = { suggestedLocations: [] };
        }
      }

      res.json(data);
    } catch (error) {
      console.error('Map My India proxy error:', error);
      res.status(500).json({ error: 'Failed to fetch location suggestions' });
    }
  });


  return httpServer;
}

// Remove or merge any duplicate DeviceData interfaces
interface DeviceData {
  deviceId: string;
  temperature?: number;
  powerStatus?: 'on' | 'off';
  batteryLevel?: number;
  errorCodes?: string[];
  timestamp?: Date;
  location?: {
    latitude: number;
    longitude: number;
  };
  lastAssetId?: string;
  oem?: string;
  eventType?: string;
  reportingInterval?: string;
  cellularType?: string;
  signalStrength?: number;
}
