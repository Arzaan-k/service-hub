import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

<<<<<<< HEAD
=======
/**
 * Simple console logger with timestamp.
 */
>>>>>>> all-ui-working
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

<<<<<<< HEAD
=======
/**
 * Sets up Vite in middleware mode for Express during development.
 */
>>>>>>> all-ui-working
export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
<<<<<<< HEAD
        console.error('[VITE] Error occurred but continuing:', msg);
=======
        console.error("[VITE] Error occurred but continuing:", msg);
>>>>>>> all-ui-working
      },
    },
    server: serverOptions,
    appType: "custom",
  });

<<<<<<< HEAD
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    // Skip API routes - let them be handled by the API routes
    if (url.startsWith('/api/')) {
=======
  /**
   * Middleware to serve client through Vite
   * (except API routes)
   */
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    // Skip API routes
    if (url.startsWith("/api/")) {
>>>>>>> all-ui-working
      return next();
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
<<<<<<< HEAD
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
=======
        "index.html"
      );

      // Always reload index.html from disk (in case of changes)
      let template = await fs.promises.readFile(clientTemplate, "utf-8");

      // Bust Vite cache for main.tsx on reload
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );

>>>>>>> all-ui-working
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
<<<<<<< HEAD
=======
      console.error("[VITE] Middleware error:", e);
>>>>>>> all-ui-working
      next(e);
    }
  });
}

<<<<<<< HEAD
=======
/**
 * Serves static files in production mode.
 */
>>>>>>> all-ui-working
export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
<<<<<<< HEAD
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
=======
      `Could not find the build directory: ${distPath}. Please build the client first.`
    );
  }

  // Serve built static files
  app.use(express.static(distPath));

  // Fallback to index.html for SPA routing
>>>>>>> all-ui-working
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
