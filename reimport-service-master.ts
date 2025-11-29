import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';
import { execSync } from 'child_process';

async function reimportServiceMaster() {
  console.log('🗑️  Clearing existing service history data...');

  try {
    // Clear existing data
    await db.execute(sql`TRUNCATE TABLE service_history RESTART IDENTITY`);
    console.log('✅ Service history table cleared\n');

    // Run the import script
    console.log('📥 Starting import from Service Master.xlsx...\n');
    execSync('npx tsx import-service-master-complete.ts', { stdio: 'inherit' });

    console.log('\n✅ Re-import completed successfully!');
  } catch (error) {
    console.error('❌ Error during re-import:', error);
    process.exit(1);
  }
}

reimportServiceMaster();
