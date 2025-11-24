import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function countServiceHistory() {
  try {
    const result = await db.execute(sql`SELECT COUNT(*) as count FROM service_history`);
    console.log('✅ Total service records in database:', result.rows[0].count);

    const containerStats = await db.execute(sql`
      SELECT container_number, COUNT(*) as services
      FROM service_history
      GROUP BY container_number
      ORDER BY services DESC
      LIMIT 10
    `);

    console.log('\n📊 Top 10 containers by service count:');
    containerStats.rows.forEach((row: any) => {
      console.log(`  ${row.container_number}: ${row.services} services`);
    });
  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

countServiceHistory();
