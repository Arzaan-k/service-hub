import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function checkContainers() {
  try {
    console.log('Checking containers in database...');

    const result = await db.execute(sql`SELECT COUNT(*) as count FROM containers`);
    console.log('Total containers:', result.rows[0].count);

    if (parseInt(result.rows[0].count) > 0) {
      const sample = await db.execute(sql`SELECT containerCode, type, status FROM containers LIMIT 5`);
      console.log('Sample containers:', sample.rows);
    } else {
      console.log('No containers found in database');
    }

  } catch (error) {
    console.error('Error checking containers:', error.message);
  }
  process.exit(0);
}

checkContainers();




