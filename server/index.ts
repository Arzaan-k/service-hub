import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeOrbcommConnection, populateOrbcommDevices } from "./services/orbcomm";

const app = express();

// Enable CORS (allow custom auth header)
app.use(cors({
  origin: true, // Reflect the request origin
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-user-id']
}));
// Handle preflight
app.options('*', cors({
  origin: true, // Reflect the request origin
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-user-id']
}));

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  console.log(`[REQUEST] ${req.method} ${req.url} from ${req.ip}`);
  
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Initialize Orbcomm Production connection
  console.log('[SERVER] Checking Orbcomm initialization conditions:');
  console.log('[SERVER] NODE_ENV:', process.env.NODE_ENV);
  console.log('[SERVER] ENABLE_ORBCOMM_DEV:', process.env.ENABLE_ORBCOMM_DEV);
  
  if (process.env.NODE_ENV !== 'development' || process.env.ENABLE_ORBCOMM_DEV === 'true') {
    console.log('[SERVER] Initializing Orbcomm connection...');
    try {
      await initializeOrbcommConnection();

      // Populate database with production devices
      setTimeout(async () => {
        try {
          await populateOrbcommDevices();
        } catch (error) {
          console.error('❌ Error populating Orbcomm devices:', error);
        }
      }, 5000); // Wait 5 seconds after server start
    } catch (error) {
      console.error('❌ Error initializing Orbcomm connection:', error);
    }
  } else {
    console.log('⏭️ Skipping Orbcomm initialization in development mode');
  }

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  console.log('[SERVER] NODE_ENV:', process.env.NODE_ENV);
  // For testing, let's serve static files in development too
  if (process.env.NODE_ENV === "development" && process.env.USE_VITE_DEV !== "true") {
    console.log('[SERVER] Serving static files in development mode for testing');
    serveStatic(app);
  } else if (process.env.NODE_ENV === "development") {
    console.log('[SERVER] Setting up Vite development server');
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  console.log(`[SERVER] Attempting to listen on all interfaces port ${port}`);
  
  // Try multiple binding strategies for maximum compatibility
  server.listen(port, '0.0.0.0', () => {
    log(`serving on port ${port}`);
    console.log(`[SERVER] Server is now listening on all interfaces port ${port}`);
    console.log(`[SERVER] Try accessing at: http://localhost:${port}`);
    console.log(`[SERVER] Process ID: ${process.pid}`);
    console.log(`[SERVER] NODE_ENV: ${process.env.NODE_ENV}`);
  });
  
  // Also listen on IPv6
  server.listen(port, '::', () => {
    console.log(`[SERVER] Server is also listening on IPv6 port ${port}`);
  });
  
  // Add error handling for the server
  server.on('error', (err) => {
    console.error('[SERVER] Server error:', err);
  });
  
  // Log when the server starts listening
  server.on('listening', () => {
    const addr = server.address();
    console.log(`[SERVER] Server listening on ${JSON.stringify(addr)}`);
  });
  
  process.on('SIGINT', () => {
    console.log('[SERVER] Received SIGINT, shutting down gracefully');
    server.close(() => {
      console.log('[SERVER] Server closed');
      process.exit(0);
    });
  });
})();
