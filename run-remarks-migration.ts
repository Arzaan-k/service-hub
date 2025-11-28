/**
 * Migration Script: Create remarks and recordings tables
 */

import { config } from 'dotenv';
config();

import { neon } from '@neondatabase/serverless';

async function runMigration() {
  const sql = neon(process.env.DATABASE_URL!);
  
  console.log('🔄 Creating remarks and recordings tables...\n');
  
  try {
    // Create service_request_remarks table
    console.log('📋 Creating service_request_remarks table...');
    await sql`
      CREATE TABLE IF NOT EXISTS service_request_remarks (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        service_request_id VARCHAR NOT NULL,
        user_id VARCHAR,
        user_name TEXT NOT NULL,
        user_role TEXT NOT NULL,
        remark_text TEXT NOT NULL,
        is_system_generated BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ service_request_remarks table created\n');

    // Create service_request_recordings table
    console.log('📋 Creating service_request_recordings table...');
    await sql`
      CREATE TABLE IF NOT EXISTS service_request_recordings (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        service_request_id VARCHAR NOT NULL,
        remark_id VARCHAR,
        uploaded_by VARCHAR,
        uploaded_by_name TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        original_file_size INTEGER,
        duration_seconds INTEGER,
        mime_type TEXT,
        is_compressed BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ service_request_recordings table created\n');

    // Create indexes
    console.log('📋 Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_remarks_service_request ON service_request_remarks(service_request_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_recordings_service_request ON service_request_recordings(service_request_id)`;
    console.log('✅ Indexes created\n');

    // Add old_request_number column if not exists
    console.log('📋 Ensuring old_request_number column exists...');
    await sql`ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS old_request_number TEXT`;
    console.log('✅ old_request_number column ready\n');

    console.log('='.repeat(50));
    console.log('✅ All migrations completed successfully!');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
