import { config } from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from .env file first, then .env.development to override
const envPath = path.join(process.cwd(), '.env');
const envDevPath = path.join(process.cwd(), '.env.development');

// Load .env first (base configuration)
if (fs.existsSync(envPath)) {
  config({ path: envPath });
}

// Then load .env.development to override in development mode
if (fs.existsSync(envDevPath) && process.env.NODE_ENV === 'development') {
  config({ path: envDevPath, override: true });
  console.log('✅ Loaded .env.development with overrides');
}

if (!fs.existsSync(envPath) && !fs.existsSync(envDevPath)) {
  console.log('Warning: No .env or .env.development file found');
}

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeOrbcommConnection, populateOrbcommDevices } from "./services/orbcomm";
import { startOrbcommIntegration } from "./services/orbcommIntegration";
import { vectorStore } from "./services/vectorStore";
import { db } from "./db";

const app = express();

// Ensure wage columns exist in database
async function ensureWageColumns() {
  try {
    console.log('🔍 Checking for wage columns in technicians table...');

    // Check if wage columns exist
    const columnsResult = await db.execute(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'technicians' AND table_schema = 'public'
      AND column_name IN ('grade', 'designation', 'hotel_allowance', 'local_travel_allowance', 'food_allowance', 'personal_allowance')
    `);

    const existingColumns = columnsResult.rows.map(row => row.column_name);
    const requiredColumns = ['grade', 'designation', 'hotel_allowance', 'local_travel_allowance', 'food_allowance', 'personal_allowance'];
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

    if (missingColumns.length > 0) {
      console.log('📝 Adding missing wage columns:', missingColumns);

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

      console.log('🎉 All wage columns added successfully!');
    } else {
      console.log('✅ All wage columns already exist');
    }
  } catch (error) {
    console.error('❌ Error ensuring wage columns:', error);
    throw error;
  }
}

// Enable CORS (allow custom auth header)
app.use(cors({
  origin: true, // Reflect the request origin
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-user-id']
}));
// Handle preflight
app.options('*', cors({
  origin: true, // Reflect the request origin
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
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

  // Initialize vector store for RAG functionality
  console.log('[SERVER] Initializing vector store for RAG...');
  try {
    await vectorStore.initializeCollection();
    console.log('✅ Vector store initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing vector store:', error);
    // Don't fail server startup for vector store issues
  }

  // Ensure database schema is up to date
  console.log('[SERVER] Checking database schema...');
  try {
    await ensureWageColumns();
    console.log('✅ Database schema verified');
  } catch (error) {
    console.error('❌ Error ensuring database schema:', error);
    // Don't fail server startup for schema issues
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error('[SERVER] Error handler caught:', err);
    res.status(status).json({ message });
    // Don't throw here - error is already handled
  });

  // Initialize Orbcomm Production connection
  console.log('[SERVER] Checking Orbcomm initialization conditions:');
  console.log('[SERVER] NODE_ENV:', process.env.NODE_ENV);
  console.log('[SERVER] ENABLE_ORBCOMM_DEV:', process.env.ENABLE_ORBCOMM_DEV);

  if (process.env.NODE_ENV !== 'development' || process.env.ENABLE_ORBCOMM_DEV === 'true' || process.env.FORCE_ORBCOMM_DEV === 'true') {
    // console.log('[SERVER] Initializing Orbcomm connection...');
    // try {
    //   await initializeOrbcommConnection();
    //
    //   // Populate database with production devices
    //   setTimeout(async () => {
    //     try {
    //       await populateOrbcommDevices();
    //     } catch (error) {
    //       console.error('❌ Error populating Orbcomm devices:', error);
    //     }
    //   }, 5000); // Wait 5 seconds after server start
    // } catch (error) {
    //   console.error('❌ Error initializing Orbcomm connection:', error);
    // }

    // Initialize Orbcomm CDH WebSocket Integration
    console.log('[SERVER] Initializing Orbcomm CDH WebSocket integration...');
    try {
      await startOrbcommIntegration();
      console.log('✅ Orbcomm CDH integration started successfully');
    } catch (error) {
      console.error('❌ Error starting Orbcomm CDH integration:', error);
    }
  } else {
    console.log('⏭️ Skipping Orbcomm initialization in development mode');
  }

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  console.log('[SERVER] NODE_ENV:', process.env.NODE_ENV);

  // Default to using Vite dev server in development
  const useVite = process.env.NODE_ENV === "development" && process.env.USE_VITE_DEV !== "false";

  if (useVite) {
    console.log('[SERVER] Setting up Vite development server');
    await setupVite(app, server);
  } else if (process.env.NODE_ENV === "development") {
    console.log('[SERVER] Serving static files in development mode for testing');
    serveStatic(app);
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
