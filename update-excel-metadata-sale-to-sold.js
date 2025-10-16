/**
 * Script to update Excel metadata status from "SALE" to "SOLD"
 * This will fix the frontend display issue
 */

import { db } from './server/db.ts';

async function updateExcelMetadataSaleToSold() {
  console.log('🔄 Updating Excel metadata status from "SALE" to "SOLD"...');

  try {
    // First, let's see how many containers have Excel metadata with "SALE" status
    const excelSaleContainers = await db.execute(`
      SELECT COUNT(*) as count
      FROM containers
      WHERE excel_metadata->>'status' = 'SALE'
    `);

    console.log(`📊 Found ${excelSaleContainers.rows[0].count} containers with Excel metadata "SALE" status`);

    if (excelSaleContainers.rows[0].count > 0) {
      // Update the Excel metadata status from "SALE" to "SOLD"
      const updateResult = await db.execute(`
        UPDATE containers
        SET excel_metadata = jsonb_set(
          excel_metadata,
          '{status}',
          '"SOLD"'
        ),
        updated_at = NOW()
        WHERE excel_metadata->>'status' = 'SALE'
      `);

      console.log(`✅ Updated ${updateResult.rowCount} containers' Excel metadata from "SALE" to "SOLD"`);
    }

    // Verify the update
    const remainingSaleContainers = await db.execute(`
      SELECT COUNT(*) as count
      FROM containers
      WHERE excel_metadata->>'status' = 'SALE'
    `);

    console.log(`📊 Remaining containers with Excel metadata "SALE" status: ${remainingSaleContainers.rows[0].count}`);

    const soldContainers = await db.execute(`
      SELECT COUNT(*) as count
      FROM containers
      WHERE excel_metadata->>'status' = 'SOLD'
    `);

    console.log(`📊 Containers with Excel metadata "SOLD" status: ${soldContainers.rows[0].count}`);

    // Show a sample of updated containers
    const sampleContainers = await db.execute(`
      SELECT container_id, status, excel_metadata->>'status' as excel_status
      FROM containers
      WHERE excel_metadata->>'status' = 'SOLD'
      LIMIT 5
    `);

    console.log('\n📦 Sample containers with updated Excel metadata:');
    sampleContainers.rows.forEach(row => {
      console.log(`- ${row.container_id}: DB status = "${row.status}", Excel status = "${row.excel_status}"`);
    });

  } catch (error) {
    console.error('❌ Error updating Excel metadata:', error);
    process.exit(1);
  }
}

updateExcelMetadataSaleToSold();












