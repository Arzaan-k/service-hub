/**
 * Script to update all containers with "for sale" status to "sold"
 *
 * To run this script:
 * 1. Set your DATABASE_URL environment variable
 * 2. Run: npx tsx update-containers-to-sold.js
 */

import { db } from './server/db.ts';
import { containers } from './shared/schema.ts';
import { eq } from 'drizzle-orm';

async function updateContainerStatuses() {
  console.log('🔄 Updating container statuses from "for sale" to "sold"...');

  try {
    // First, check how many containers currently have "for sale" status
    const forSaleContainers = await db
      .select()
      .from(containers)
      .where(eq(containers.status, 'for_sale'));

    console.log(`📊 Found ${forSaleContainers.length} containers with "for_sale" status`);

    if (forSaleContainers.length === 0) {
      console.log('🔍 No containers found with "for_sale" status. Checking for "for sale" (with space)...');

      // Check for "for sale" with space
      const forSaleWithSpace = await db
        .select()
        .from(containers)
        .where(eq(containers.status, 'for sale'));

      console.log(`📊 Found ${forSaleWithSpace.length} containers with "for sale" status`);

      if (forSaleWithSpace.length === 0) {
        console.log('❌ No containers found with "for sale" or "for_sale" status.');
        return;
      }

      // Update containers from "for sale" to "sold"
      const result = await db
        .update(containers)
        .set({ status: 'sold' })
        .where(eq(containers.status, 'for sale'));

      console.log(`✅ Updated ${result.rowCount} containers from "for sale" to "sold"`);
    } else {
      // Update containers from "for_sale" to "sold"
      const result = await db
        .update(containers)
        .set({ status: 'sold' })
        .where(eq(containers.status, 'for_sale'));

      console.log(`✅ Updated ${result.rowCount} containers from "for_sale" to "sold"`);
    }

    // Verify the update
    const updatedContainers = await db
      .select()
      .from(containers)
      .where(eq(containers.status, 'sold'));

    console.log(`📊 Total containers now with "sold" status: ${updatedContainers.length}`);

  } catch (error) {
    console.error('❌ Error updating container statuses:', error);
    process.exit(1);
  }
}

updateContainerStatuses();

