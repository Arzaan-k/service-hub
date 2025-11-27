/**
 * Clear all Orbcomm alerts from the database
 * Use this to clean up excessive alerts before implementing smart filtering
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

async function clearOrbcommAlerts() {
  console.log('🧹 Starting Orbcomm alerts cleanup...');

  try {
    // Count total alerts before deletion
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total FROM alerts WHERE source = 'orbcomm'
    `);
    const totalAlerts = countResult.rows[0]?.total || 0;

    console.log(`📊 Found ${totalAlerts} Orbcomm alerts in database`);

    if (totalAlerts === 0) {
      console.log('✅ No Orbcomm alerts to clear');
      process.exit(0);
    }

    // First, clear the alert_id foreign key from service_requests
    console.log('🔗 Clearing alert references from service requests...');
    await db.execute(sql`
      UPDATE service_requests
      SET alert_id = NULL
      WHERE alert_id IN (
        SELECT id FROM alerts WHERE source = 'orbcomm'
      )
    `);

    // Now delete all Orbcomm alerts
    const deleteResult = await db.execute(sql`
      DELETE FROM alerts WHERE source = 'orbcomm'
    `);

    console.log(`✅ Successfully deleted ${totalAlerts} Orbcomm alerts`);

    // Show remaining alerts
    const remainingResult = await db.execute(sql`
      SELECT source, COUNT(*) as count
      FROM alerts
      GROUP BY source
    `);

    console.log('\n📊 Remaining alerts by source:');
    if (remainingResult.rows.length === 0) {
      console.log('  No alerts remaining');
    } else {
      remainingResult.rows.forEach((row: any) => {
        console.log(`  ${row.source}: ${row.count}`);
      });
    }

    console.log('\n🎉 Cleanup completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error clearing Orbcomm alerts:', error);
    process.exit(1);
  }
}

clearOrbcommAlerts();
