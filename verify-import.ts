import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function verify() {
  console.log('📊 Verifying Service History Import...\n');

  const totalRecords = await db.execute(sql`SELECT COUNT(*) as count FROM service_history`);
  console.log('✓ Total Service Records:', totalRecords.rows[0].count);

  const uniqueContainers = await db.execute(sql`SELECT COUNT(DISTINCT container_number) as count FROM service_history`);
  console.log('✓ Unique Containers:', uniqueContainers.rows[0].count);

  const uniqueClients = await db.execute(sql`SELECT COUNT(DISTINCT client_name) as count FROM service_history`);
  console.log('✓ Unique Clients:', uniqueClients.rows[0].count);

  const uniqueTechs = await db.execute(sql`SELECT COUNT(DISTINCT technician_name) as count FROM service_history WHERE technician_name IS NOT NULL`);
  console.log('✓ Unique Technicians:', uniqueTechs.rows[0].count);

  const indentCount = await db.execute(sql`SELECT COUNT(*) as count FROM indents`);
  console.log('✓ Indent Records:', indentCount.rows[0].count);

  const sampleRecords = await db.execute(sql`SELECT job_order_number, container_number, client_name, complaint_attended_date FROM service_history LIMIT 5`);
  console.log('\n📋 Sample Records:');
  sampleRecords.rows.forEach((row: any) => {
    console.log(`   - ${row.job_order_number}: ${row.container_number} (${row.client_name}) - ${row.complaint_attended_date}`);
  });

  console.log('\n✅ Import verification complete!');
}

verify()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });
