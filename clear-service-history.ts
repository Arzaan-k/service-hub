import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function clearServiceHistory() {
  console.log('🗑️  Clearing service_history table...\n');

  try {
    const result = await db.execute(sql`DELETE FROM service_history`);
    console.log('✅ Service history table cleared');
    console.log('Result:', result);
  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

clearServiceHistory();
