import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function checkContainers() {
  console.log('📊 Checking Container Numbers in Service History...\n');

  // Get sample container numbers
  const containers = await db.execute(sql`
    SELECT DISTINCT container_number
    FROM service_history
    ORDER BY container_number
    LIMIT 20
  `);

  console.log('Sample Container Numbers in Service History:');
  containers.rows.forEach((row: any, index) => {
    console.log(`${index + 1}. ${row.container_number}`);
  });

  // Get total unique containers
  const total = await db.execute(sql`
    SELECT COUNT(DISTINCT container_number) as count
    FROM service_history
  `);

  console.log(`\n✅ Total Unique Containers: ${total.rows[0].count}`);

  // Check a specific container
  const testContainer = containers.rows[0]?.container_number;
  if (testContainer) {
    console.log(`\n🔍 Testing Container: ${testContainer}`);

    const history = await db.execute(sql`
      SELECT
        job_order_number,
        container_number,
        client_name,
        complaint_attended_date,
        technician_name
      FROM service_history
      WHERE container_number = ${testContainer}
      ORDER BY complaint_attended_date DESC
      LIMIT 5
    `);

    console.log(`\n📋 Service Records for ${testContainer}:`);
    history.rows.forEach((row: any, index) => {
      console.log(`\n${index + 1}. Job Order: ${row.job_order_number}`);
      console.log(`   Date: ${row.complaint_attended_date}`);
      console.log(`   Client: ${row.client_name}`);
      console.log(`   Technician: ${row.technician_name || 'N/A'}`);
    });
  }
}

checkContainers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
