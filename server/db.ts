import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from "@shared/schema";

// =============================================================================
// Database Connection Configuration
// =============================================================================
// Uses Neon HTTP driver (more stable than WebSocket for Node.js v22)
// For Docker/local PostgreSQL, set USE_STANDARD_PG=true and the application
// will need to be started with the pg driver variant
// =============================================================================

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create HTTP-based Neon connection (more stable than WebSocket)
const sql = neon(process.env.DATABASE_URL);

// Create Drizzle instance with HTTP client
export const db = drizzle(sql, { schema });

// For backward compatibility, export a dummy pool object
export const pool = {
  end: async () => {
    console.log('[DATABASE] HTTP connection closed');
  }
};

console.log('[DATABASE] ✅ Neon HTTP connection configured');

// =============================================================================
// Graceful Shutdown Helper
// =============================================================================
export async function closeDatabase(): Promise<void> {
  try {
    if (pool && typeof pool.end === 'function') {
      await pool.end();
      console.log('[DATABASE] Connection pool closed');
    }
  } catch (err) {
    console.error('[DATABASE] Error closing connection pool:', err);
  }
}
