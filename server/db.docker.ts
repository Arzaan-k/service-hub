import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// =============================================================================
// Database Connection Configuration - Standard PostgreSQL
// =============================================================================
// This file is used for Docker/local PostgreSQL deployment
// It uses the standard 'pg' driver instead of Neon serverless
// =============================================================================

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

console.log('[DATABASE] Using standard PostgreSQL driver (pg)');

// Create connection pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Connection pool settings
  max: 20,                      // Maximum connections in pool
  idleTimeoutMillis: 30000,     // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Timeout for new connections
});

// Connection event handlers
pool.on('connect', () => {
  console.log('[DATABASE] ✅ Connected to PostgreSQL');
});

pool.on('error', (err: Error) => {
  console.error('[DATABASE] ❌ Unexpected error on idle client:', err);
});

// Create Drizzle instance
export const db = drizzle(pool, { schema });

console.log('[DATABASE] ✅ PostgreSQL connection configured');

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
