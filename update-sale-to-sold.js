/**
 * Script to update containers with database status "SALE" to "sold"
 */

import { db } from './server/db.ts';
import { containers } from './shared/schema.ts';
import { eq } from 'drizzle-orm';

async function updateSaleToSold() {
  console.log('🔄 Updating containers with database status "SALE" to "sold"...');

  try {
    // Check how many containers have status "SALE"
    const saleContainers = await db
      .select()
      .from(containers)
      .where(eq(containers.status, 'SALE'));

    console.log(`📊 Found ${saleContainers.length} containers with database status "SALE"`);

    if (saleContainers.length > 0) {
      console.log('\n📦 Sample containers with "SALE" status:');
      saleContainers.slice(0, 5).forEach(container => {
        console.log(`- ${container.containerId}: ${container.status}`);
      });

      // Update all "SALE" containers to "sold"
      const result = await db
        .update(containers)
        .set({ status: 'sold', updatedAt: new Date() })
        .where(eq(containers.status, 'SALE'));

      console.log(`\n✅ Updated ${result.rowCount} containers from "SALE" to "sold"`);

      // Verify the update
      const updatedContainers = await db
        .select()
        .from(containers)
        .where(eq(containers.status, 'sold'));

      console.log(`📊 Total containers now with "sold" status: ${updatedContainers.length}`);

    } else {
      console.log('\n❌ No containers found with status "SALE"');
    }

  } catch (error) {
    console.error('❌ Error updating SALE to sold:', error);
    process.exit(1);
  }
}

updateSaleToSold();












