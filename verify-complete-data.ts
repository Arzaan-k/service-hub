import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function verifyCompleteData() {
  console.log('📊 COMPLETE DATA VERIFICATION\n');
  console.log('=' .repeat(60));

  // 1. Check total service history records
  const totalRecords = await db.execute(sql`
    SELECT COUNT(*) as count FROM service_history
  `);
  console.log(`\n1️⃣  Total Service History Records: ${totalRecords.rows[0].count}`);

  // 2. Check unique containers in service history
  const uniqueContainers = await db.execute(sql`
    SELECT COUNT(DISTINCT container_number) as count
    FROM service_history
  `);
  console.log(`2️⃣  Unique Containers with Service History: ${uniqueContainers.rows[0].count}`);

  // 3. Sample of containers with service counts
  const containerCounts = await db.execute(sql`
    SELECT
      container_number,
      COUNT(*) as service_count
    FROM service_history
    GROUP BY container_number
    ORDER BY service_count DESC
    LIMIT 10
  `);
  console.log(`\n3️⃣  Top 10 Containers by Service Count:`);
  containerCounts.rows.forEach((row: any, index) => {
    console.log(`   ${index + 1}. ${row.container_number} - ${row.service_count} services`);
  });

  // 4. Check if containers exist in main containers table
  const mainContainersCount = await db.execute(sql`
    SELECT COUNT(*) as count FROM containers
  `);
  console.log(`\n4️⃣  Total Containers in Main Table: ${mainContainersCount.rows[0].count}`);

  // 5. Check matching containers (exist in both tables)
  const matchingContainers = await db.execute(sql`
    SELECT COUNT(DISTINCT sh.container_number) as count
    FROM service_history sh
    INNER JOIN containers c ON sh.container_number = c.container_id
  `);
  console.log(`5️⃣  Containers with Service History ALSO in Main Table: ${matchingContainers.rows[0].count}`);

  // 6. Sample matching containers
  const sampleMatching = await db.execute(sql`
    SELECT
      c.id,
      c.container_id,
      COUNT(sh.id) as service_count
    FROM containers c
    INNER JOIN service_history sh ON c.container_id = sh.container_number
    GROUP BY c.id, c.container_id
    ORDER BY service_count DESC
    LIMIT 10
  `);

  console.log(`\n6️⃣  Sample Containers with Both Main Record AND Service History:`);
  sampleMatching.rows.forEach((row: any, index) => {
    console.log(`   ${index + 1}. ${row.container_id} (ID: ${row.id.substring(0, 8)}...) - ${row.service_count} services`);
  });

  // 7. Check containers in service history but NOT in main table
  const onlyInServiceHistory = await db.execute(sql`
    SELECT COUNT(DISTINCT sh.container_number) as count
    FROM service_history sh
    LEFT JOIN containers c ON sh.container_number = c.container_id
    WHERE c.id IS NULL
  `);
  console.log(`\n7️⃣  Containers ONLY in Service History (not in main table): ${onlyInServiceHistory.rows[0].count}`);

  // 8. Sample of those containers
  const sampleOnlyInSH = await db.execute(sql`
    SELECT DISTINCT sh.container_number
    FROM service_history sh
    LEFT JOIN containers c ON sh.container_number = c.container_id
    WHERE c.id IS NULL
    LIMIT 10
  `);

  if (sampleOnlyInSH.rows.length > 0) {
    console.log(`\n   ⚠️  Sample containers in service history but NOT in main table:`);
    sampleOnlyInSH.rows.forEach((row: any, index) => {
      console.log(`   ${index + 1}. ${row.container_number}`);
    });
    console.log(`\n   💡 These containers won't show service history on container detail pages`);
    console.log(`   💡 They will only appear on the main /service-history page`);
  }

  // 9. Date range of service history
  const dateRange = await db.execute(sql`
    SELECT
      MIN(complaint_attended_date) as earliest,
      MAX(complaint_attended_date) as latest
    FROM service_history
  `);
  console.log(`\n8️⃣  Service History Date Range:`);
  console.log(`   Earliest: ${dateRange.rows[0].earliest}`);
  console.log(`   Latest: ${dateRange.rows[0].latest}`);

  // 10. Client distribution
  const clientCount = await db.execute(sql`
    SELECT COUNT(DISTINCT client_name) as count
    FROM service_history
  `);
  console.log(`\n9️⃣  Unique Clients: ${clientCount.rows[0].count}`);

  // 11. Technician distribution
  const techCount = await db.execute(sql`
    SELECT COUNT(DISTINCT technician_name) as count
    FROM service_history
    WHERE technician_name IS NOT NULL AND technician_name != ''
  `);
  console.log(`🔟 Unique Technicians: ${techCount.rows[0].count}`);

  console.log('\n' + '='.repeat(60));
  console.log('✅ DATA VERIFICATION COMPLETE\n');
}

verifyCompleteData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
