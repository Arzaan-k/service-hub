/**
 * Script to check what container status values actually exist in the database
 */

import { db } from './server/db.ts';

async function checkActualStatuses() {
  console.log('🔍 Checking what container status values exist in the database...');

  try {
    // Get all unique status values from the containers table
    const statusQuery = await db.execute(`
      SELECT DISTINCT status
      FROM containers
      WHERE status IS NOT NULL
      ORDER BY status;
    `);

    console.log('📊 Actual status values in containers table:');
    statusQuery.rows.forEach(row => {
      console.log(`- "${row.status}"`);
    });

    // Count containers by status
    const countQuery = await db.execute(`
      SELECT status, COUNT(*) as count
      FROM containers
      WHERE status IS NOT NULL
      GROUP BY status
      ORDER BY status;
    `);

    console.log('\n📈 Container count by status:');
    countQuery.rows.forEach(row => {
      console.log(`- "${row.status}": ${row.count} containers`);
    });

  } catch (error) {
    console.error('❌ Error checking statuses:', error);
    process.exit(1);
  }
}

checkActualStatuses();

