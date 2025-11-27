
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Starting migration for Service Reports...');

  try {
    // Add columns to service_requests if they don't exist
    console.log('Adding coordinator remarks columns...');
    await db.execute(sql`
      ALTER TABLE service_requests 
      ADD COLUMN IF NOT EXISTS coordinator_remarks TEXT,
      ADD COLUMN IF NOT EXISTS remarks_added_by VARCHAR(255),
      ADD COLUMN IF NOT EXISTS remarks_added_at TIMESTAMP
    `);

    // Create service_report_pdfs table if it doesn't exist
    console.log('Creating service_report_pdfs table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS service_report_pdfs (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
        service_request_id VARCHAR(255) NOT NULL REFERENCES service_requests(id),
        report_stage VARCHAR(255) NOT NULL,
        file_url TEXT NOT NULL,
        file_size INTEGER,
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        emailed_at TIMESTAMP,
        email_recipients TEXT[],
        status VARCHAR(255) DEFAULT 'generated'
      )
    `);

    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
