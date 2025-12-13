import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config();

async function runTechnicianMigrations() {
  const sql = neon(process.env.DATABASE_URL!);
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in .env file');
    process.exit(1);
  }

  console.log('🚀 Starting Technician Documents Migrations');
  console.log('=' .repeat(80));
  console.log('⚠️  SAFE MODE: Only adding new tables/columns (no deletions)');
  console.log('=' .repeat(80));

  try {
    // Migration 1: Add columns to technicians table and create technician_documents table
    console.log('\n📦 Running Migration 1: Add technician_documents table...');
    
    await sql`
      -- Add password setup and document submission fields to technicians table
      ALTER TABLE technicians 
      ADD COLUMN IF NOT EXISTS password_setup_token VARCHAR(255),
      ADD COLUMN IF NOT EXISTS password_setup_token_expiry TIMESTAMP,
      ADD COLUMN IF NOT EXISTS documents_submitted BOOLEAN DEFAULT false
    `;
    console.log('✅ Added columns to technicians table');

    await sql`
      -- Create technician_documents table
      CREATE TABLE IF NOT EXISTS technician_documents (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        technician_id VARCHAR(255) NOT NULL,
        document_type VARCHAR(100) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        file_url TEXT NOT NULL,
        file_size BIGINT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT fk_technician_documents_technician 
          FOREIGN KEY (technician_id) 
          REFERENCES technicians(id) 
          ON DELETE CASCADE,
        
        CONSTRAINT unique_technician_document_type 
          UNIQUE (technician_id, document_type)
      )
    `;
    console.log('✅ Created technician_documents table');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_tech_docs_technician_id 
      ON technician_documents(technician_id)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_tech_docs_document_type 
      ON technician_documents(document_type)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_technicians_password_token 
      ON technicians(password_setup_token)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_technicians_documents_submitted 
      ON technicians(documents_submitted)
    `;
    console.log('✅ Created indexes');

    // Migration 2: Add binary storage columns
    console.log('\n📦 Running Migration 2: Add binary storage columns...');
    
    await sql`
      ALTER TABLE technician_documents
      ADD COLUMN IF NOT EXISTS file_data BYTEA,
      ADD COLUMN IF NOT EXISTS content_type VARCHAR(100)
    `;
    console.log('✅ Added file_data and content_type columns');

    await sql`
      ALTER TABLE technician_documents
      ALTER COLUMN file_url DROP NOT NULL
    `;
    console.log('✅ Made file_url optional');

    // Verify the table exists
    const result = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = 'technician_documents'
    `;

    if (result.length > 0) {
      console.log('\n✅ SUCCESS: technician_documents table created and verified');
      
      // Show columns
      const columns = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'technician_documents'
        ORDER BY ordinal_position
      `;
      
      console.log('\n📋 Table structure:');
      console.table(columns);
    } else {
      console.error('❌ Table verification failed');
      process.exit(1);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ All migrations completed successfully!');
    console.log('🎯 The "Send Reminder" feature should now work.');
    console.log('💡 Restart your server: npm run dev');
    console.log('='.repeat(80));

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

runTechnicianMigrations();
