/**
 * Clear all travel/trip data from the database
 * WARNING: This will delete ALL technician trips, tasks, and costs permanently!
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

async function clearTravelData() {
  console.log('🧹 Starting travel data cleanup...');
  console.log('⚠️  WARNING: This will delete ALL technician trips, tasks, and costs permanently!');

  try {
    // Count total trips before deletion
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total FROM technician_trips
    `);
    const totalTrips = countResult.rows[0]?.total || 0;

    console.log(`📊 Found ${totalTrips} technician trips in database`);

    if (totalTrips === 0) {
      console.log('✅ No travel data to clear');
      process.exit(0);
    }

    // Get breakdown by status
    const statusResult = await db.execute(sql`
      SELECT trip_status, COUNT(*) as count
      FROM technician_trips
      GROUP BY trip_status
    `);

    console.log('\n📊 Trips by status:');
    statusResult.rows.forEach((row: any) => {
      console.log(`  ${row.trip_status}: ${row.count}`);
    });

    // Count tasks
    const tasksCountResult = await db.execute(sql`
      SELECT COUNT(*) as total FROM technician_trip_tasks
    `);
    const totalTasks = tasksCountResult.rows[0]?.total || 0;
    console.log(`\n📋 Total trip tasks: ${totalTasks}`);

    // Count costs
    const costsCountResult = await db.execute(sql`
      SELECT COUNT(*) as total FROM technician_trip_costs
    `);
    const totalCosts = costsCountResult.rows[0]?.total || 0;
    console.log(`💰 Total trip costs: ${totalCosts}`);

    console.log('\n⏳ Deleting travel data...');

    // Step 1: Delete trip tasks (has foreign keys to trips)
    console.log('📋 Deleting trip tasks...');
    const tasksResult = await db.execute(sql`
      DELETE FROM technician_trip_tasks
    `);
    console.log(`✅ Deleted ${totalTasks} trip tasks`);

    // Step 2: Delete trip costs
    console.log('💰 Deleting trip costs...');
    const costsResult = await db.execute(sql`
      DELETE FROM technician_trip_costs
    `);
    console.log(`✅ Deleted ${totalCosts} trip costs`);

    // Step 3: Delete trips
    console.log('🚗 Deleting trips...');
    const tripsResult = await db.execute(sql`
      DELETE FROM technician_trips
    `);
    console.log(`✅ Deleted ${totalTrips} trips`);

    // Verify deletion
    const verifyResult = await db.execute(sql`
      SELECT COUNT(*) as remaining FROM technician_trips
    `);
    const remaining = verifyResult.rows[0]?.remaining || 0;

    if (remaining === 0) {
      console.log('\n✅ All travel data has been cleared');
    } else {
      console.log(`\n⚠️  Warning: ${remaining} trips still remain`);
    }

    console.log('\n🎉 Travel data cleanup completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error clearing travel data:', error);
    console.error('\nIf you see a foreign key constraint error, you may need to:');
    console.error('1. Check for other tables referencing trips');
    console.error('2. Update the foreign key constraints');
    process.exit(1);
  }
}

clearTravelData();
