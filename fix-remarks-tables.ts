/**
 * Fix remarks and recordings tables - recreate with correct column names
 */

import { config } from 'dotenv';
config();

import { neon } from '@neondatabase/serverless';

async function fixTables() {
  const sql = neon(process.env.DATABASE_URL!);
  
  console.log('🔄 Fixing remarks and recordings tables...\n');
  
  try {
    // Drop existing tables
    console.log('📋 Dropping existing tables...');
    await sql`DROP TABLE IF EXISTS service_request_recordings CASCADE`;
    await sql`DROP TABLE IF EXISTS service_request_remarks CASCADE`;
    console.log('✅ Old tables dropped\n');

    // Create service_request_remarks table with snake_case columns
    console.log('📋 Creating service_request_remarks table...');
    await sql`
      CREATE TABLE service_request_remarks (
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

    // Create service_request_recordings table with snake_case columns
    console.log('📋 Creating service_request_recordings table...');
    await sql`
      CREATE TABLE service_request_recordings (
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
    await sql`CREATE INDEX idx_remarks_service_request ON service_request_remarks(service_request_id)`;
    await sql`CREATE INDEX idx_recordings_service_request ON service_request_recordings(service_request_id)`;
    await sql`CREATE INDEX idx_remarks_created_at ON service_request_remarks(created_at)`;
    await sql`CREATE INDEX idx_recordings_created_at ON service_request_recordings(created_at)`;
    console.log('✅ Indexes created\n');

    // Verify columns
    console.log('📋 Verifying table structure...');
    const remarksColumns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'service_request_remarks'
      ORDER BY ordinal_position
    `;
    console.log('service_request_remarks columns:');
    remarksColumns.forEach((col: any) => console.log(`  - ${col.column_name}: ${col.data_type}`));

    const recordingsColumns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'service_request_recordings'
      ORDER BY ordinal_position
    `;
    console.log('\nservice_request_recordings columns:');
    recordingsColumns.forEach((col: any) => console.log(`  - ${col.column_name}: ${col.data_type}`));

    console.log('\n' + '='.repeat(50));
    console.log('✅ Tables fixed successfully!');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }
}

fixTables();
