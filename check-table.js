import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function checkTable() {
  try {
    const result = await db.execute(sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service_history'`);
    if (result.rows.length > 0) {
      console.log('✅ service_history table exists');

      const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM service_history`);
      console.log('📊 Records in service_history:', countResult.rows[0].count);

      if (parseInt(countResult.rows[0].count) > 0) {
        const sampleResult = await db.execute(sql`SELECT container_number, client_name, job_order_number FROM service_history LIMIT 3`);
        console.log('📋 Sample records:', sampleResult.rows);
      }
    } else {
      console.log('❌ service_history table does NOT exist');
    }
  } catch (error) {
    console.error('Error checking table:', error.message);
  }
  process.exit(0);
}

checkTable();





