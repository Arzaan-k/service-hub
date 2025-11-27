import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
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
  formatTravelPlanMessage,
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
import { generateJobOrderNumber } from './utils/jobOrderGenerator';
<<<<<<< HEAD
import {
  autoPlanTravel,
  autoPlanTravelByTechnician,
  generateTripTasksForDestination,
  savePlannedTrip,
  recalculateTripCosts
} from "./services/travel-planning";
=======
import { db } from './db';
import { sql } from 'drizzle-orm';
>>>>>>> main

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
  ; (global as any).broadcastWhatsAppMessage = broadcastWhatsAppMessage;

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
      console.error('Registration error:', error instanceof Error ? error.message : 'Unknown error');
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

  // Admin user management endpoints
  app.get("/api/admin/users", authenticateUser, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Remove sensitive data like passwords
      const safeUsers = users.map(user => ({
        ...user,
        password: undefined
      }));
      res.json(safeUsers);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  app.put("/api/admin/users/:userId/credentials", authenticateUser, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const { userId } = req.params;
      const { email, password } = req.body;

      if (!email && !password) {
        return res.status(400).json({ error: "Either email or password must be provided" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if email is already taken by another user
      if (email && email !== user.email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ error: "Email already in use by another user" });
        }
      }

      const updates: any = {};

      if (email) {
        updates.email = email;
        updates.emailVerified = false; // Reset verification when email changes
      }

      if (password) {
        const { hashPassword } = await import('./services/auth');
        updates.password = await hashPassword(password);
      }

      const updatedUser = await storage.updateUser(userId, updates);

      // Send verification email if email was changed
      if (email && email !== user.email) {
        try {
          const { createAndSendEmailOTP } = await import('./services/auth');
          await createAndSendEmailOTP(updatedUser);
        } catch (emailError) {
          console.error("Failed to send verification email:", emailError);
        }
      }

      res.json({
        user: { ...updatedUser, password: undefined },
        message: "User credentials updated successfully"
      });
    } catch (error) {
      console.error("Update user credentials error:", error);
      res.status(500).json({ error: "Failed to update user credentials" });
    }
  });

  // Admin create user with auto-generated password
  app.post("/api/admin/users", authenticateUser, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const { name, email, phoneNumber, role } = req.body;

      if (!email || !name || !phoneNumber || !role) {
        return res.status(400).json({ error: "Name, email, phone and role are required" });
      }

      // Validate role
      const validRoles = ['client', 'technician', 'coordinator'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: "Invalid role. Must be client, technician, or coordinator" });
      }

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) return res.status(400).json({ error: "Email already registered" });

      const existingPhone = await storage.getUserByPhoneNumber(phoneNumber);
      if (existingPhone) return res.status(400).json({ error: "Phone already registered" });

      const { hashPassword, generateSecurePassword, sendUserCredentials } = await import('./services/auth');

      // Generate secure password
      const plainPassword = generateSecurePassword();
      const passwordHash = await hashPassword(plainPassword);

      const user = await storage.createUser({
        phoneNumber,
        name,
        email,
        password: passwordHash,
        role,
        isActive: true,
        whatsappVerified: false,
        emailVerified: false,
      });

      // Send credentials via email
      const emailResult = await sendUserCredentials(user, plainPassword);

      const message = emailResult.success
        ? 'User created and credentials sent via email'
        : `User created. ${emailResult.error || 'Check server logs for credentials.'}`;

      res.json({
        user: { ...user, password: undefined },
        message,
        emailSent: emailResult.success,
        plainPassword: plainPassword // Only for development/debugging
      });
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // Admin send credentials to existing user
  app.post("/api/admin/users/:userId/send-credentials", authenticateUser, requireRole('admin', 'super_admin'), async (req, res) => {
    try {
      const { userId } = req.params;
      const { generateSecurePassword, sendUserCredentials } = await import('./services/auth');

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Generate new secure password
      const plainPassword = generateSecurePassword();
      const { hashPassword } = await import('./services/auth');
      const passwordHash = await hashPassword(plainPassword);

      // Update user with new password
      await storage.updateUser(userId, {
        password: passwordHash,
        emailVerified: false // Reset verification
      });

      // Send credentials via email
      const emailResult = await sendUserCredentials(user, plainPassword);

      const message = emailResult.success
        ? 'New credentials sent via email'
        : `${emailResult.error || 'Check server logs for credentials.'}`;

      res.json({
        message,
        emailSent: emailResult.success,
        plainPassword: plainPassword // Only for development/debugging
      });
    } catch (error) {
      console.error("Send credentials error:", error);
      res.status(500).json({ error: "Failed to send credentials" });
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
      res.status(500).json({ error: "Failed to create test user", details: error instanceof Error ? error.message : 'Unknown error' });
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
  }).passthrough();

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
      console.log('[SERVER] /api/containers query:', JSON.stringify(req.query));
      console.log('[SERVER] /api/containers user:', req.user?.id, 'role:', req.user?.role);
      const role = (req.user?.role || '').toLowerCase();
      const isPrivileged = ["admin", "coordinator", "super_admin"].includes(role);
      console.log('[SERVER] /api/containers isPrivileged:', isPrivileged);

      if (!isPrivileged) {
        console.log('[SERVER] /api/containers user is not privileged, returning all containers for testing');
        // Temporarily return all containers for non-privileged users to test pagination
        const containers = await storage.getAllContainers();
        console.log('[SERVER] /api/containers returning all containers for non-privileged user:', containers.length);
        // Optional pagination: only apply if query includes limit or offset
        const hasLimit = Object.prototype.hasOwnProperty.call(req.query, 'limit');
        const hasOffset = Object.prototype.hasOwnProperty.call(req.query, 'offset');
        console.log('[SERVER] /api/containers hasLimit:', hasLimit, 'hasOffset:', hasOffset);
        if (hasLimit || hasOffset) {
          const { limit, offset } = paginationSchema.parse(req.query);
          console.log('[SERVER] /api/containers applying pagination - limit:', limit, 'offset:', offset);
          res.setHeader('x-total-count', String(containers.length));
          const paginatedResult = containers.slice(offset, offset + limit);
          console.log('[SERVER] /api/containers returning paginated result length:', paginatedResult.length);
          return res.json(paginatedResult);
        }
        console.log('[SERVER] /api/containers returning full list for non-privileged user');
        res.json(containers);
        return;
      }

      console.log('[SERVER] /api/containers fetching all containers');
      const containers = await storage.getAllContainers();
      console.log('[SERVER] /api/containers total containers:', containers.length);

      // Optional pagination: only apply if query includes limit or offset
      const hasLimit = Object.prototype.hasOwnProperty.call(req.query, 'limit');
      const hasOffset = Object.prototype.hasOwnProperty.call(req.query, 'offset');
      console.log('[SERVER] /api/containers hasLimit:', hasLimit, 'hasOffset:', hasOffset);

      if (hasLimit || hasOffset) {
        const { limit, offset } = paginationSchema.parse(req.query);
        console.log('[SERVER] /api/containers applying pagination - limit:', limit, 'offset:', offset);
        res.setHeader('x-total-count', String(containers.length));
        const paginatedResult = containers.slice(offset, offset + limit);
        console.log('[SERVER] /api/containers returning paginated result length:', paginatedResult.length);
        return res.json(paginatedResult);
      }

      // Default: return full list (backward compatible)
      console.log('[SERVER] /api/containers returning full list');
      res.json(containers);
    } catch (error) {
      console.error("Error fetching containers:", error);
      res.status(500).json({ error: "Failed to fetch containers", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Get list of unique cities from containers
  app.get("/api/containers/cities", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const { db } = await import('./db');
      const { containers } = await import('@shared/schema');
      const { sql } = await import('drizzle-orm');
      
      // Query distinct cities from containers using multiple sources
      // Extract from: currentLocation->>'city', depot (first part before comma), or currentLocation->>'address' parsing
      const city_rows = await db.execute(sql`
        SELECT DISTINCT 
          COALESCE(
            NULLIF(TRIM(c.current_location->>'city'), ''),
            NULLIF(TRIM(SPLIT_PART(c.depot, ',', 1)), ''),
            NULLIF(TRIM(REGEXP_REPLACE(c.depot, '^([^,]+).*', '\\1')), '')
          ) AS city_name
        FROM containers c
        WHERE COALESCE(
          NULLIF(TRIM(c.current_location->>'city'), ''),
          NULLIF(TRIM(SPLIT_PART(c.depot, ',', 1)), ''),
          NULLIF(TRIM(REGEXP_REPLACE(c.depot, '^([^,]+).*', '\\1')), '')
        ) IS NOT NULL
        AND COALESCE(
          NULLIF(TRIM(c.current_location->>'city'), ''),
          NULLIF(TRIM(SPLIT_PART(c.depot, ',', 1)), ''),
          NULLIF(TRIM(REGEXP_REPLACE(c.depot, '^([^,]+).*', '\\1')), '')
        ) != ''
        LIMIT 100
      `);
      
      // Extract unique city names, filter out empty/null values and company names
      const cities_set = new Set<string>();
      const exclude_patterns = /^(Ajinomoto|Ola Cell|Company|Customer|Corporation|Limited|Ltd|Pvt|Private|Inc)/i;
      
      for (const row of city_rows.rows) {
        const city = (row as any).city_name?.trim();
        if (city && city.length > 0 && !exclude_patterns.test(city) && city.length < 50) {
          cities_set.add(city);
        }
      }
      
      // Convert to array of objects with name property, sorted alphabetically
      const cities_list = Array.from(cities_set)
        .sort((a, b) => a.localeCompare(b))
        .map(city => ({ name: city }));
      
      // Return in the expected format
      res.json(cities_list.length > 0 ? cities_list : [
        { name: "Chennai" },
        { name: "Mumbai" },
        { name: "Delhi" },
        { name: "Bengaluru" },
        { name: "Hyderabad" },
        { name: "Pune" },
        { name: "Kolkata" }
      ]);
    } catch (error: any) {
      console.error("[API] Error fetching cities:", error);
      // Return fallback cities on error
      res.json([
        { name: "Chennai" },
        { name: "Mumbai" },
        { name: "Delhi" },
        { name: "Bengaluru" },
        { name: "Hyderabad" },
        { name: "Pune" },
        { name: "Kolkata" }
      ]);
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

  app.put("/api/alerts/:id/acknowledge", authenticateUser, async (req: AuthRequest, res) => {
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
  app.get("/api/service-requests/pending", authenticateUser, requireRole("admin", "coordinator", "super_admin"), async (req, res) => {
    try {
      const requests = await storage.getPendingServiceRequests();
      
      // Normalize output with additional fields
      const normalized = (Array.isArray(requests) ? requests : []).map((r: any) => {
        const status = (r.status || '').toLowerCase();
        const issueDesc = (r.issueDescription || '').toLowerCase();
        const isPM = issueDesc.includes('preventive maintenance') || 
                    issueDesc.includes('pm') ||
                    (r.excelData as any)?.purpose === 'PM' ||
                    (r.excelData as any)?.techBookingSource === 'auto_pm_travel';
        
        // Check if it's a third-party request (exclude from auto-assign)
        const isThirdParty = (r.excelData as any)?.thirdPartyTechnicianId || false;
        const canAutoAssign = !isThirdParty && 
                             status !== 'cancelled' && 
                             status !== 'in_progress' &&
                             status !== 'completed' &&
                             !r.assignedTechnicianId;
        
        return {
          ...r,
          status: status,
          isPM: isPM,
          canAutoAssign: canAutoAssign,
        };
      });
      
      res.json(normalized);
    } catch (error: any) {
      console.error("[API] Error fetching pending service requests:", error);
      console.error("[API] Error stack:", error?.stack);
      res.status(500).json({ 
        error: "Failed to fetch pending requests", 
        details: error?.message || String(error),
        ...(process.env.NODE_ENV === 'development' && { stack: error?.stack })
      });
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

      // Check for technician assignment - use DB assignedTechnicianId as source of truth
      let technician: any = undefined;
      let thirdPartyTechnician: any = undefined;
      
      if (request.assignedTechnicianId) {
        // Try internal technician first
        technician = await storage.getTechnician(request.assignedTechnicianId).catch(() => undefined);
        
        // If not found as internal, check if it's a third-party technician
        if (!technician) {
          const { readThirdPartyList } = await import('./services/third-party-technicians');
          const tpList = readThirdPartyList();
          thirdPartyTechnician = tpList.find((t: any) => 
            (t.id === request.assignedTechnicianId || t._id === request.assignedTechnicianId)
          );
        }
      }
      
      // Legacy: Check excelData for third-party assignment and sync to DB if needed
      const thirdPartyTechId = (request.excelData as any)?.thirdPartyTechnicianId;
      if (thirdPartyTechId && !request.assignedTechnicianId) {
        const { readThirdPartyList } = await import('./services/third-party-technicians');
        const tpList = readThirdPartyList();
        const tpTech = tpList.find((t: any) => 
          (t.id === thirdPartyTechId || t._id === thirdPartyTechId)
        );
        
        if (tpTech) {
          // Sync to DB
          const { db } = await import('./db');
          const { serviceRequests } = await import('@shared/schema');
          const { eq } = await import('drizzle-orm');
          
          try {
            await db.update(serviceRequests)
              .set({ assignedTechnicianId: tpTech.id || tpTech._id })
              .where(eq(serviceRequests.id, request.id));
            
            // Update request object
            request.assignedTechnicianId = tpTech.id || tpTech._id;
            thirdPartyTechnician = tpTech;
            console.log(`[API] Synced third-party assignment for SR ${request.id} to DB`);
          } catch (err) {
            console.warn(`[API] Failed to sync third-party assignment for SR ${request.id}:`, err);
          }
        }
      }
      
      const [container, customer] = await Promise.all([
        storage.getContainer(request.containerId),
        storage.getCustomer(request.customerId)
      ]);

      // Get technician user data if technician is assigned (internal only)
      const technicianUser = technician ? await storage.getUser(technician.userId) : undefined;
      
      // Use third-party technician if no internal technician is assigned
      const assignedTechnician = technician || thirdPartyTechnician;

      // Parse multiple containers from issue description if present
      let allContainers: any[] = [];
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
      const uniqueCodes = Array.from(new Set(containerCodes));
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
              iotEnabled: found.hasIot || false
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
                  matches.forEach((code: string) => {
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
            const updatedUniqueCodes = Array.from(new Set(foundCodesInMessages));
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
                  iotEnabled: found.hasIot || false
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
          iotEnabled: container.hasIot || false
        }];
      }

      const response = {
        ...request,
        container: container ? { id: container.id, containerCode: container.containerCode, currentLocation: container.currentLocation } : undefined,
        allContainers, // Array of all containers involved in this service request
        customer: customer ? { id: customer.id, companyName: customer.companyName } : undefined,
        technician: assignedTechnician ? (
          thirdPartyTechnician ? {
            // Third-party technician
            id: thirdPartyTechnician.id || thirdPartyTechnician._id,
            name: thirdPartyTechnician.name,
            phone: thirdPartyTechnician.phone,
            type: 'thirdparty',
            employeeCode: thirdPartyTechnician.employeeCode || thirdPartyTechnician.mid,
            location: thirdPartyTechnician.location || thirdPartyTechnician.baseLocation
          } : {
            // Internal technician
            id: technician.id,
            employeeCode: technician.employeeCode,
            experienceLevel: technician.experienceLevel,
            skills: technician.skills,
            status: technician.status,
            type: 'internal',
            user: technicianUser ? {
              id: technicianUser.id,
              name: technicianUser.name,
              phoneNumber: technicianUser.phoneNumber,
              email: technicianUser.email
            } : undefined
          }
        ) : undefined,
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

  // Service History from imported Excel data
  app.get("/api/service-history", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const result = await db.execute(sql`
        SELECT
          id,
          job_order_number,
          container_number,
          client_name,
          complaint_attended_date,
          service_type,
          technician_name,
          work_type,
          job_type,
          billing_type,
          client_type,
          issue_complaint_logged as issue_description,
          work_description,
          required_spare_parts,
          observations,
          service_client_location,
          call_attended_type as call_status,
          created_at as requested_at
        FROM service_history
        ORDER BY complaint_attended_date DESC NULLS LAST, created_at DESC
      `);

      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching service history:", error);
      res.status(500).json({ error: "Failed to fetch service history" });
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

      // Generate job order number (e.g., JAN001, FEB045)
      const jobOrderNumber = await generateJobOrderNumber();

      const request = await storage.createServiceRequest({
        requestNumber: `SR-${Date.now()}`,
        jobOrder: jobOrderNumber,
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
      
      // Auto-assign technician silently in background
      // Use distributed assignment to ensure equal distribution across technicians
      try {
        const { schedulerService } = await import('./services/scheduler');
        // Try distributed assignment first (for better load balancing)
        const distributedResult = await schedulerService.distributeServicesAcrossTechnicians([request.id]);
        const assignment = distributedResult.assignments.find(a => a.requestId === request.id);
        
        if (assignment?.assigned && assignment.technicianId) {
          // Fetch the updated request
          const updatedRequest = await storage.getServiceRequest(request.id);
          if (updatedRequest) {
            broadcast({ type: "service_request_assigned", data: updatedRequest });
            return res.json({ ...updatedRequest, autoAssigned: true, technicianId: assignment.technicianId });
          }
        }
        
        // Fallback to single assignment if distributed didn't work
        const result = await schedulerService.autoAssignBestTechnician(request.id);
        if (result.assigned && result.request) {
          broadcast({ type: "service_request_assigned", data: result.request });
          return res.json({ ...result.request, autoAssigned: true, technicianId: result.technicianId });
        }
      } catch (autoErr) {
        // Log but don't fail the creation - assignment happens silently
        console.warn('[Auto-Assign] Silent failure for new service request:', (autoErr as any)?.message || autoErr);
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
      const techId = req.params.technicianId;
      
      if (!techId) {
        console.warn('[GET /api/service-requests/technician/:id] No technician ID provided');
        return res.status(400).json({ error: "Technician ID is required" });
      }
      
      // Use DB as source of truth - check if technician exists (internal or third-party)
      // Both internal and third-party technicians should have assignedTechnicianId in DB
      let requests: any[] = [];
      
      try {
        // Try to get services from DB using assignedTechnicianId
        // This works for both internal and third-party if they've been assigned via the normal flow
        requests = await storage.getServiceRequestsByTechnician(techId, false);
        console.log(`[GET /api/service-requests/technician/${techId}] Returning ${requests.length} services from DB`);
        
        // If no services found, check if this is a third-party tech with legacy file/excel assignments
        if (requests.length === 0) {
          const thirdPartyList = readThirdPartyList();
          const thirdPartyTech = thirdPartyList.find((tp: any) => (tp.id === techId || tp._id === techId));
          
          if (thirdPartyTech) {
            // Sync legacy assignments to DB
            const assigns = readThirdPartyAssignments().filter((a: any) => {
              const normalizedTechId = thirdPartyTech.id || thirdPartyTech._id || techId;
              return a.technicianId === normalizedTechId || a.technicianId === techId;
            });
            const serviceIdsFromAssigns = assigns.map((a: any) => a.serviceId);
            
            const allRequests = await storage.getAllServiceRequests();
            const normalizedTechId = thirdPartyTech.id || thirdPartyTech._id || techId;
            const servicesFromExcel = allRequests.filter((req: any) => {
              const excelThirdPartyId = req.excelData?.thirdPartyTechnicianId?.toString()?.toLowerCase();
              return excelThirdPartyId === normalizedTechId?.toString()?.toLowerCase() && !req.assignedTechnicianId;
            });
            
            // Sync to DB
            const { db } = await import('./db');
            const { serviceRequests } = await import('@shared/schema');
            const { eq } = await import('drizzle-orm');
            
            for (const serviceId of serviceIdsFromAssigns) {
              try {
                const existing = await storage.getServiceRequest(serviceId);
                if (existing && !existing.assignedTechnicianId) {
                  await db.update(serviceRequests)
                    .set({ assignedTechnicianId: techId })
                    .where(eq(serviceRequests.id, serviceId));
                }
              } catch (err) {
                // Ignore errors
              }
            }
            
            for (const req of servicesFromExcel) {
              try {
                if (!req.assignedTechnicianId) {
                  await db.update(serviceRequests)
                    .set({ assignedTechnicianId: techId })
                    .where(eq(serviceRequests.id, req.id));
                }
              } catch (err) {
                // Ignore errors
              }
            }
            
            // Re-fetch from DB after syncing
            requests = await storage.getServiceRequestsByTechnician(techId, false);
            console.log(`[GET /api/service-requests/technician/${techId}] After sync: ${requests.length} services from DB`);
          }
        }
      } catch (queryError: any) {
        console.error(`[GET /api/service-requests/technician/${techId}] Query error:`, queryError);
        console.error(`[GET /api/service-requests/technician/${techId}] Error stack:`, queryError?.stack);
        // Return empty array instead of crashing
        requests = [];
      }
      
      // Format response - include all fields that frontend expects
      // DO NOT filter in JS - return ALL services regardless of status
      const formatted = requests.map((req: any) => ({
        id: req.id,
        requestNumber: req.requestNumber,
        jobOrder: req.jobOrder,
        status: req.status,
        priority: req.priority,
        issueDescription: req.issueDescription,
        scheduledDate: req.scheduledDate,
        scheduledTimeWindow: req.scheduledTimeWindow,
        actualStartTime: req.actualStartTime,
        actualEndTime: req.actualEndTime,
        durationMinutes: req.durationMinutes,
        containerId: req.containerId,
        customerId: req.customerId,
        assignedTechnicianId: req.assignedTechnicianId,
        // Container fields - MUST include containerCode, location, clientName
        container: {
          id: req.container?.id || null,
          containerCode: req.container?.containerCode || null,
          type: req.container?.type || null,
          status: req.container?.status || null,
          currentLocation: req.container?.currentLocation || null,
          // Extract location from currentLocation if it's JSON
          location: req.container?.currentLocation || null,
        },
        // Customer fields - MUST include clientName (companyName)
        customer: {
          id: req.customer?.id || null,
          companyName: req.customer?.companyName || null,
          clientName: req.customer?.companyName || null, // Alias for frontend compatibility
          contactPerson: req.customer?.contactPerson || null,
          phone: req.customer?.phone || null,
          email: req.customer?.email || null,
        }
      }));
      
      // Debug log
      const listOfIds = formatted.map((r: any) => r.id);
      // Categorize services by status but DO NOT filter out
      const activeStatuses = ['pending', 'scheduled', 'approved', 'in_progress', 'assigned'];
      const active = formatted.filter((r: any) => {
        const status = (r.status || '').toLowerCase();
        return activeStatuses.includes(status);
      });
      const completed = formatted.filter((r: any) => {
        const status = (r.status || '').toLowerCase();
        return status === 'completed';
      });
      const cancelled = formatted.filter((r: any) => {
        const status = (r.status || '').toLowerCase();
        return status === 'cancelled';
      });
      
      // Enhanced debug logging
      console.log("[Technician Assigned Services]", {
        technicianId: techId,
        total: formatted.length,
        active: active.length,
        completed: completed.length,
        cancelled: cancelled.length,
        all: formatted.map((r: any) => ({
          id: r.id,
          requestNumber: r.requestNumber,
          status: r.status,
          containerCode: r.container?.containerCode
        }))
      });
      
      // Return categorized response
      const response = {
        active,
        completed,
        cancelled,
        all: formatted
      };
      
      res.json(response);
    } catch (error: any) {
      console.error("Error fetching technician service requests:", error);
      console.error("Error stack:", error?.stack);
      console.error("Technician ID:", req.params.technicianId);
      res.status(500).json({ 
        error: "Failed to fetch technician service requests",
        details: error?.message || String(error),
        technicianId: req.params.technicianId
      });
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
      console.log(`[Routes] Attempting to send WhatsApp notification for service request ${request.id}`);
      try {
        const { customerCommunicationService } = await import('./services/whatsapp');
        console.log(`[Routes] customerCommunicationService imported successfully`);
        await customerCommunicationService.notifyServiceRequestUpdate(request.id, 'assigned');
        console.log(`[Routes] WhatsApp notification call completed`);
      } catch (notifError) {
        console.error('[Routes] Failed to send WhatsApp notification:', notifError);
        console.error('[Routes] Error stack:', notifError instanceof Error ? notifError.stack : 'No stack trace');
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
      console.log(`[Routes] Attempting to send WhatsApp notification for service start ${request.id}`);
      try {
        const { customerCommunicationService } = await import('./services/whatsapp');
        await customerCommunicationService.notifyServiceRequestUpdate(request.id, 'started');
        console.log(`[Routes] WhatsApp start notification call completed`);
      } catch (notifError) {
        console.error('[Routes] Failed to send WhatsApp start notification:', notifError);
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
      console.log(`[Routes] Attempting to send WhatsApp notification for service completion ${request.id}`);
      try {
        const { customerCommunicationService } = await import('./services/whatsapp');
        await customerCommunicationService.notifyServiceRequestUpdate(request.id, 'completed');
        console.log(`[Routes] WhatsApp completion notification call completed`);
      } catch (notifError) {
        console.error('[Routes] Failed to send WhatsApp completion notification:', notifError);
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

  // Request Indent - Create order in Inventory Management System
  app.post("/api/service-requests/:id/request-indent", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const serviceRequest = await storage.getServiceRequest(req.params.id);
      if (!serviceRequest) {
        return res.status(404).json({ error: "Service request not found" });
      }

      // Check if order already exists (look in notes until migration is run)
      if (serviceRequest.resolutionNotes && serviceRequest.resolutionNotes.includes('[Inventory Order]')) {
        return res.status(400).json({ 
          error: "Indent already requested for this service request. Check service notes for order details."
        });
      }

      // Get required parts from service request
      const requiredParts = serviceRequest.requiredParts || [];
      if (requiredParts.length === 0) {
        return res.status(400).json({ error: "No required parts found in service request" });
      }

      // Get customer details
      const customer = await storage.getCustomer(serviceRequest.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      // Parse parts and prepare items for inventory system
      const items = requiredParts.map((part: string) => {
        // Parse format: "Part Name (quantity)"
        const match = part.match(/^(.+?)\s*\((\d+)\)$/);
        if (match) {
          return {
            productName: match[1].trim(),
            quantity: parseInt(match[2], 10)
          };
        }
        // Fallback: assume quantity 1 if no format match
        return {
          productName: part.trim(),
          quantity: 1
        };
      });

      // Import inventory service
      const { inventoryService } = await import('./services/inventoryIntegration');

      // Check if inventory integration is configured
      if (!inventoryService.isConfigured()) {
        return res.status(503).json({ 
          error: "Inventory system integration not configured. Please add INVENTORY_API_URL, INVENTORY_API_KEY, and INVENTORY_API_SECRET to .env file" 
        });
      }

      // Create order in inventory system
      const orderResult = await inventoryService.createOrder({
        customerName: customer.companyName,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        items: items,
        serviceRequestNumber: serviceRequest.requestNumber,
        notes: `Service Request: ${serviceRequest.requestNumber}\nIssue: ${serviceRequest.issueDescription}`
      });

      if (!orderResult.success) {
        return res.status(500).json({ 
          error: orderResult.error || "Failed to create order in Inventory System" 
        });
      }

      // Store order info in service request notes (until database migration is run)
      const orderInfo = `\n\n[Inventory Order]\nOrder ID: ${orderResult.orderId}\nOrder Number: ${orderResult.orderNumber}\nCreated: ${new Date().toISOString()}`;
      const updatedNotes = (serviceRequest.resolutionNotes || '') + orderInfo;
      
      const updatedRequest = await storage.updateServiceRequest(req.params.id, {
        resolutionNotes: updatedNotes
      });

      console.log(`[Inventory Integration] ✅ Order created successfully for SR ${serviceRequest.requestNumber}:`, {
        orderId: orderResult.orderId,
        orderNumber: orderResult.orderNumber
      });

      res.json({
        success: true,
        message: "Indent Requested Successfully — Order Created in Inventory System",
        orderId: orderResult.orderId,
        orderNumber: orderResult.orderNumber,
        serviceRequest: updatedRequest
      });
    } catch (error: any) {
      console.error("[Inventory Integration] Error requesting indent:", error);
      res.status(500).json({ 
        error: error.message || "Failed to request indent" 
      });
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
  // Summary of assigned services for all technicians (optimized single call)
  // Uses DB as source of truth - assignedTechnicianId field on service_requests
  app.get("/api/technicians/assigned-services-summary", authenticateUser, async (_req, res) => {
    try {
      const technicians = await storage.getAllTechnicians();
      const summary: Record<string, { count: number; services: any[] }> = {};
      const activeStatuses = ['pending', 'scheduled', 'approved', 'in_progress', 'assigned'];

      // Get third-party technicians list for reference
      const thirdPartyTechs = readThirdPartyList();
      const thirdPartyAssignments = readThirdPartyAssignments();

      // Process internal technicians - use DB query only
      await Promise.all(
        technicians.map(async (tech: any) => {
          try {
            // Get ALL assigned services from DB using assignedTechnicianId
            const rows = await storage.getServiceRequestsByTechnician(tech.id, false);
            
            // Filter active vs total by status
            const active = rows.filter((sr: any) => {
              const status = (sr.status || '').toLowerCase();
              return activeStatuses.includes(status);
            });
            
            // Format services for response
            const services = rows.map((sr: any) => ({
              id: sr.id,
              requestNumber: sr.requestNumber,
              status: sr.status,
              priority: sr.priority,
              issueDescription: sr.issueDescription,
              scheduledDate: sr.scheduledDate,
              containerId: sr.containerId,
              customerId: sr.customerId,
              containerCode: sr.container?.containerCode || null,
              customerName: sr.customer?.companyName || null,
            }));
            
            console.log(`[Assigned Services Summary] Tech ${tech.id} (${tech.name || tech.employeeCode}): ${active.length} active out of ${rows.length} total`);
            
            summary[tech.id] = { 
              count: active.length, 
              services: services 
            };
          } catch (error) {
            console.error(`Error building assigned-services summary for tech ${tech.id}:`, error);
            summary[tech.id] = { count: 0, services: [] };
          }
        })
      );

      // Process third-party technicians - use DB query if they have assignedTechnicianId
      // Also sync file/excel assignments to DB
      for (const tpTech of thirdPartyTechs) {
        const techId = tpTech.id || tpTech._id;
        try {
          // First, try to get services from DB using assignedTechnicianId
          // Third-party techs might have been assigned via the normal assignment flow
          const dbServices = await storage.getServiceRequestsByTechnician(techId, false);
          
          // Also check file/excel assignments for legacy data
          const normalizedTechId = techId?.toString()?.toLowerCase();
          const tpAssignments = thirdPartyAssignments.filter((a: any) => {
            const assignTechId = a.technicianId?.toString()?.toLowerCase();
            return assignTechId === normalizedTechId;
          });
          const serviceIdsFromAssigns = tpAssignments.map((a: any) => a.serviceId);
          
          // Get services from excelData.thirdPartyTechnicianId
          const allRequests = await storage.getAllServiceRequests();
          const servicesFromExcel = allRequests.filter((req: any) => {
            const excelThirdPartyId = req.excelData?.thirdPartyTechnicianId?.toString()?.toLowerCase();
            return excelThirdPartyId === normalizedTechId && !req.assignedTechnicianId;
          });
          
          // Sync file/excel assignments to DB by updating assignedTechnicianId
          const { db } = await import('./db');
          const { serviceRequests } = await import('@shared/schema');
          const { eq } = await import('drizzle-orm');
          
          for (const serviceId of serviceIdsFromAssigns) {
            try {
              const existing = await storage.getServiceRequest(serviceId);
              if (existing && !existing.assignedTechnicianId) {
                await db.update(serviceRequests)
                  .set({ assignedTechnicianId: techId })
                  .where(eq(serviceRequests.id, serviceId));
                console.log(`[Assigned Services Summary] Synced third-party assignment: SR ${serviceId} -> tech ${techId}`);
              }
            } catch (err) {
              console.warn(`[Assigned Services Summary] Failed to sync assignment for SR ${serviceId}:`, err);
            }
          }
          
          for (const req of servicesFromExcel) {
            try {
              if (!req.assignedTechnicianId) {
                await db.update(serviceRequests)
                  .set({ assignedTechnicianId: techId })
                  .where(eq(serviceRequests.id, req.id));
                console.log(`[Assigned Services Summary] Synced excel assignment: SR ${req.id} -> tech ${techId}`);
              }
            } catch (err) {
              console.warn(`[Assigned Services Summary] Failed to sync excel assignment for SR ${req.id}:`, err);
            }
          }
          
          // Re-fetch after syncing
          const allServices = await storage.getServiceRequestsByTechnician(techId, false);
          
          // Filter active vs total
          const active = allServices.filter((sr: any) => {
            const status = (sr.status || '').toLowerCase();
            return activeStatuses.includes(status);
          });
          
          // Format services
          const services = allServices.map((sr: any) => ({
            id: sr.id,
            requestNumber: sr.requestNumber,
            status: sr.status,
            priority: sr.priority,
            issueDescription: sr.issueDescription,
            scheduledDate: sr.scheduledDate,
            containerId: sr.containerId,
            customerId: sr.customerId,
            containerCode: sr.container?.containerCode || null,
            customerName: sr.customer?.companyName || null,
          }));
          
          console.log(`[Assigned Services Summary] Third-party tech ${techId}: ${active.length} active out of ${allServices.length} total`);
          
          summary[techId] = { 
            count: active.length, 
            services: services 
          };
        } catch (error) {
          console.error(`Error building assigned-services summary for third-party tech ${techId}:`, error);
          summary[techId] = { count: 0, services: [] };
        }
      }

      res.json(summary);
    } catch (error: any) {
      console.error("Error fetching assigned services summary:", error);
      res.status(500).json({ error: "Failed to fetch assigned services summary" });
    }
  });

  // Get assigned services for a technician
  app.get("/api/technicians/:id/assigned-services", authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.query;
      
      const technician = await storage.getTechnician(id);
      if (!technician) {
        return res.status(404).json({ error: "Technician not found" });
      }

      let services = await storage.getServiceRequestsByTechnician(id);
      
      // Filter by status if provided
      if (status) {
        services = services.filter((sr: any) => sr.status === status);
      }

      // Return ALL services (including completed) - let frontend filter by status
      // Frontend will separate: active services in "Assigned Services", completed in "Service History"
      // Don't filter here - return everything so frontend can organize it properly

      // Enrich with container and customer info
      const enrichedServices = await Promise.all(
        services.map(async (sr: any) => {
          const container = sr.containerId ? await storage.getContainer(sr.containerId).catch(() => null) : null;
          const customer = sr.customerId ? await storage.getCustomer(sr.customerId).catch(() => null) : null;
          return {
            ...sr,
            container: container ? { id: container.id, containerCode: container.containerCode } : null,
            customer: customer ? { id: customer.id, companyName: customer.companyName } : null,
          };
        })
      );

      res.json({
        technicianId: id,
        count: enrichedServices.length,
        services: enrichedServices
      });
    } catch (error: any) {
      console.error("Error fetching assigned services:", error);
      res.status(500).json({ error: "Failed to fetch assigned services" });
    }
  });

  app.get("/api/technicians", authenticateUser, async (req, res) => {
    try {
      const technicians = await storage.getAllTechnicians();
      
      // Enrich technicians with assigned services count
      const techniciansWithServices = await Promise.all(
        technicians.map(async (tech: any) => {
          try {
            const services = await storage.getServiceRequestsByTechnician(tech.id);
            const assignedCount = services.filter((sr: any) => 
              ['pending', 'scheduled', 'approved', 'in_progress'].includes(sr.status)
            ).length;
            return {
              ...tech,
              assignedServicesCount: assignedCount
            };
          } catch (error) {
            return {
              ...tech,
              assignedServicesCount: 0
            };
          }
        })
      );
      
      res.json(techniciansWithServices);
    } catch (error) {
      console.error("Error fetching technicians:", error);
      res.status(500).json({ error: "Failed to fetch technicians" });
    }
  });

  // Third-party technicians - lightweight file-backed store to avoid JSON/HTML mismatch
  const thirdPartyDir = path.join(process.cwd(), "server", "data");
  const thirdPartyFile = path.join(thirdPartyDir, "thirdparty-technicians.json");
  function readThirdPartyList(): any[] {
    try {
      if (!fs.existsSync(thirdPartyFile)) return [];
      const raw = fs.readFileSync(thirdPartyFile, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  function writeThirdPartyList(list: any[]) {
    if (!fs.existsSync(thirdPartyDir)) fs.mkdirSync(thirdPartyDir, { recursive: true });
    fs.writeFileSync(thirdPartyFile, JSON.stringify(list, null, 2), "utf8");
  }

  // Third-party assignments file-backed store
  const thirdPartyAssignFile = path.join(thirdPartyDir, "thirdparty-assignments.json");
  function readThirdPartyAssignments(): any[] {
    try {
      if (!fs.existsSync(thirdPartyAssignFile)) return [];
      const raw = fs.readFileSync(thirdPartyAssignFile, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  function writeThirdPartyAssignments(list: any[]) {
    if (!fs.existsSync(thirdPartyDir)) fs.mkdirSync(thirdPartyDir, { recursive: true });
    fs.writeFileSync(thirdPartyAssignFile, JSON.stringify(list, null, 2), "utf8");
  }

  // GET: /api/thirdparty-technicians
  app.get("/api/thirdparty-technicians", authenticateUser, async (_req, res) => {
    try {
      const list = readThirdPartyList();
      res.json(list);
    } catch (error) {
      console.error("Error fetching third-party technicians:", error);
      res.status(500).json({ error: "Failed to fetch third-party technicians" });
    }
  });

  // POST: /api/thirdparty-technicians
  app.post("/api/thirdparty-technicians", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const { contactName, phone, email, whatsappNumber, specialization, baseLocation, moneyAllowance } = req.body || {};
      const parsedAllowance = typeof moneyAllowance === "string" ? parseFloat(moneyAllowance) : Number(moneyAllowance);
      if (!contactName || !phone || Number.isNaN(parsedAllowance)) {
        return res.status(400).json({ error: "contactName, phone and a valid moneyAllowance are required" });
      }

      const list = readThirdPartyList();
      const item = {
        id: randomUUID(),
        contactName,
        name: contactName, // for UI compatibility
        phone,
        email: email || null,
        whatsappNumber: whatsappNumber || null,
        specialization: specialization || "general",
        baseLocation: baseLocation || "",
        moneyAllowance: parsedAllowance,
        assignedServices: [],
        createdAt: new Date().toISOString(),
      };
      list.push(item);
      writeThirdPartyList(list);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating third-party technician:", error);
      res.status(500).json({ error: "Failed to create third-party technician" });
    }
  });

  // GET: /api/thirdparty-technicians/:id
  app.get("/api/thirdparty-technicians/:id", authenticateUser, async (req, res) => {
    try {
      const list = readThirdPartyList();
      const tp = list.find((t: any) => (t.id === req.params.id || t._id === req.params.id));
      if (!tp) return res.status(404).json({ error: "Third-party technician not found" });
      res.json(tp);
    } catch (error) {
      console.error("Error fetching third-party technician:", error);
      res.status(500).json({ error: "Failed to fetch third-party technician" });
    }
  });

  // PUT: /api/thirdparty-technicians/:id
  app.put("/api/thirdparty-technicians/:id", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const list = readThirdPartyList();
      const idx = list.findIndex((t: any) => (t.id === id || t._id === id));
      if (idx === -1) {
        return res.status(404).json({ error: "Third-party technician not found" });
      }
      const incoming = req.body || {};
      const updated = { ...list[idx] };
      if (incoming.moneyAllowance !== undefined) {
        const money = typeof incoming.moneyAllowance === "string" ? parseFloat(incoming.moneyAllowance) : Number(incoming.moneyAllowance);
        if (Number.isNaN(money)) {
          return res.status(400).json({ error: "Invalid moneyAllowance" });
        }
        updated.moneyAllowance = money;
      }
      if (incoming.specialization !== undefined) updated.specialization = incoming.specialization;
      if (incoming.baseLocation !== undefined) updated.baseLocation = incoming.baseLocation;
      if (incoming.phone !== undefined) updated.phone = incoming.phone;
      if (incoming.email !== undefined) updated.email = incoming.email;
      if (incoming.whatsappNumber !== undefined) updated.whatsappNumber = incoming.whatsappNumber;
      if (incoming.name !== undefined || incoming.contactName !== undefined) {
        updated.name = incoming.name || incoming.contactName || updated.name;
        updated.contactName = incoming.contactName || updated.contactName;
      }
      list[idx] = updated;
      writeThirdPartyList(list);
      res.json(updated);
    } catch (error) {
      console.error("Error updating third-party technician:", error);
      res.status(500).json({ error: "Failed to update third-party technician" });
    }
  });

  // Unified assignment route: supports internal and third-party
  app.post("/api/assign-service", authenticateUser, requireRole("admin", "coordinator"), async (req, res) => {
    try {
      const { serviceId, technicianId, type } = req.body || {};
      if (!serviceId || !technicianId) {
        return res.status(400).json({ error: "Missing data" });
      }

      if (type === "thirdparty") {
        // Validate third-party exists
        const list = readThirdPartyList();
        const tech = list.find((t: any) => (t.id === technicianId || t._id === technicianId));
        if (!tech) {
          return res.status(404).json({ error: "Third-party technician not found" });
        }
        // Update service request status to assigned (DB)
        try {
          const existing = await storage.getServiceRequest(serviceId);
          if (!existing) return res.status(404).json({ error: "Service request not found" });
          await storage.updateServiceRequest(serviceId, { status: "assigned" } as any);
        } catch (e) {
          console.error("Failed to update service status for third-party assignment:", e);
        }
        // Record assignment
        const assigns = readThirdPartyAssignments();
        const normalizedTechId = tech.id || technicianId;
        // ensure uniqueness
        if (!assigns.find((a: any) => a.serviceId === serviceId && a.technicianId === normalizedTechId)) {
          assigns.push({ serviceId, technicianId: normalizedTechId, assignedAt: new Date().toISOString() });
        }
        writeThirdPartyAssignments(assigns);
        // Update third-party technician record with assigned service
        try {
          const tpList = readThirdPartyList();
          const idx = tpList.findIndex((t: any) => (t.id === normalizedTechId || t._id === normalizedTechId));
          if (idx > -1) {
            const entry = tpList[idx];
            const current = Array.isArray(entry.assignedServices) ? entry.assignedServices : [];
            if (!current.includes(serviceId)) current.push(serviceId);
            tpList[idx] = { ...entry, assignedServices: current };
            writeThirdPartyList(tpList);
          }
        } catch (e) {
          console.error("Failed updating third-party technician assignedServices:", e);
        }

        // Optionally mark scheduled/assigned without breaking existing workflow
        try {
          // No-op update to touch updatedAt safely
          const existing = await storage.getServiceRequest(serviceId);
          if (!existing) return res.status(404).json({ error: "Service request not found" });
        } catch { }

        // Optional: notify via WhatsApp (best-effort)
        try {
          const { sendTextMessage } = await import('./services/whatsapp');
          if (tech.phone) await sendTextMessage(tech.phone, `You have a new service assignment (${serviceId}).`);
        } catch { }

        return res.json({ success: true, type: "thirdparty" });
      }

      // Default internal assignment - reuse existing logic
      const reqAssigned = await storage.assignServiceRequest(serviceId, technicianId, undefined, undefined);
      if (!reqAssigned) {
        return res.status(404).json({ error: "Service request not found" });
      }
      
      console.log(`[Assign Service] Assigned service ${serviceId} to internal technician ${technicianId}`);
      console.log(`[Assign Service] Assigned request has assignedTechnicianId:`, reqAssigned.assignedTechnicianId);
      console.log(`[Assign Service] Assigned request status:`, reqAssigned.status);
      
      // Verify the assignment was saved correctly
      const verifyRequest = await storage.getServiceRequest(serviceId);
      console.log(`[Assign Service] Verification - Service ${serviceId} assignedTechnicianId:`, verifyRequest?.assignedTechnicianId);
      console.log(`[Assign Service] Verification - Service ${serviceId} status:`, verifyRequest?.status);
      
      // Broadcast assignment event
      broadcast({ type: "service_request_assigned", data: reqAssigned });
      
      // Notify client via WhatsApp
      try {
        const { customerCommunicationService } = await import('./services/whatsapp');
        await customerCommunicationService.notifyServiceRequestUpdate(serviceId, 'assigned');
      } catch (notifError) {
        console.error('Failed to send WhatsApp notification:', notifError);
      }
      
      return res.json({ success: true, type: "internal", request: reqAssigned });
    } catch (err: any) {
      console.error("Error assigning technician:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Consolidated services by technician (internal or third-party via ?type=thirdparty)
  app.get("/api/services-by-technician/:id", authenticateUser, async (req, res) => {
    try {
      const technicianId = req.params.id;
      const type = (req.query.type as string) || "internal";

      if (type === "thirdparty") {
        const assigns = readThirdPartyAssignments().filter((a: any) => a.technicianId === technicianId);
        const details = await Promise.all(assigns.map(async (a: any) => {
          try {
            return await storage.getServiceRequest(a.serviceId);
          } catch {
            return null;
          }
        }));
        return res.json(details.filter(Boolean));
      }

      // Internal
      const list = await storage.getServiceRequestsByTechnician(technicianId);
      return res.json(list);
    } catch (err: any) {
      console.error("Error fetching assigned services:", err);
      res.status(500).json({ error: "Error fetching assigned services" });
    }
  });

  // PATCH: /api/service-requests/:id/assign — assign ONLY the selected service
  app.patch("/api/service-requests/:id/assign", authenticateUser, requireRole("admin", "coordinator"), async (req, res) => {
    try {
      const serviceId = req.params.id;
      const { technicianId, technicianType } = req.body || {};
      if (!technicianId || !technicianType) {
        return res.status(400).json({ message: "Missing technicianId or technicianType" });
      }
      if (!["internal", "thirdparty"].includes(String(technicianType))) {
        return res.status(400).json({ message: "Invalid technicianType" });
      }

      const service = await storage.getServiceRequest(serviceId);
      if (!service) {
        return res.status(404).json({ message: "Service Request not found" });
      }

      // Prevent duplicate/competing assignments
      // Internal assignment checks against assignedTechnicianId in DB
      // Third-party assignment checks against file-backed assignment record and excelData indicator
      if (technicianType === "internal") {
        const alreadyAssignedTo = (service as any).assignedTechnicianId;
        if (alreadyAssignedTo) {
          if (alreadyAssignedTo === technicianId) {
            return res.status(409).json({ message: "This service request is already assigned to this technician" });
          }
          return res.status(409).json({ message: "This service request is already assigned to another technician" });
        }
      } else {
        // thirdparty
        const assigns = readThirdPartyAssignments();
        const existingAssign = assigns.find((a: any) => a.serviceId === serviceId);
        if (existingAssign) {
          if (existingAssign.technicianId === technicianId) {
            return res.status(409).json({ message: "This service request is already assigned to this technician" });
          }
          return res.status(409).json({ message: "This service request is already assigned to another technician" });
        }
        // Also prevent conflict if internally assigned
        if ((service as any).assignedTechnicianId) {
          return res.status(409).json({ message: "This service request is already assigned to another technician" });
        }
      }

      // Update only this service
      if (technicianType === "thirdparty") {
        // Merge third-party tech info into excelData for visibility
        // Clear any internal assignedTechnicianId to avoid confusion
        const mergedExcelData = {
          ...(service.excelData || {}),
          thirdPartyTechnicianId: technicianId,
        };
        // Use "scheduled" status (not "assigned" - that's not a valid enum value)
        // Clear assignedTechnicianId since this is a third-party assignment
        await storage.updateServiceRequest(serviceId, { 
          status: "scheduled", 
          assignedTechnicianId: null, // Clear internal assignment
          excelData: mergedExcelData 
        } as any);

        // Update only the selected third-party tech in file-backed store
        const tpList = readThirdPartyList();
        const idx = tpList.findIndex((t: any) => (t.id === technicianId || t._id === technicianId));
        if (idx === -1) {
          return res.status(404).json({ message: "Third-party technician not found" });
        }
        const entry = tpList[idx];
        const current = Array.isArray(entry.assignedServices) ? entry.assignedServices : [];
        if (!current.includes(serviceId)) current.push(serviceId);
        tpList[idx] = { ...entry, assignedServices: current };
        writeThirdPartyList(tpList);

        // Record assignment history
        const assigns = readThirdPartyAssignments();
        if (!assigns.find((a: any) => a.serviceId === serviceId && a.technicianId === (entry.id || technicianId))) {
          assigns.push({ serviceId, technicianId: entry.id || technicianId, assignedAt: new Date().toISOString() });
          writeThirdPartyAssignments(assigns);
        }

        // Broadcast assignment event so frontend can refresh
        const updatedService = await storage.getServiceRequest(serviceId);
        broadcast({ type: "service_request_assigned", data: updatedService });
        
        console.log("Assigned service:", serviceId, "to third-party technician:", technicianId);
        return res.json({ success: true, message: "Service assigned successfully", service: updatedService || { ...service, status: "scheduled" } });
      } else {
        // Internal assignment - use existing storage logic (affects only this SR)
        const assigned = await storage.assignServiceRequest(serviceId, technicianId, undefined, undefined);
        if (!assigned) {
          return res.status(404).json({ message: "Service Request not found" });
        }
        console.log("Assigned service:", serviceId, "to technician:", technicianId);
        console.log(`[PATCH Assign] Assigned request has assignedTechnicianId:`, assigned.assignedTechnicianId);
        console.log(`[PATCH Assign] Assigned request status:`, assigned.status);
        
        // Broadcast assignment event so frontend can refresh
        broadcast({ type: "service_request_assigned", data: assigned });
        
        // Notify client via WhatsApp
        try {
          const { customerCommunicationService } = await import('./services/whatsapp');
          await customerCommunicationService.notifyServiceRequestUpdate(serviceId, 'assigned');
        } catch (notifError) {
          console.error('Failed to send WhatsApp notification:', notifError);
        }
        
        return res.json({ success: true, message: "Service assigned successfully", service: assigned });
      }
    } catch (error: any) {
      console.error("❌ Error assigning technician:", error);
      res.status(500).json({ message: error?.message || "Internal server error" });
    }
  });

  // PATCH: /api/service-requests/:id/unassign — clear assignment safely
  app.patch("/api/service-requests/:id/unassign", authenticateUser, requireRole("admin", "coordinator"), async (req, res) => {
    try {
      const serviceId = req.params.id;
      const service = await storage.getServiceRequest(serviceId);
      if (!service) {
        return res.status(404).json({ message: "Service Request not found" });
      }

      // Determine current assignment
      const internalAssignedId = (service as any).assignedTechnicianId || (service as any).assignedTechnician;
      const excelThird = (service as any).excelData?.thirdPartyTechnicianId;

      if (!internalAssignedId && !excelThird) {
        return res.json({ success: true, message: "Service was not assigned", service });
      }

      // If third-party: remove from file-backed stores and SR excelData
      if (excelThird) {
        try {
          const tpList = readThirdPartyList();
          const idx = tpList.findIndex((t: any) => (t.id === excelThird || t._id === excelThird));
          if (idx > -1) {
            const entry = tpList[idx];
            const assigned = Array.isArray(entry.assignedServices) ? entry.assignedServices : [];
            tpList[idx] = { ...entry, assignedServices: assigned.filter((sid: string) => sid !== serviceId) };
            writeThirdPartyList(tpList);
          }
          const assigns = readThirdPartyAssignments().filter((a: any) => !(a.serviceId === serviceId));
          writeThirdPartyAssignments(assigns);
        } catch (e) {
          console.error("Unassign cleanup for third-party failed (continuing):", e);
        }
      }

      // Update service request to unassigned state
      const nextExcel = { ...(service as any).excelData };
      if (nextExcel && nextExcel.thirdPartyTechnicianId) {
        delete nextExcel.thirdPartyTechnicianId;
      }
      await storage.updateServiceRequest(serviceId, {
        status: "pending",
        assignedTechnicianId: null,
        assignedTechnician: null,
        technicianType: null,
        excelData: nextExcel,
      } as any);

      console.log("Unassigned service:", serviceId);
      return res.json({ success: true, message: "Service unassigned successfully" });
    } catch (error: any) {
      console.error("❌ Error unassigning technician:", error);
      res.status(500).json({ message: error?.message || "Internal server error" });
    }
  });

  // Get schedules for all technicians for a specific date - MUST come before /:id routes
  app.get("/api/technicians/schedules", authenticateUser, async (req, res) => {
    console.log("Technician schedules route called with query:", req.query);
    try {
      const { date } = req.query;
      const targetDate = date ? new Date(date as string) : new Date();

      // Get all technicians
      const technicians = await storage.getAllTechnicians();
      console.log(`Found ${technicians.length} technicians`);

      // Get schedules for each technician
      const schedules = await Promise.all(
        technicians.map(async (technician: any) => {
          try {
            const schedule = await storage.getTechnicianSchedule(technician.id, targetDate.toISOString().split('T')[0]);
            return {
              technician,
              schedule
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
      console.log(`Sample: ${schedules[0]?.technician?.name || schedules[0]?.technician?.employeeCode} has ${schedules[0]?.schedule?.length || 0} jobs`);

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

      // Fallback: check third-party technician store
      if (!technician) {
        try {
          const thirdList = typeof readThirdPartyList === "function" ? readThirdPartyList() : [];
          const tp = thirdList.find((t: any) => (t.id === req.params.id || t._id === req.params.id));
          if (tp) {
            // Normalize third-party response to overlap with internal fields where possible
            const normalized = {
              id: tp.id || tp._id,
              name: tp.name || tp.contactName,
              phone: tp.phone,
              email: tp.email,
              whatsappNumber: tp.whatsappNumber,
              specialization: tp.specialization || "general",
              baseLocation: tp.baseLocation || "",
              averageRating: tp.rating ?? 0,
              totalJobsCompleted: Array.isArray(tp.services) ? tp.services.length : (tp.servicesCompleted ?? 0),
              type: "thirdparty",
              moneyAllowance: tp.moneyAllowance,
              status: "available",
              experienceLevel: "mid",
              skills: tp.specialization ? [tp.specialization] : ["general"],
              createdAt: tp.createdAt || new Date().toISOString(),
            };
            return res.json(normalized);
          }
        } catch (e) {
          // ignore file read errors and continue to 404
        }
      }

      if (!technician) return res.status(404).json({ error: "Technician not found" });
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
      const techId = req.params.id;
      // Get ALL services for this technician (including completed)
      const allServices = await storage.getServiceRequestsByTechnician(techId, false);
      
      // Filter to show only completed and cancelled services in history
      const completedServices = allServices.filter((sr: any) => {
        const status = (sr.status || '').toLowerCase();
        return status === 'completed' || status === 'cancelled';
      });
      
      console.log(`[GET /api/technicians/${techId}/service-history] Found ${completedServices.length} completed services out of ${allServices.length} total`);
      
      res.json(completedServices);
    } catch (error: any) {
      console.error("Failed to fetch technician service history:", error);
      console.error("Error details:", error?.message, error?.stack);
      res.status(500).json({ 
        error: "Failed to fetch technician service history",
        details: error?.message || String(error)
      });
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

      const analysis: {
        tables: Array<{ name: any; columns: any; rowCount: number }>;
        issues: any;
      } = {
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
        const existingColumns = techTable.columns.map((c: any) => c.column_name);
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
      res.status(500).json({ error: 'Database analysis failed', details: error instanceof Error ? error.message : 'Unknown error' });
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
      res.status(500).json({ error: "Failed to update wage details", details: error instanceof Error ? error.message : 'Unknown error' });
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
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        technicianData: req.body
      });
      res.status(500).json({ error: "Failed to create technician", details: error instanceof Error ? error.message : 'Unknown error' });
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
      console.log('[API] Smart auto-assignment request received');
      
      const { schedulerService } = await import('./services/scheduler');

      // Use smart auto-assign for internal technicians
      // The scheduler now has built-in fallback logic, so this should work
      const result = await schedulerService.smartAutoAssignPending();

      console.log(`[API] Smart auto-assign complete: ${result.assigned.length} assigned, ${result.skipped.length} skipped`);

      // Broadcast assignment events for all successfully assigned requests
      for (const assignment of result.assigned) {
        try {
          const updatedRequest = await storage.getServiceRequest(assignment.requestId);
          if (updatedRequest) {
            broadcast({ type: "service_request_assigned", data: updatedRequest });
          }
        } catch (err) {
          console.error(`[API] Failed to broadcast assignment for request ${assignment.requestId}:`, err);
        }
      }

      // Format response to match expected structure
      // Get technicians to map IDs to names
      const allTechnicians = await storage.getAllTechnicians();
      const byTechnician = result.distributionSummary.map((s: any) => {
        const tech = allTechnicians.find((t: any) => t.id === s.technicianId || t.id === s.techId);
        return {
          technicianId: s.technicianId || s.techId,
          name: tech?.name || tech?.employeeCode || s.name || s.technicianId || s.techId,
          newAssignments: s.newAssignments || s.countAssigned || 0,
          totalActive: s.totalActive || 0
        };
      });

      res.json({
        success: result.success,
        assignedCount: result.assigned.length,
        byTechnician: byTechnician,
        distributionSummary: result.distributionSummary, // Keep for backward compatibility
        assigned: result.assigned,
        skipped: result.skipped,
        message: result.success 
          ? `Successfully assigned ${result.assigned.length} requests${result.skipped.length > 0 ? `, ${result.skipped.length} skipped` : ''}`
          : "Auto-assignment failed"
      });
    } catch (error: any) {
      console.error('[API] Auto-assignment error:', error);
      console.error('[API] Error stack:', error?.stack);

      // Surface known scheduler business-rule errors as 400 with specific codes
      if (error?.status === 400 && error?.code) {
        return res.status(400).json({
          error: error.message || "Auto-assignment validation error",
          code: error.code,
        });
      }

      res.status(500).json({
        error: "Failed to run auto-assignment",
        details: error?.message || String(error),
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      });
    }
  });

  // Preventive Maintenance endpoints
  app.post("/api/pm/check", authenticateUser, requireRole("admin", "coordinator", "super_admin"), async (req, res) => {
    try {
      console.log('[API] Manual PM check requested');
      const { runPMCheckAndNotify } = await import('./services/preventive-maintenance');
      const result = await runPMCheckAndNotify();
      
      res.json({
        success: true,
        message: `PM check completed. Found ${result.count} container(s) needing preventive maintenance.`,
        alerts: result.alerts,
        count: result.count,
      });
    } catch (error: any) {
      console.error('[API] PM check error:', error);
      res.status(500).json({
        success: false,
        error: "Failed to run PM check",
        details: error?.message || String(error),
      });
    }
  });

  // Temporary endpoint to fix technician data (set category = 'internal' and status = 'active')
  // This is a one-time fix endpoint - can be removed after use
  app.post("/api/fix-technician-data", authenticateUser, requireRole("admin", "super_admin"), async (req, res) => {
    try {
      console.log('[API] Fix technician data request received');
      
      const { db } = await import('./db');
      const { technicians } = await import('@shared/schema');
      const { sql } = await import('drizzle-orm');

      // First, get count of all technicians
      const allTechs = await db.select().from(technicians);
      const totalCount = allTechs.length;

      if (totalCount === 0) {
        return res.status(404).json({
          success: false,
          error: "No technicians found in database",
          updated: 0,
          total: 0
        });
      }

      // Update all technicians to set category = 'internal' and status = 'active'
      // Using raw SQL to handle the category field which might not be in the schema
      // Note: This uses parameterized query to prevent SQL injection
      await db.execute(sql`
        UPDATE technicians
        SET category = 'internal', status = 'active'
        WHERE id IS NOT NULL
      `);

      // Verify the update by checking updated technicians
      const updatedTechs = await db.select().from(technicians);
      const updatedCount = updatedTechs.length;

      console.log(`[API] Fixed technician data: ${updatedCount} technicians updated`);

      res.json({
        success: true,
        message: `Successfully updated ${updatedCount} technician(s) to category = 'internal' and status = 'active'`,
        updated: updatedCount,
        total: totalCount
      });
    } catch (error: any) {
      console.error('[API] Fix technician data error:', error);
      res.status(500).json({
        success: false,
        error: "Failed to fix technician data",
        details: error?.message || String(error),
        updated: 0,
        total: 0
      });
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
          if (data.location) {
            await storage.updateContainer(container.id, {
              currentLocation: {
                lat: data.location.latitude,
                lng: data.location.longitude,
              },
            });
          }

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

          results.push({ containerId: container.containerCode || container.id, status: "success", anomalies });
        } catch (error) {
          console.error(`Error polling container ${container.containerCode || container.id}:`, error);
          results.push({ containerId: container.containerCode || container.id, status: "error" });
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
        devicesFound: result.devices
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
        devicesFound: result.devices
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
      res.status(500).json({ error: "Failed to seed database", details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Start scheduler
  startScheduler();

  // Start Preventive Maintenance checker (runs daily at midnight)
  (async () => {
    try {
      const { startPMChecker } = await import('./services/preventive-maintenance');
      startPMChecker();
    } catch (error) {
      console.error('[Routes] Failed to start PM checker:', error);
    }
  })();

  // Customer routes
  app.get("/api/customers", authenticateUser, requireRole("admin", "coordinator", "super_admin"), async (req, res) => {
    try {
      const customers = await storage.getAllCustomers();

      // Add container count for each customer
      const customersWithCounts = await Promise.all(
        customers.map(async (customer: any) => {
          try {
            const containers = await storage.getContainersByCustomer(customer.id);
            return {
              ...customer,
              containerCount: containers.length
            };
          } catch (error) {
            console.error(`Failed to get container count for customer ${customer.id}:`, error);
            return {
              ...customer,
              containerCount: 0
            };
          }
        })
      );

      res.json(customersWithCounts);
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
      if (["admin", "coordinator", "super_admin"].includes(role)) {
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

      if (["admin", "coordinator", "super_admin"].includes(role)) {
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
      // Get the current customer to check if email changed
      const currentCustomer = await storage.getCustomer(req.params.id);
      if (!currentCustomer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const customer = await storage.updateCustomer(req.params.id, req.body);

      // If email changed, update the associated user account
      if (req.body.email && req.body.email !== currentCustomer.email && currentCustomer.userId) {
        try {
          await storage.updateUser(currentCustomer.userId, {
            email: req.body.email,
            emailVerified: false // Reset verification when email changes
          });

          // Send verification email for the new email address
          const user = await storage.getUser(currentCustomer.userId);
          if (user) {
            const { createAndSendEmailOTP } = await import('./services/auth');
            await createAndSendEmailOTP(user);
          }
        } catch (userUpdateError) {
          console.error('Failed to update user account for customer:', userUpdateError);
          // Don't fail the customer update if user update fails
        }
      }

      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  // Admin: Toggle client access (enable/disable)
  app.post('/api/admin/customers/:id/toggle-access', authenticateUser, requireRole('admin','super_admin','coordinator'), async (req: AuthRequest, res) => {
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
      const result = await sendMediaMessage(to, mediaUrl, caption);
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
      if (!alert) {
        return res.status(404).json({ error: 'Alert not found' });
      }
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
      
      if (!technician) {
        return res.status(404).json({ error: "Technician not found" });
      }
      const techUser = await storage.getUser(technician.userId);
      if (!techUser || !techUser.phoneNumber) {
        return res.status(400).json({ error: "Technician WhatsApp number not available" });
      }
      await sendTechnicianSchedule(techUser.phoneNumber, technician as any, services);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to send technician schedule" });
    }
  });

  app.post("/api/whatsapp/send-invoice", authenticateUser, async (req, res) => {
    try {
      const { invoiceId, customerId } = req.body;
      const invoice = await storage.getInvoice(invoiceId);
      const customer = await storage.getCustomer(customerId);
      
      const message = formatInvoiceMessage(invoice, customer);
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

  // POST /api/scheduling/plan-trip - New PM-first travel planning endpoint
  app.post("/api/scheduling/plan-trip", authenticateUser, requireRole("admin", "coordinator", "super_admin"), async (req: AuthRequest, res) => {
    try {
      const { city, startDate, endDate, technicianId } = req.body;
      
      if (!city || !startDate || !endDate) {
        return res.status(400).json({ error: "city, startDate, endDate are required" });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      if (end < start) {
        return res.status(400).json({ error: "endDate must be after startDate" });
      }

      // Get all technicians
      const allTechnicians = await storage.getAllTechnicians();
      
      // If technicianId is provided, try to use that specific technician
      let selectedTechnician = null;
      if (technicianId) {
        selectedTechnician = allTechnicians.find((t: any) => t.id === technicianId);
        if (!selectedTechnician) {
          return res.status(400).json({ error: `Technician with ID ${technicianId} not found` });
        }
      } else {
        // Auto-select: prefer internal technicians, but fall back to any available
        const internalTechnicians = allTechnicians.filter((t: any) => 
          (t.category?.toLowerCase() === 'internal' || !t.category) && 
          ['available', 'active', 'idle', 'on_duty'].includes(t.status?.toLowerCase())
        );
        
        if (internalTechnicians.length > 0) {
          selectedTechnician = internalTechnicians[0];
        } else {
          // Fallback: use any technician with active status
          const availableTechnicians = allTechnicians.filter((t: any) => 
            ['available', 'active', 'idle', 'on_duty'].includes(t.status?.toLowerCase())
          );
          
          if (availableTechnicians.length === 0) {
            return res.status(400).json({ 
              error: "No available technicians found. Please ensure technicians are marked as 'available', 'active', 'idle', or 'on_duty'." 
            });
          }
          
          selectedTechnician = availableTechnicians[0];
        }
      }

      if (!selectedTechnician) {
        return res.status(400).json({ error: "Unable to select a technician" });
      }

      // Auto-calculate cost breakdown
      const { calculateCostEstimates } = await import('./services/travel-planning');
      const costEstimates = await calculateCostEstimates(selectedTechnician, city, start, end);
      
      // Format costs in the expected structure
      const costs = {
        travelFare: costEstimates.travelFare,
        stayCost: costEstimates.stayCost,
        dailyAllowance: costEstimates.dailyAllowance,
        localTravelCost: costEstimates.localTravelCost,
        miscellaneous: costEstimates.miscellaneous,
        totalCost: costEstimates.totalCost,
        // Keep backward compatibility
        breakdown: costEstimates.breakdown,
        totalEstimatedCost: costEstimates.totalEstimatedCost,
        currency: costEstimates.currency,
      };

      // Get PM-due containers and other tasks for the city
      let allTasks: any[] = [];
      try {
        const { collectCityTaskCandidates } = await import('./services/travel-planning');
        allTasks = await collectCityTaskCandidates(city, start, end);
      } catch (taskError: any) {
        console.error("[API] Error collecting city task candidates:", taskError);
        // Continue with empty tasks array rather than failing completely
        allTasks = [];
      }

      // Separate PM tasks from breakdown tasks
      const pmTasks = allTasks.filter(t => t.taskType === 'pm');
      const breakdownTasks = allTasks.filter(t => t.taskType !== 'pm');

      // Sort PM tasks by priority (CRITICAL first)
      pmTasks.sort((a, b) => {
        const priorityOrder: Record<string, number> = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
        return (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
      });

      // Combine: PM first, then breakdown
      const prioritizedTasks = [...pmTasks, ...breakdownTasks];

      // Distribute tasks across days (max 3 per day)
      const dailyPlan: Array<{ date: string; tasks: Array<{ id: string; type: string; containerId: string; siteName?: string; serviceRequestId?: string }> }> = [];
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      let currentDate = new Date(start);
      let taskIndex = 0;

      for (let day = 0; day <= daysDiff && taskIndex < prioritizedTasks.length; day++) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const dayTasks: Array<{ id: string; type: string; containerId: string; siteName?: string; serviceRequestId?: string }> = [];

        // Add up to 3 tasks per day
        for (let i = 0; i < 3 && taskIndex < prioritizedTasks.length; i++) {
          const task = prioritizedTasks[taskIndex];
          dayTasks.push({
            id: task.serviceRequestId || task.alertId || `task-${task.containerId}-${day}-${i}`,
            type: task.taskType === 'pm' ? 'PM' : 'BREAKDOWN',
            containerId: task.containerId,
            siteName: task.siteName,
            serviceRequestId: task.serviceRequestId || null,
          });
          taskIndex++;
        }

        if (dayTasks.length > 0) {
          dailyPlan.push({ date: dateKey, tasks: dayTasks });
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      res.json({
        techId: selectedTechnician.id,
        city: city,
        range: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
        pmCount: pmTasks.length,
        dailyPlan: dailyPlan,
        costs: costs, // Auto-calculated costs
      });
    } catch (error: any) {
      console.error("[API] Error in plan-trip:", error);
      console.error("[API] Error stack:", error?.stack);
      const errorMessage = error?.message || String(error);
      res.status(500).json({ 
        error: "Failed to auto-plan travel", 
        details: errorMessage,
        // Include more context for debugging
        ...(process.env.NODE_ENV === 'development' && { stack: error?.stack })
      });
    }
  });

  // POST /api/scheduling/confirm-trip - Confirm trip and assign PM tasks
  app.post("/api/scheduling/confirm-trip", authenticateUser, requireRole("admin", "coordinator", "super_admin"), async (req: AuthRequest, res) => {
    try {
      const { techId, plan } = req.body;

      if (!techId || !plan) {
        return res.status(400).json({ error: "techId and plan are required" });
      }

      const technician = await storage.getTechnician(techId);
      if (!technician) {
        return res.status(400).json({ error: "Technician not found" });
      }

      const startDate = new Date(plan.range.start);
      const endDate = new Date(plan.range.end);

      // Create trip using savePlannedTrip
      const { savePlannedTrip } = await import('./services/travel-planning');
      
      // Convert dailyPlan to tasks format and collect PM service request IDs
      const tasks: any[] = [];
      const pmServiceRequestIds: string[] = [];
      
      for (const day of plan.dailyPlan || []) {
        for (const task of day.tasks || []) {
          tasks.push({
            containerId: task.containerId,
            taskType: task.type === 'PM' ? 'pm' : 'inspection',
            priority: task.type === 'PM' ? 'HIGH' : 'MEDIUM',
            scheduledDate: day.date,
            estimatedDurationHours: 2,
            siteName: task.siteName,
            serviceRequestId: task.serviceRequestId || null,
            source: 'auto',
            isManual: false,
          });
          
          // Track PM service request IDs for assignment
          if (task.type === 'PM' && task.serviceRequestId) {
            pmServiceRequestIds.push(task.serviceRequestId);
          }
        }
      }

      // Use costs from plan if provided, otherwise auto-calculate
      let costs = plan.costs;
      if (!costs || !costs.totalCost) {
        const { calculateCostEstimates } = await import('./services/travel-planning');
        const costEstimates = await calculateCostEstimates(technician, plan.city, startDate, endDate);
        costs = {
          travelFare: costEstimates.travelFare,
          stayCost: costEstimates.stayCost,
          dailyAllowance: costEstimates.dailyAllowance,
          localTravelCost: costEstimates.localTravelCost,
          miscellaneous: costEstimates.miscellaneous,
          totalCost: costEstimates.totalCost,
          breakdown: costEstimates.breakdown,
          totalEstimatedCost: costEstimates.totalEstimatedCost,
          currency: costEstimates.currency,
        };
      }

      // Convert costs to the format expected by savePlannedTrip
      // If costs.breakdown exists, use it; otherwise construct from the new format
      const costInput = costs?.breakdown || {
        travelFare: { value: Number(costs?.travelFare || 1000), isManual: false },
        stayCost: { value: Number(costs?.stayCost || 0), isManual: false },
        dailyAllowance: { value: Number(costs?.dailyAllowance || 0), isManual: false },
        localTravelCost: { value: Number(costs?.localTravelCost || 0), isManual: false },
        miscCost: { value: Number(costs?.miscellaneous || 0), isManual: false },
      };

      const result = await savePlannedTrip({
        technicianId: techId,
        destinationCity: plan.city,
        startDate: startDate,
        endDate: endDate,
        purpose: 'pm',
        costs: costInput,
        tasks: tasks,
        currency: costs.currency || 'INR',
      }, req.user?.id);

      // Update trip booking status to 'all_confirmed' after tasks are assigned
      if (result.trip?.id) {
        try {
          await storage.updateTechnicianTrip(result.trip.id, {
            bookingStatus: 'all_confirmed',
          });
        } catch (tripUpdateError: any) {
          console.error(`[API] Error updating trip booking status:`, tripUpdateError);
        }
      }

      // Auto-assign PM service requests that don't have serviceRequestId yet
      const assignedPMRequests: string[] = [];
      for (const day of plan.dailyPlan || []) {
        for (const task of day.tasks || []) {
          if (task.type === 'PM' && !task.serviceRequestId) {
            // Create PM service request if it doesn't exist
            try {
              const container = await storage.getContainer(task.containerId);
              if (container && container.currentCustomerId) {
                const allUsers = await storage.getAllUsers();
                const adminUser = allUsers.find((u: any) => ['admin', 'super_admin'].includes(u.role?.toLowerCase()));
                const createdBy = adminUser?.id || allUsers[0]?.id;
                
                if (createdBy) {
                  const timestamp = Date.now();
                  const requestNumber = `SR-PM-${timestamp}`;
                  
                  const newRequest = await storage.createServiceRequest({
                    requestNumber: requestNumber,
                    containerId: task.containerId,
                    customerId: container.currentCustomerId,
                    priority: 'normal',
                    status: 'pending',
                    issueDescription: `Preventive Maintenance - Container ${container.containerCode || container.id} (90-day threshold)`,
                    requestedAt: new Date(),
                    createdBy: createdBy,
                    workType: 'SERVICE-AT SITE',
                    jobType: 'FOC',
                  });
                  
                  // Schedule it and set booking status
                  const scheduledDate = new Date(day.date);
                  const { sql } = await import('drizzle-orm');
                  const bookingMetadata = {
                    bookingStatus: 'confirmed',
                    techBookingSource: 'auto_pm_travel',
                    purpose: 'PM',
                    travelTripId: result.trip.id,
                  };
                  await db
                    .update(serviceRequests)
                    .set({
                      assignedTechnicianId: techId,
                      status: 'scheduled',
                      scheduledDate: scheduledDate,
                      scheduledTimeWindow: '09:00-17:00',
                      assignedBy: req.user?.id || 'AUTO',
                      assignedAt: new Date(),
                      // Store booking status and metadata in excelData field
                      excelData: sql`COALESCE(${serviceRequests.excelData}, '{}'::jsonb) || ${JSON.stringify(bookingMetadata)}::jsonb`,
                    })
                    .where(eq(serviceRequests.id, newRequest.id));
                  
                  assignedPMRequests.push(newRequest.id);
                }
              }
            } catch (createError: any) {
              console.error(`[API] Error creating PM service request for container ${task.containerId}:`, createError);
            }
          } else if (task.type === 'PM' && task.serviceRequestId) {
            // Update existing PM service request
            try {
              const scheduledDate = new Date(day.date);
              const { sql } = await import('drizzle-orm');
              // Preserve existing status if already scheduled/in_progress, otherwise set to scheduled
              const existingRequest = await db
                .select({ status: serviceRequests.status })
                .from(serviceRequests)
                .where(eq(serviceRequests.id, task.serviceRequestId))
                .limit(1);
              
              const newStatus = existingRequest[0]?.status === 'in_progress' 
                ? 'in_progress' 
                : (existingRequest[0]?.status === 'scheduled' ? 'scheduled' : 'scheduled');
              
              const bookingMetadata = {
                bookingStatus: 'confirmed',
                techBookingSource: 'auto_pm_travel',
                purpose: 'PM',
                travelTripId: result.trip.id,
              };
              
              await db
                .update(serviceRequests)
                .set({
                  assignedTechnicianId: techId,
                  status: newStatus,
                  scheduledDate: scheduledDate,
                  scheduledTimeWindow: '09:00-17:00',
                  assignedBy: req.user?.id || 'AUTO',
                  assignedAt: new Date(),
                  // Store booking status and metadata in excelData field
                  excelData: sql`COALESCE(${serviceRequests.excelData}, '{}'::jsonb) || ${JSON.stringify(bookingMetadata)}::jsonb`,
                })
                .where(eq(serviceRequests.id, task.serviceRequestId));
              
              assignedPMRequests.push(task.serviceRequestId);
            } catch (updateError: any) {
              console.error(`[API] Error updating PM service request ${task.serviceRequestId}:`, updateError);
            }
          }
        }
      }

      // Send WhatsApp notification
      let notification = null;
      try {
        notification = await sendTravelPlanToTechnician(result.trip.id, req.user?.id);
      } catch (notifError: any) {
        console.error("Error sending WhatsApp:", notifError);
      }

      // Broadcast WebSocket event
      if (typeof (global as any).broadcast === 'function') {
        const broadcast = (global as any).broadcast;
        const tech = await storage.getTechnician(techId).catch(() => null);
        const technicianUserId = tech?.userId;
        
        const pmCount = assignedPMRequests.length || plan.pmCount || 0;
        const startDateStr = startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const endDateStr = endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        
        broadcast({
          type: 'service_request_assigned',
          timestamp: new Date().toISOString(),
          data: {
            technicianId: techId,
            tripId: result.trip.id,
            pmTasksCount: pmCount,
            message: `✈️ Travel Trip Assigned for PM in ${plan.city}. Dates: ${startDateStr} - ${endDateStr}. Assigned Tasks: ${pmCount}.`,
          },
        }, technicianUserId || undefined);
      }

      // Invalidate pending requests cache since PM tasks are now assigned
      if (typeof (global as any).broadcast === 'function') {
        const broadcast = (global as any).broadcast;
        broadcast({
          type: 'pending_requests_updated',
          timestamp: new Date().toISOString(),
          data: {
            assignedCount: assignedPMRequests.length,
          },
        });
      }

      // Get the saved trip with costs
      const savedCosts = await storage.getTechnicianTripCosts(result.trip.id).catch(() => null);
      
      res.status(201).json({
        success: true,
        trip: {
          ...result.trip,
          bookingStatus: 'all_confirmed',
          purpose: 'PM',
        },
        cost: costs ? {
          travelFare: costs.travelFare,
          stayCost: costs.stayCost,
          dailyAllowance: costs.dailyAllowance,
          localTravelCost: costs.localTravelCost,
          miscellaneous: costs.miscellaneous,
          totalCost: costs.totalCost,
        } : (savedCosts ? {
          travelFare: parseFloat(savedCosts.travelFare?.toString() || '0'),
          stayCost: parseFloat(savedCosts.stayCost?.toString() || '0'),
          dailyAllowance: parseFloat(savedCosts.dailyAllowance?.toString() || '0'),
          localTravelCost: parseFloat(savedCosts.localTravelCost?.toString() || '0'),
          miscellaneous: parseFloat(savedCosts.miscCost?.toString() || '0'),
          totalCost: parseFloat(savedCosts.totalEstimatedCost?.toString() || '0'),
        } : null),
        scheduledPMRequests: assignedPMRequests,
        notifications: notification ? { whatsapp: notification } : null,
        message: "Trip confirmed and sent to technician!",
      });
    } catch (error: any) {
      console.error("[API] Error in confirm-trip:", error);
      console.error("[API] Error stack:", error?.stack);
      res.status(500).json({ error: "Failed to confirm trip", details: error?.message });
    }
  });

  app.post("/api/travel/auto-plan", authenticateUser, requireRole("admin", "coordinator", "super_admin"), async (req: AuthRequest, res) => {
    try {
      const { technicianId, destinationCity, startDate, endDate } = req.body;
      if (!destinationCity || !startDate || !endDate) {
        return res.status(400).json({ error: "destinationCity, startDate, endDate are required" });
      }

      const plan = await autoPlanTravel({
        destinationCity,
        startDate,
        endDate,
        technicianId,
      });
      res.json(plan);
    } catch (error: any) {
      console.error("Error auto-planning travel:", error);
      const message = error?.message || "Failed to auto-plan travel";
      const status =
        error?.statusCode ||
        (message.toLowerCase().includes("not found")
          ? 404
          : message.toLowerCase().includes("invalid") || message.toLowerCase().includes("missing")
          ? 400
          : 500);
      res.status(status).json({ error: status === 500 ? "Failed to auto-plan travel" : message });
    }
  });

  // Auto-plan travel based on technician's location/service areas
  app.post("/api/travel/auto-plan-by-technician", authenticateUser, requireRole("admin", "coordinator", "super_admin"), async (req: AuthRequest, res) => {
    try {
      const { technicianId, startDate, endDate, destinationCity, autoSave } = req.body;
      if (!technicianId || !startDate || !endDate) {
        return res.status(400).json({ error: "technicianId, startDate, endDate are required" });
      }

      const plan = await autoPlanTravelByTechnician({
        technicianId,
        startDate,
        endDate,
        destinationCity,
      });

      // If autoSave is true, automatically save the trip and send to technician
      if (autoSave === true) {
        try {
          const result = await savePlannedTrip({
            technicianId: plan.technician.id,
            destinationCity: plan.destinationCity,
            startDate: plan.travelWindow.start,
            endDate: plan.travelWindow.end,
            origin: plan.technicianSourceCity,
            purpose: 'pm',
            costs: plan.costs,
            tasks: plan.tasks,
          }, req.user?.id);

          // Send travel plan to technician
          let notification = null;
          try {
            notification = await sendTravelPlanToTechnician(result.trip.id, req.user?.id);
          } catch (notifError: any) {
            console.error("Error sending travel plan to technician:", notifError);
            // Don't fail the whole request if notification fails
          }

          return res.status(201).json({
            success: true,
            plan,
            trip: result.trip,
            costs: result.costs,
            tasks: result.tasks,
            notifications: notification ? { whatsapp: notification } : null,
            message: "Travel plan created and sent to technician",
          });
        } catch (saveError: any) {
          console.error("Error auto-saving travel trip:", saveError);
          // Return the plan even if save fails
          return res.json({
            success: true,
            plan,
            saveError: saveError?.message || "Failed to auto-save trip",
            message: "Plan generated but failed to save. You can save it manually.",
          });
        }
      }

      res.json(plan);
    } catch (error: any) {
      console.error("Error auto-planning travel by technician:", error);
      const message = error?.message || "Failed to auto-plan travel";
      const status =
        error?.statusCode ||
        (message.toLowerCase().includes("not found")
          ? 404
          : message.toLowerCase().includes("invalid") || message.toLowerCase().includes("missing")
          ? 400
          : 500);
      res.status(status).json({ error: status === 500 ? "Failed to auto-plan travel" : message });
    }
  });

  app.post("/api/travel/trips", authenticateUser, requireRole("admin", "coordinator", "super_admin"), async (req: AuthRequest, res) => {
    try {
      const result = await savePlannedTrip(req.body, req.user?.id);
      
      // Send WhatsApp notification
      let notification = null;
      try {
        notification = await sendTravelPlanToTechnician(result.trip.id, req.user?.id);
      } catch (notifError: any) {
        console.error("Error sending travel plan to technician:", notifError);
        // Don't fail the whole request if notification fails
      }
      
      // Broadcast WebSocket event to refresh technician view
      if (typeof (global as any).broadcast === 'function' && result.trip.technicianId) {
        const broadcast = (global as any).broadcast;
        const tech = await storage.getTechnician(result.trip.technicianId).catch(() => null);
        const technicianUserId = tech?.userId;
        
        broadcast({
          type: 'service_request_assigned',
          timestamp: new Date().toISOString(),
          data: {
            technicianId: result.trip.technicianId,
            tripId: result.trip.id,
            pmTasksCount: result.scheduledPMRequests?.length || 0,
          },
        }, technicianUserId || undefined);
      }
      
      res.status(201).json({
        success: true,
        trip: result.trip,
        costs: result.costs,
        tasks: result.tasks,
        scheduledPMRequests: result.scheduledPMRequests || [],
        notifications: notification ? { whatsapp: notification } : null,
      });
    } catch (error: any) {
      console.error("Error saving travel trip:", error);
      const message = error?.message || "Failed to save trip";
      const status =
        error?.statusCode ||
        (message.toLowerCase().includes("not found")
          ? 404
          : message.toLowerCase().includes("invalid") || message.toLowerCase().includes("missing")
          ? 400
          : 500);
      res.status(status).json({ error: status === 500 ? "Failed to save trip" : message });
    }
  });

  app.patch("/api/travel/trips/:id/recalculate-cost", authenticateUser, requireRole("admin", "coordinator", "super_admin"), async (req: AuthRequest, res) => {
    try {
      const costs = await recalculateTripCosts(req.params.id);
      res.json({ success: true, costs });
    } catch (error: any) {
      console.error("Error recalculating costs:", error);
      const message = error?.message || "Failed to recalculate costs";
      const status =
        error?.statusCode ||
        (message.toLowerCase().includes("not found")
          ? 404
          : message.toLowerCase().includes("invalid") || message.toLowerCase().includes("missing")
          ? 400
          : 500);
      res.status(status).json({ error: status === 500 ? "Failed to recalculate costs" : message });
    }
  });

  // Technician Travel Planning API routes
  // POST /api/scheduling/travel/trips - Create a new technician trip
  app.post("/api/scheduling/travel/trips", authenticateUser, requireRole("admin", "coordinator", "super_admin"), async (req: AuthRequest, res) => {
    try {
      const {
        technicianId,
        origin,
        destinationCity,
        startDate,
        endDate,
        dailyWorkingTimeWindow,
        purpose,
        notes,
        travelFare,
        stayCost,
        dailyAllowance,
        localTravelCost,
        miscCost,
        currency
      } = req.body;

      // Validation
      if (!technicianId || !origin || !destinationCity || !startDate || !endDate) {
        return res.status(400).json({ error: "Missing required fields: technicianId, origin, destinationCity, startDate, endDate" });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end < start) {
        return res.status(400).json({ error: "endDate must be after startDate" });
      }

      // Verify technician exists
      const technician = await storage.getTechnician(technicianId);
      if (!technician) {
        return res.status(400).json({ error: "Invalid technicianId" });
      }

      // Create trip
      const trip = await storage.createTechnicianTrip({
        technicianId,
        origin,
        destinationCity,
        startDate: start,
        endDate: end,
        dailyWorkingTimeWindow: dailyWorkingTimeWindow || null,
        purpose: purpose || 'pm',
        notes: notes || null,
        tripStatus: 'planned',
        bookingStatus: 'not_started',
        createdBy: req.user?.id,
      });

      // Create initial cost breakdown
      const numberOfNights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const numberOfDays = numberOfNights + 1;

      // Auto-calculate costs if not provided
      const hotelRate = technician.hotelAllowance || 0;
      const daRate = technician.foodAllowance || 0; // Using foodAllowance as DA
      const localTravelRate = technician.localTravelAllowance || 0;

      const calculatedStayCost = (stayCost !== undefined ? parseFloat(stayCost) : numberOfNights * hotelRate).toFixed(2);
      const calculatedDailyAllowance = (dailyAllowance !== undefined ? parseFloat(dailyAllowance) : numberOfDays * daRate).toFixed(2);
      const calculatedLocalTravelCost = (localTravelCost !== undefined ? parseFloat(localTravelCost) : numberOfDays * localTravelRate).toFixed(2);

      await storage.updateTechnicianTripCosts(trip.id, {
        travelFare: travelFare || 0,
        stayCost: calculatedStayCost,
        dailyAllowance: calculatedDailyAllowance,
        localTravelCost: calculatedLocalTravelCost,
        miscCost: miscCost || 0,
        currency: currency || 'INR',
      });

      // Fetch complete trip with costs
      const tripWithCosts = await storage.getTechnicianTrip(trip.id);
      const costs = await storage.getTechnicianTripCosts(trip.id);

      res.status(201).json({
        ...tripWithCosts,
        costs,
      });
    } catch (error: any) {
      console.error("Error creating technician trip:", error);
      res.status(500).json({ error: "Failed to create technician trip", details: error.message });
    }
  });

  const isScheduler = (role?: string) =>
    ["admin", "coordinator", "super_admin"].includes((role || "").toLowerCase());
  const isTechnicianRole = (role?: string) => (role || "").toLowerCase() === "technician";

  const enrichTripTasks = async (tasks: any[]) => {
    return Promise.all(
      tasks.map(async (task) => {
        const container = task.containerId ? await storage.getContainer(task.containerId) : null;
        const customer = task.customerId ? await storage.getCustomer(task.customerId) : null;
        return {
          ...task,
          container: container ? { id: container.id, containerCode: container.containerCode } : null,
          customer: customer ? { id: customer.id, companyName: customer.companyName } : null,
        };
      })
    );
  };

  const sendTravelPlanToTechnician = async (tripId: string, userId?: string) => {
    const trip = await storage.getTechnicianTrip(tripId);
    if (!trip) {
      const err = new Error("Trip not found");
      (err as any).statusCode = 404;
      throw err;
    }
    if (!trip.technicianId) {
      const err = new Error("Trip does not have an assigned technician");
      (err as any).statusCode = 400;
      throw err;
    }

    const technician = await storage.getTechnician(trip.technicianId);
    if (!technician) {
      const err = new Error("Technician record not found");
      (err as any).statusCode = 400;
      throw err;
    }

    const technicianUser = technician.userId ? await storage.getUser(technician.userId).catch(() => null) : null;
    const technicianPhone =
      (technician as any).phone ||
      (technician as any).whatsappNumber ||
      (technicianUser as any)?.whatsappNumber ||
      (technicianUser as any)?.phoneNumber;

    if (!technicianPhone) {
      const err = new Error("Technician does not have a WhatsApp/phone number on file");
      (err as any).statusCode = 400;
      throw err;
    }

    const costs = await storage.getTechnicianTripCosts(trip.id);
    const rawTasks = await storage.getTechnicianTripTasks(trip.id);
    const enrichedTasks = await enrichTripTasks(rawTasks);
    
    // Count PM tasks
    const pmTasks = rawTasks.filter(t => t.taskType === 'pm');
    const pmCount = pmTasks.length;
    
    // Format dates
    const startDateStr = new Date(trip.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const endDateStr = new Date(trip.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    
    // Get total cost from trip costs
    const totalCostValue = costs?.totalEstimatedCost 
      ? parseFloat(costs.totalEstimatedCost.toString()).toLocaleString('en-IN')
      : 'N/A';
    
    const taskCount = rawTasks.length;
    
    // Create PM-specific message if PM tasks exist
    let message: string;
    if (pmCount > 0) {
      const loginUrl = process.env.FRONTEND_URL || 'https://your-domain.com';
      const techName = (technician as any).name || technicianUser?.name || "Technician";
      
      message = `✈️ Trip Assigned: ${trip.destinationCity} ${startDateStr} → ${endDateStr}. ${taskCount} PM tasks. Total Estimate: ₹${totalCostValue}\n\n` +
        `👨‍🔧 Technician: ${techName}\n` +
        `📍 City: ${trip.destinationCity}\n` +
        `📅 Dates: ${startDateStr} → ${endDateStr}\n` +
        `🔧 Total PM Tasks: ${pmCount}\n\n` +
        `🧾 Assigned Tasks:\n`;
      
      // Add PM task details
      const pmTaskDetails: string[] = [];
      for (const task of enrichedTasks.slice(0, 10)) {
        const container = task.container;
        const containerCode = container?.containerCode || task.containerId?.substring(0, 8) || 'N/A';
        const srNumber = task.serviceRequest?.requestNumber || 'PM Job';
        pmTaskDetails.push(`${srNumber} – ${containerCode} – PM`);
      }
      
      message += pmTaskDetails.join('\n');
      if (enrichedTasks.length > 10) {
        message += `\n...and ${enrichedTasks.length - 10} more tasks`;
      }
      
      message += `\n\n💰 Total Estimate: ₹${totalCostValue}\n\n` +
        `🔗 View Tasks:\n${loginUrl}/technician/my-tasks`;
    } else {
      // Use standard message for non-PM trips
      message = formatTravelPlanMessage({
        technicianName: (technician as any).name || technicianUser?.name || "Technician",
        origin: trip.origin,
        destination: trip.destinationCity,
        startDate: trip.startDate,
        endDate: trip.endDate,
        purpose: trip.purpose,
        notes: trip.notes,
        costs,
        tasks: enrichedTasks,
      });
    }

    await sendTextMessage(technicianPhone, message);
    await storage.createAuditLog({
      userId,
      action: "send_travel_plan",
      entityType: "technician_trip",
      entityId: trip.id,
      changes: { to: technicianPhone },
      source: "dashboard",
    });

    return { to: technicianPhone };
  };

  // GET /api/scheduling/travel/trips - List trips with filters
  app.get("/api/scheduling/travel/trips", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const { technicianId, startDate, endDate, destinationCity, tripStatus } = req.query;

      const filters: any = {};
      if (technicianId) filters.technicianId = technicianId as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (destinationCity) filters.destinationCity = destinationCity as string;
      if (tripStatus) filters.tripStatus = tripStatus as string;

      let technicianProfile;
      const userRole = (req.user?.role || "").toLowerCase();
      if (isTechnicianRole(userRole)) {
        technicianProfile = await storage.getTechnicianByUserId(req.user!.id);
        if (!technicianProfile) {
          return res.status(403).json({ error: "Technician profile not found" });
        }
        filters.technicianId = technicianProfile.id;
      }

      const trips = await storage.getTechnicianTrips(filters);

      // Enrich trips with costs and technician info
      const tripsWithCosts = await Promise.all(
        trips.map(async (trip) => {
          const costs = await storage.getTechnicianTripCosts(trip.id);
          const tasks = await storage.getTechnicianTripTasks(trip.id);
          const technician =
            trip.technicianId && !technicianProfile
              ? await storage.getTechnician(trip.technicianId)
              : technicianProfile;
          let technicianUser = null;
          if (technician?.userId) {
            try {
              const user = await storage.getUser(technician.userId);
              if (user) {
                technicianUser = { name: user.name, email: user.email };
              }
            } catch {
              technicianUser = null;
            }
          }
          return {
            ...trip,
            costs,
            tasksCount: tasks.length,
            technician: technician
              ? {
                  id: technician.id,
                  name: (technician as any).name || technicianUser?.name || null,
                  employeeCode: technician.employeeCode,
                  user: technicianUser,
                }
              : null,
          };
        })
      );

      res.json(tripsWithCosts);
    } catch (error: any) {
      console.error("Error fetching technician trips:", error);
      res.status(500).json({ error: "Failed to fetch technician trips", details: error.message });
    }
  });

  // GET /api/scheduling/travel/trips/:id - Get trip details
  app.get("/api/scheduling/travel/trips/:id", authenticateUser, async (req: AuthRequest, res) => {
    try {
      const trip = await storage.getTechnicianTrip(req.params.id);
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      const userRole = (req.user?.role || "").toLowerCase();
      if (isTechnicianRole(userRole)) {
        const technicianProfile = await storage.getTechnicianByUserId(req.user!.id);
        if (!technicianProfile || technicianProfile.id !== trip.technicianId) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }

      const costs = await storage.getTechnicianTripCosts(trip.id);
      const rawTasks = await storage.getTechnicianTripTasks(trip.id);
      const technician = trip.technicianId ? await storage.getTechnician(trip.technicianId) : null;

      const enrichedTasks = await enrichTripTasks(rawTasks);

      // Get technician user info if available
      let technicianUser = null;
      if (technician?.userId) {
        try {
          const user = await storage.getUser(technician.userId);
          if (user) {
            technicianUser = { name: user.name, email: user.email };
          }
        } catch (error) {
          // Ignore errors fetching user
        }
      }

      res.json({
        ...trip,
        costs,
        tasks: enrichedTasks,
        technician: technician ? {
          id: technician.id,
          name: (technician as any).name || technicianUser?.name || null,
          employeeCode: technician.employeeCode,
          user: technicianUser,
        } : null,
      });
    } catch (error: any) {
      console.error("Error fetching technician trip:", error);
      res.status(500).json({ error: "Failed to fetch technician trip", details: error.message });
    }
  });

  // PATCH /api/scheduling/travel/trips/:id - Update trip
  app.patch("/api/scheduling/travel/trips/:id", authenticateUser, requireRole("admin", "coordinator", "super_admin"), async (req: AuthRequest, res) => {
    try {
      const trip = await storage.getTechnicianTrip(req.params.id);
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      const {
        origin,
        destinationCity,
        startDate,
        endDate,
        dailyWorkingTimeWindow,
        purpose,
        notes,
        tripStatus,
        bookingStatus,
        ticketReference,
        hotelReference,
        bookingAttachments,
      } = req.body;

      const updateData: any = {};
      if (origin !== undefined) updateData.origin = origin;
      if (destinationCity !== undefined) updateData.destinationCity = destinationCity;
      if (startDate !== undefined) updateData.startDate = new Date(startDate);
      if (endDate !== undefined) updateData.endDate = new Date(endDate);
      if (dailyWorkingTimeWindow !== undefined) updateData.dailyWorkingTimeWindow = dailyWorkingTimeWindow;
      if (purpose !== undefined) updateData.purpose = purpose;
      if (notes !== undefined) updateData.notes = notes;
      if (tripStatus !== undefined) updateData.tripStatus = tripStatus;
      if (bookingStatus !== undefined) updateData.bookingStatus = bookingStatus;
      if (ticketReference !== undefined) updateData.ticketReference = ticketReference;
      if (hotelReference !== undefined) updateData.hotelReference = hotelReference;
      if (bookingAttachments !== undefined) updateData.bookingAttachments = bookingAttachments;

      // Validate dates if both are being updated
      if (updateData.startDate && updateData.endDate && updateData.endDate < updateData.startDate) {
        return res.status(400).json({ error: "endDate must be after startDate" });
      }

      const updatedTrip = await storage.updateTechnicianTrip(req.params.id, updateData);

      res.json(updatedTrip);
    } catch (error: any) {
      console.error("Error updating technician trip:", error);
      res.status(500).json({ error: "Failed to update technician trip", details: error.message });
    }
  });

  // DELETE /api/scheduling/travel/trips/:id - Soft delete (cancel) trip
  app.delete("/api/scheduling/travel/trips/:id", authenticateUser, requireRole("admin", "coordinator", "super_admin"), async (req: AuthRequest, res) => {
    try {
      const trip = await storage.getTechnicianTrip(req.params.id);
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      await storage.deleteTechnicianTrip(req.params.id);

      res.json({ message: "Trip cancelled successfully" });
    } catch (error: any) {
      console.error("Error cancelling technician trip:", error);
      res.status(500).json({ error: "Failed to cancel technician trip", details: error.message });
    }
  });

  // PATCH /api/scheduling/travel/trips/:id/cost - Update cost components
  app.patch("/api/scheduling/travel/trips/:id/cost", authenticateUser, requireRole("admin", "coordinator", "super_admin"), async (req: AuthRequest, res) => {
    try {
      const trip = await storage.getTechnicianTrip(req.params.id);
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      const {
        travelFare,
        stayCost,
        dailyAllowance,
        localTravelCost,
        miscCost,
        currency,
      } = req.body;

      const updateData: any = {};
      if (travelFare !== undefined) updateData.travelFare = travelFare.toString();
      if (stayCost !== undefined) updateData.stayCost = stayCost.toString();
      if (dailyAllowance !== undefined) updateData.dailyAllowance = dailyAllowance.toString();
      if (localTravelCost !== undefined) updateData.localTravelCost = localTravelCost.toString();
      if (miscCost !== undefined) updateData.miscCost = miscCost.toString();
      if (currency !== undefined) updateData.currency = currency;

      // Update costs (this will auto-recalculate total_estimated_cost)
      const updatedCosts = await storage.updateTechnicianTripCosts(req.params.id, updateData);

      res.json(updatedCosts);
    } catch (error: any) {
      console.error("Error updating trip costs:", error);
      res.status(500).json({ error: "Failed to update trip costs", details: error.message });
    }
  });

  // POST /api/scheduling/travel/trips/:id/auto-assign-tasks - Auto-assign PM/container tasks
  app.post("/api/scheduling/travel/trips/:id/auto-assign-tasks", authenticateUser, requireRole("admin", "coordinator", "super_admin"), async (req: AuthRequest, res) => {
    try {
      const trip = await storage.getTechnicianTrip(req.params.id);
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      const createdTasks = await generateTripTasksForDestination(req.params.id);
      const allTasks = await storage.getTechnicianTripTasks(req.params.id);

      res.json({
        message: `Auto-assigned ${createdTasks.length} tasks`,
        createdTasks: createdTasks.length,
        totalTasks: allTasks.length,
        tasks: allTasks,
      });
    } catch (error: any) {
      console.error("Error auto-assigning trip tasks:", error);
      res.status(500).json({ error: "Failed to auto-assign trip tasks", details: error.message });
    }
  });

  // POST /api/scheduling/travel/trips/:id/send-plan - Send travel plan summary via WhatsApp and assign PM tasks
  app.post("/api/scheduling/travel/trips/:id/send-plan", authenticateUser, requireRole("admin", "coordinator", "super_admin"), async (req: AuthRequest, res) => {
    try {
      const { db } = await import('./db');
      const { serviceRequests } = await import('@shared/schema');
      const { eq, sql } = await import('drizzle-orm');
      
      const trip = await storage.getTechnicianTrip(req.params.id);
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      if (!trip.technicianId) {
        return res.status(400).json({ error: "Trip does not have an assigned technician" });
      }

      const technician = await storage.getTechnician(trip.technicianId);
      if (!technician) {
        return res.status(404).json({ error: "Technician not found" });
      }

      // Get all trip tasks
      const tripTasks = await storage.getTechnicianTripTasks(req.params.id);
      
      // Count PM vs other tasks
      const pmTasks = tripTasks.filter(t => t.taskType === 'pm');
      const otherTasks = tripTasks.filter(t => t.taskType !== 'pm');
      const pmCount = pmTasks.length;
      const otherCount = otherTasks.length;
      
      // Auto-assign PM service requests
      const assignedPMRequests: string[] = [];
      for (const task of tripTasks) {
        if (task.taskType === 'pm' && task.serviceRequestId) {
          // Update existing PM service request
          try {
            const scheduledDate = task.scheduledDate ? new Date(task.scheduledDate) : new Date(trip.startDate);
            // Preserve existing status if already scheduled/in_progress, otherwise set to scheduled
            const existingRequest = await db
              .select({ status: serviceRequests.status })
              .from(serviceRequests)
              .where(eq(serviceRequests.id, task.serviceRequestId))
              .limit(1);
            
            const currentStatus = existingRequest[0]?.status?.toLowerCase() || 'pending';
            const newStatus = currentStatus === 'in_progress' 
              ? 'in_progress' 
              : (currentStatus === 'scheduled' ? 'scheduled' : 'scheduled');
            
            const bookingMetadata = {
              bookingStatus: 'confirmed',
              techBookingSource: 'auto_pm_travel',
              purpose: 'PM',
              travelTripId: trip.id,
            };
            
            await db
              .update(serviceRequests)
              .set({
                assignedTechnicianId: trip.technicianId,
                status: newStatus,
                scheduledDate: scheduledDate,
                scheduledTimeWindow: '09:00-17:00',
                assignedBy: req.user?.id || 'AUTO',
                assignedAt: new Date(),
                // Store booking status and metadata in excelData field
                excelData: sql`COALESCE(${serviceRequests.excelData}, '{}'::jsonb) || ${JSON.stringify(bookingMetadata)}::jsonb`,
              })
              .where(eq(serviceRequests.id, task.serviceRequestId));
            
            assignedPMRequests.push(task.serviceRequestId);
          } catch (updateError: any) {
            console.error(`[API] Error updating PM service request ${task.serviceRequestId}:`, updateError);
          }
        } else if (task.taskType === 'pm' && !task.serviceRequestId && task.containerId) {
          // Create PM service request if it doesn't exist
          try {
            const container = await storage.getContainer(task.containerId);
            if (container && container.currentCustomerId) {
              const allUsers = await storage.getAllUsers();
              const adminUser = allUsers.find((u: any) => ['admin', 'super_admin'].includes(u.role?.toLowerCase()));
              const createdBy = adminUser?.id || allUsers[0]?.id;
              
              if (createdBy) {
                const timestamp = Date.now();
                const requestNumber = `SR-PM-${timestamp}`;
                const scheduledDate = task.scheduledDate ? new Date(task.scheduledDate) : new Date(trip.startDate);
                
                const newRequest = await storage.createServiceRequest({
                  requestNumber: requestNumber,
                  containerId: task.containerId,
                  customerId: container.currentCustomerId,
                  priority: 'normal',
                  status: 'scheduled',
                  issueDescription: `Preventive Maintenance - Container ${container.containerCode || container.id} (90-day threshold)`,
                  requestedAt: new Date(),
                  createdBy: createdBy,
                  workType: 'SERVICE-AT SITE',
                  jobType: 'FOC',
                  assignedTechnicianId: trip.technicianId,
                  scheduledDate: scheduledDate,
                  scheduledTimeWindow: '09:00-17:00',
                  assignedBy: req.user?.id || 'AUTO',
                  assignedAt: new Date(),
                  excelData: {
                    bookingStatus: 'confirmed',
                    techBookingSource: 'auto_pm_travel',
                    purpose: 'PM',
                    travelTripId: trip.id,
                  },
                });
                
                assignedPMRequests.push(newRequest.id);
              }
            }
          } catch (createError: any) {
            console.error(`[API] Error creating PM service request for container ${task.containerId}:`, createError);
          }
        }
      }

      // Update trip booking status to 'sent' and trip_status to 'confirmed'
      try {
        await storage.updateTechnicianTrip(req.params.id, {
          bookingStatus: 'all_confirmed',
          tripStatus: 'confirmed',
        });
      } catch (tripUpdateError: any) {
        console.error(`[API] Error updating trip booking status:`, tripUpdateError);
      }

      // Send WhatsApp notification using existing helper
      const technicianUser = technician.userId ? await storage.getUser(technician.userId).catch(() => null) : null;
      const technicianPhone =
        (technician as any).phone ||
        (technician as any).whatsappNumber ||
        (technicianUser as any)?.whatsappNumber ||
        (technicianUser as any)?.phoneNumber;

      if (technicianPhone) {
        try {
          const startDateStr = new Date(trip.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
          const endDateStr = new Date(trip.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
          
          const whatsappMessage = `✈️ New Trip Assigned\n\n` +
            `City: ${trip.destinationCity}\n` +
            `Dates: ${startDateStr} – ${endDateStr}\n` +
            `Total tasks: ${pmCount} (PM) + ${otherCount} (other).\n` +
            `Please check your app for details.`;
          
          const { sendTextMessage } = await import('./services/whatsapp');
          await sendTextMessage(technicianPhone, whatsappMessage);
          
          console.log(`[API] WhatsApp sent to ${technicianPhone} for trip ${trip.id}`);
        } catch (whatsappError: any) {
          console.error(`[API] Error sending WhatsApp:`, whatsappError);
          // Don't fail the whole request if WhatsApp fails
        }
      }
      
      // Broadcast WebSocket event to refresh technician views
      if (typeof (global as any).broadcast === 'function') {
        const broadcast = (global as any).broadcast;
        const technicianUserId = technician.userId;
        
        const startDateStr = new Date(trip.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const endDateStr = new Date(trip.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        
        broadcast({
          type: 'service_request_assigned',
          timestamp: new Date().toISOString(),
          data: {
            technicianId: trip.technicianId,
            tripId: trip.id,
            pmTasksCount: pmCount,
            message: `✈️ Travel Trip Assigned for PM in ${trip.destinationCity}. Dates: ${startDateStr} - ${endDateStr}. Assigned Tasks: ${pmCount}.`,
          },
        }, technicianUserId || undefined);
      }

      res.json({ 
        success: true,
        message: "Travel plan sent to technician", 
        assignedPMRequests: assignedPMRequests.length,
        pmCount: pmCount,
        otherCount: otherCount,
      });
    } catch (error: any) {
      console.error("Error sending travel plan:", error);
      console.error("Error stack:", error?.stack);
      const message = error?.message || "Failed to send travel plan";
      const status = error?.statusCode || (message.toLowerCase().includes("not found") ? 404 : 500);
      res.status(status).json({ error: status === 500 ? "Failed to send travel plan" : message, details: error?.message });
    }
  });

  // PATCH /api/scheduling/travel/trips/:tripId/tasks/:taskId - Update trip task status
  app.patch("/api/scheduling/travel/trips/:tripId/tasks/:taskId", authenticateUser, requireRole("admin", "coordinator", "super_admin"), async (req: AuthRequest, res) => {
    try {
      const { status, completedAt } = req.body;
      const task = await storage.updateTechnicianTripTask(req.params.taskId, {
        status,
        completedAt: status === 'completed' ? new Date() : completedAt,
      });
      res.json(task);
    } catch (error: any) {
      console.error("Error updating trip task:", error);
      res.status(500).json({ error: "Failed to update trip task", details: error.message });
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
      // TODO: Implement sendFeedbackReminder function
      // const { sendFeedbackReminder } = await import('./services/feedback-collection');
      // await sendFeedbackReminder(serviceRequestId);
      res.json({ message: "Feedback reminder functionality not yet implemented" });
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

      // Check for duplicate alerts - prevent spamming
      const existingAlerts = await storage.getAlertsByContainer(containerId);
      const recentAlert = existingAlerts.find(a =>
        a.alertType === alertType &&
        a.status === 'open' &&
        // Check if alert was created in the last 2 minutes
        new Date(a.detectedAt).getTime() > (Date.now() - 2 * 60 * 1000)
      );

      if (recentAlert) {
        return res.status(409).json({
          error: "Duplicate alert detected",
          message: `A similar ${alertType} alert already exists for this container (created ${Math.floor((Date.now() - new Date(recentAlert.detectedAt).getTime()) / 1000)}s ago). Please wait before creating another alert.`,
          existingAlertId: recentAlert.id
        });
      }

      const simulatedAlert = {
        containerId,
        alertCode: `SIM_${alertType.toUpperCase()}_${Date.now()}`,
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
      // TODO: Implement registerAllTemplates function
      res.json({ message: "Template registration not yet implemented" });
    } catch (error) {
      res.status(500).json({ error: "Template registration failed" });
    }
  });

  app.get("/api/whatsapp/templates", async (req, res) => {
    try {
      // TODO: Implement getWhatsAppTemplates function
      res.json({ templates: [], localTemplates: {} });
    } catch (error) {
      console.error("Templates fetch error:", error);
      res.json({ templates: [], localTemplates: {} });
    }
  });

  app.post("/api/whatsapp/templates/register", async (req, res) => {
    try {
      // TODO: Implement registerWhatsAppTemplate function
      res.json({ message: "Template registration not yet implemented" });
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
      // TODO: Implement deleteWhatsAppTemplate function
      res.json({ message: "Template deletion not yet implemented" });
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
        error: error instanceof Error ? error.message : 'Unknown error'
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

      const { getOrbcommClient } = await import('./services/orbcommClient');
      const orbcommClient = getOrbcommClient();

      if (!orbcommClient || !orbcommClient.isConnected) {
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
          container.containerCode === (deviceData as any).lastAssetId ||
          container.containerCode === orbcommDevice.deviceId
        );

        if (!matchingContainer) {
          console.log(`⚠️ No matching container found for Reefer ID: ${(deviceData as any).lastAssetId || orbcommDevice.deviceId}`);
          continue;
        }

        console.log(`✅ Matched Reefer ID ${(deviceData as any).lastAssetId || orbcommDevice.deviceId} to Container ${matchingContainer.containerCode}`);

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
        const oem = (deviceData as any).oem || (deviceData as any).OEM || 'ORBCOMM';

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
          reeferId: (deviceData as any).lastAssetId || orbcommDevice.deviceId,
          containerId: matchingContainer.containerCode,
          event: (deviceData as any).eventType || 'Status Update',
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
          reporting: (deviceData as any).reportingInterval || '15 min', // Default ORBCOMM reporting interval
          geofenceRevision: 'N/A',
          cellG: (deviceData as any).cellularType || '4G',
          cellSi: (deviceData as any).signalStrength ? `${(deviceData as any).signalStrength}/5` : 'N/A',
          comments: errorCodes.length > 0 ? errorCodes.join(', ') : 'Normal',
          reeferId: (deviceData as any).lastAssetId || orbcommDevice.deviceId,
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
  app.post('/api/admin/whatsapp/verify-client', authenticateUser, requireRole('admin', 'super_admin', 'coordinator'), async (req, res) => {
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
  app.post('/api/admin/whatsapp/revoke-client', authenticateUser, requireRole('admin', 'super_admin', 'coordinator'), async (req, res) => {
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
  app.get('/api/admin/whatsapp/users', authenticateUser, requireRole('admin', 'super_admin', 'coordinator'), async (req, res) => {
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
  app.post('/api/admin/whatsapp/send-text', authenticateUser, requireRole('admin', 'super_admin', 'coordinator'), async (req, res) => {
    try {
      const { to, text } = req.body || {};
      if (!to || !text) return res.status(400).json({ error: 'to and text required' });
      const result = await sendTextMessage(String(to).replace(/\D/g, ''), text);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to send text' });
    }
  });

  app.post('/api/admin/whatsapp/send-template', authenticateUser, requireRole('admin', 'super_admin', 'coordinator'), async (req, res) => {
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
  app.post("/api/manuals/:id/process", authenticateUser, requireRole("admin", "super_admin"), async (req: AuthRequest, res) => {
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
