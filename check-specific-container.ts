import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function checkContainer() {
  const containerNumber = 'CXRU1043337';

  console.log(`🔍 Checking container: ${containerNumber}\n`);

  // Check in service_history
  const serviceHistory = await db.execute(sql`
    SELECT * FROM service_history
    WHERE container_number = ${containerNumber}
  `);

  console.log(`📋 Service history records: ${serviceHistory.rows.length}`);

  if (serviceHistory.rows.length > 0) {
    console.log('\n✅ Service records found:');
    serviceHistory.rows.forEach((row: any, index) => {
      console.log(`\n${index + 1}. Job Order: ${row.job_order_number}`);
      console.log(`   Date: ${row.complaint_attended_date}`);
      console.log(`   Client: ${row.client_name}`);
      console.log(`   Technician: ${row.technician_name || 'N/A'}`);
    });
  } else {
    console.log('❌ No service history records found');
  }

  // Check in containers table
  const container = await db.execute(sql`
    SELECT container_id, id FROM containers
    WHERE container_id = ${containerNumber}
  `);

  console.log(`\n📦 Container in main table: ${container.rows.length > 0 ? '✅ YES' : '❌ NO'}`);

  if (container.rows.length > 0) {
    console.log(`   ID: ${(container.rows[0] as any).id}`);
  }

  // Check similar container numbers (in case of typo or variant)
  console.log('\n🔎 Checking for similar container numbers...');
  const similar = await db.execute(sql`
    SELECT DISTINCT container_number
    FROM service_history
    WHERE container_number LIKE ${'CXRU%'}
    LIMIT 10
  `);

  console.log(`\nFound ${similar.rows.length} containers starting with CXRU:`);
  similar.rows.forEach((row: any, index) => {
    console.log(`${index + 1}. ${row.container_number}`);
  });
}

checkContainer()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
