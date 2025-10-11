/**
 * Script to check current status distribution and find any containers that might be showing as "For Sale"
 */

import { db } from './server/db.ts';

async function checkCurrentStatuses() {
  console.log('🔍 Checking current container status distribution...');

  try {
    // Get all unique statuses and their counts
    const statusDistribution = await db.execute(`
      SELECT status, COUNT(*) as count
      FROM containers
      GROUP BY status
      ORDER BY status
    `);

    console.log('📊 Current status distribution:');
    statusDistribution.rows.forEach(row => {
      console.log(`- "${row.status}": ${row.count} containers`);
    });

    // Check if there are any containers with status that might be interpreted as "for sale"
    const possibleSaleStatuses = ['sale', 'SALE', 'Sale', 'for_sale', 'available', 'new'];
    console.log('\n🔍 Checking for possible "for sale" statuses:');

    for (const status of possibleSaleStatuses) {
      const count = await db.execute(`
        SELECT COUNT(*) as count FROM containers WHERE status = '${status}'
      `);

      if (parseInt(count.rows[0].count) > 0) {
        console.log(`- "${status}": ${count.rows[0].count} containers`);
      }
    }

    // Check for containers that might be recently added or have unusual statuses
    const unusualStatuses = await db.execute(`
      SELECT DISTINCT status
      FROM containers
      WHERE status NOT IN ('active', 'retired', 'sold', 'in_service', 'maintenance', 'in_transit', 'for_sale')
    `);

    if (unusualStatuses.rows.length > 0) {
      console.log('\n⚠️  Containers with unusual statuses:');
      unusualStatuses.rows.forEach(row => {
        console.log(`- "${row.status}"`);
      });
    } else {
      console.log('\n✅ All containers have standard statuses');
    }

  } catch (error) {
    console.error('❌ Error checking current statuses:', error);
    process.exit(1);
  }
}

checkCurrentStatuses();
