import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function testContainers() {
  try {
    console.log('Testing containers query...');

    const result = await db.execute(sql`SELECT COUNT(*) as count FROM containers`);
    console.log('Container count:', result.rows[0].count);

    if (parseInt(result.rows[0].count) > 0) {
      const sample = await db.execute(sql`SELECT id, containerCode, type, status FROM containers LIMIT 3`);
      console.log('Sample containers:', sample.rows);
    } else {
      console.log('No containers found in database');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testContainers();
