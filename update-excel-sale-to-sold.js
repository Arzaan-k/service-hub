/**
 * Script to update containers from Excel "SALE" status to "sold"
 * This script handles the complete flow:
 * 1. Find containers where excel_metadata indicates "SALE" status
 * 2. Update their database status to "for_sale"
 * 3. Update all "for_sale" containers to "sold"
 */

import { db } from './server/db.ts';
import { containers } from './shared/schema.ts';
import { eq } from 'drizzle-orm';

async function updateExcelSaleToSold() {
  console.log('🔄 Updating containers from Excel "SALE" status to "sold"...');

  try {
    // Step 1: Find containers where Excel metadata shows "SALE" status
    const excelSaleContainers = await db.execute(`
      SELECT container_id, status, excel_metadata->>'status' as excel_status
      FROM containers
      WHERE excel_metadata->>'status' = 'SALE'
    `);

    console.log(`📊 Found ${excelSaleContainers.rows.length} containers with Excel "SALE" status`);

    if (excelSaleContainers.rows.length > 0) {
      console.log('\n📦 Sample Excel SALE containers:');
      excelSaleContainers.rows.slice(0, 3).forEach(row => {
        console.log(`- ${row.container_id}: Current status = "${row.status}", Excel status = "${row.excel_status}"`);
      });
    }

    // Step 2: Update containers with Excel "SALE" status to "for_sale" in database
    if (excelSaleContainers.rows.length > 0) {
      const updateResult = await db.execute(`
        UPDATE containers
        SET status = 'for_sale', updated_at = NOW()
        WHERE excel_metadata->>'status' = 'SALE'
      `);

      console.log(`✅ Updated ${updateResult.rowCount} containers from Excel "SALE" to database "for_sale"`);
    }

    // Step 3: Update all "for_sale" containers to "sold"
    const forSaleContainers = await db
      .select()
      .from(containers)
      .where(eq(containers.status, 'for_sale'));

    if (forSaleContainers.length > 0) {
      const finalResult = await db
        .update(containers)
        .set({ status: 'sold', updated_at: new Date() })
        .where(eq(containers.status, 'for_sale'));

      console.log(`✅ Updated ${finalResult.rowCount} containers from "for_sale" to "sold"`);
    }

    // Step 4: Verify the final state
    const soldContainers = await db
      .select()
      .from(containers)
      .where(eq(containers.status, 'sold'));

    console.log(`\n📊 Final count - Total containers with "sold" status: ${soldContainers.length}`);

    // Show a few examples
    if (soldContainers.length > 0) {
      console.log('\n📦 Sample sold containers:');
      soldContainers.slice(0, 3).forEach(container => {
        console.log(`- ${container.containerId}: ${container.status}`);
      });
    }

  } catch (error) {
    console.error('❌ Error updating container statuses:', error);
    process.exit(1);
  }
}

updateExcelSaleToSold();
