/**
 * Final comprehensive check of all container statuses
 */

import { db } from './server/db.ts';

async function finalStatusCheck() {
  console.log('🔍 Final comprehensive check of container statuses...');

  try {
    // Get complete status breakdown
    const allStatuses = await db.execute(`
      SELECT
        status,
        COUNT(*) as count,
        COUNT(CASE WHEN excel_metadata->>'status' = 'SALE' THEN 1 END) as excel_sale_count
      FROM containers
      GROUP BY status
      ORDER BY status
    `);

    console.log('📊 Complete status breakdown:');
    allStatuses.rows.forEach(row => {
      console.log(`- "${row.status}": ${row.count} containers (${row.excel_sale_count} with Excel SALE)`);
    });

    // Check for any containers that might be showing as "For Sale" in frontend
    const totalContainers = await db.execute(`SELECT COUNT(*) as count FROM containers`);
    console.log(`\n📈 Total containers in database: ${totalContainers.rows[0].count}`);

    // Check if there are any containers with "sold" status (since that contains 's')
    const containersWithS = await db.execute(`
      SELECT container_id, status, excel_metadata->>'status' as excel_status
      FROM containers
      WHERE status = 'sold'
      LIMIT 10
    `);

    if (containersWithS.rows.length > 0) {
      console.log('\n📦 Containers with "s" or "S" in status:');
      containersWithS.rows.forEach(row => {
        console.log(`- ${row.container_id}: "${row.status}" (Excel: ${row.excel_status})`);
      });
    }

    // Check for any containers that were recently updated
    const recentlyUpdated = await db.execute(`
      SELECT container_id, status, updated_at
      FROM containers
      WHERE updated_at > NOW() - INTERVAL '1 hour'
      ORDER BY updated_at DESC
      LIMIT 10
    `);

    if (recentlyUpdated.rows.length > 0) {
      console.log('\n🕐 Recently updated containers:');
      recentlyUpdated.rows.forEach(row => {
        console.log(`- ${row.container_id}: "${row.status}" at ${row.updated_at}`);
      });
    }

  } catch (error) {
    console.error('❌ Error in final status check:', error);
    process.exit(1);
  }
}

finalStatusCheck();
