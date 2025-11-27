import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { neon } from '@neondatabase/serverless';

config();

async function runMigration() {
  const sql = neon(process.env.DATABASE_URL!);
  
  try {
    console.log('📦 Running migration: 0004_add_start_time_column.sql');
    
    // Add start_time column
    await sql`
      ALTER TABLE service_requests 
      ADD COLUMN IF NOT EXISTS start_time TIMESTAMP
    `;
    
    console.log('✅ Column "start_time" added to service_requests table');
    
    // Add comment
    await sql`
      COMMENT ON COLUMN service_requests.start_time IS 'Actual service start time when technician clicks Start Service in WhatsApp'
    `;
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
