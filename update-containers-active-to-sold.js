/**
 * Script to update containers from "active" to "sold" status
 * This script will help you if you want to mark some containers as sold
 */

import { db } from './server/db.ts';
import { containers } from './shared/schema.ts';
import { eq } from 'drizzle-orm';

async function updateActiveToSold() {
  console.log('🔄 Updating containers from "active" to "sold" status...');

  try {
    // Count current active containers
    const activeContainers = await db
      .select()
      .from(containers)
      .where(eq(containers.status, 'active'));

    console.log(`📊 Found ${activeContainers.length} active containers`);

    if (activeContainers.length === 0) {
      console.log('❌ No active containers found to update.');
      return;
    }

    // Ask user how many to update (or update all)
    console.log('💡 You can update all active containers to "sold" or specify a number.');
    console.log('📋 Note: This is a permanent change. Make sure you want to do this!');

    // For now, let's update all active containers to sold
    const result = await db
      .update(containers)
      .set({ status: 'sold' })
      .where(eq(containers.status, 'active'));

    console.log(`✅ Updated ${result.rowCount} containers from "active" to "sold"`);

    // Verify the update
    const soldContainers = await db
      .select()
      .from(containers)
      .where(eq(containers.status, 'sold'));

    console.log(`📊 Total containers now with "sold" status: ${soldContainers.length}`);

  } catch (error) {
    console.error('❌ Error updating container statuses:', error);
    process.exit(1);
  }
}

updateActiveToSold();

