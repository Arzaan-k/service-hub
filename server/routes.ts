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
} from "./services/whatsapp";
import { runDailyScheduler, startScheduler } from "./services/scheduling";

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
  app.get("/api/dashboard/stats", authenticateUser, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Container routes
  app.get("/api/containers", authenticateUser, async (req, res) => {
    try {
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

  // Alert routes
  app.get("/api/alerts", authenticateUser, async (req, res) => {
    try {
      const alerts = await storage.getAllAlerts();
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  app.get("/api/alerts/open", authenticateUser, async (req, res) => {
    try {
      const alerts = await storage.getOpenAlerts();
      res.json(alerts);
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
      if (["critical", "high"].includes(classification.severity) && container.assignedClientId) {
        const client = await storage.getClient(container.assignedClientId);
        if (client) {
          const clientUser = await storage.getUser(client.userId);
          if (clientUser) {
            const message = formatAlertMessage(alert, container);
            await sendInteractiveButtons(clientUser.phoneNumber, message, [
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

  // Service Request routes
  app.get("/api/service-requests", authenticateUser, async (req, res) => {
    try {
      const requests = await storage.getAllServiceRequests();
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch service requests" });
    }
  });

  app.get("/api/service-requests/pending", authenticateUser, async (req, res) => {
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

  // Clients routes
  app.get("/api/clients", authenticateUser, async (req, res) => {
    try {
      // This would need a getAllClients method in storage
      res.json([]);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch clients" });
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
      const iotContainers = containers.filter((c) => c.containerType === "iot_enabled" && c.orbcommDeviceId);

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
              address: "Location updated",
            },
            lastSyncTime: new Date(),
            healthScore: anomalies.length === 0 ? 100 : Math.max(100 - anomalies.length * 20, 0),
          });

          // Create alerts for anomalies
          if (anomalies.length > 0) {
            for (const anomaly of anomalies) {
              const classification = await classifyAlert(anomaly, `Detected: ${anomaly}`, container);

              await storage.createAlert({
                alertCode: `ALT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                containerId: container.id,
                severity: classification.severity,
                status: "open",
                title: classification.category.replace(/_/g, " ").toUpperCase(),
                description: `Anomaly detected: ${anomaly}`,
                aiClassification: classification,
                errorCode: anomaly,
                detectedAt: new Date(),
                resolutionSteps: classification.resolutionSteps,
                requiredParts: classification.requiredParts,
                estimatedServiceTime: classification.estimatedServiceTime,
              });
            }

            broadcast({ type: "anomaly_detected", data: { containerId: container.id, anomalies } });
          }

          results.push({ containerId: container.containerId, status: "success", anomalies });
        } catch (error) {
          console.error(`Error polling container ${container.containerId}:`, error);
          results.push({ containerId: container.containerId, status: "error" });
        }
      }

      res.json({ polled: iotContainers.length, results });
    } catch (error) {
      res.status(500).json({ error: "Polling failed" });
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
            sessionId: session.id,
            messageId: message.id,
            direction: "inbound",
            messageType: message.type,
            content: message,
            timestamp: new Date(),
          });

          // Handle message based on type and user role
          if (message.type === "text") {
            const text = message.text.body.toLowerCase();

            if (authResult.user.role === "client") {
              // Client commands
              if (text.includes("status") || text.includes("container")) {
                const client = await storage.getClientByUserId(authResult.user.id);
                if (client) {
                  const containers = await storage.getContainersByClient(client.id);
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

  // Start scheduler
  startScheduler();

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
