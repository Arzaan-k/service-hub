/**
 * Script to find containers with Excel "SALE" status but not "sold" database status
 */

import { db } from './server/db.ts';

async function checkUnsoldSaleContainers() {
  console.log('🔍 Finding containers with Excel "SALE" status but not updated to "sold"...');

  try {
    // Find containers where Excel metadata shows "SALE" but database status is not "sold"
    const unsoldSaleContainers = await db.execute(`
      SELECT container_id, status, excel_metadata->>'status' as excel_status
      FROM containers
      WHERE excel_metadata->>'status' = 'SALE'
      AND status != 'sold'
      LIMIT 20
    `);

    console.log(`📊 Found ${unsoldSaleContainers.rows.length} containers with Excel "SALE" but not "sold" in database`);

    if (unsoldSaleContainers.rows.length > 0) {
      console.log('\n📦 Sample containers that need updating:');
      unsoldSaleContainers.rows.forEach(row => {
        console.log(`- ${row.container_id}: DB status = "${row.status}", Excel status = "${row.excel_status}"`);
      });

      // Update these remaining containers
      console.log('\n🔄 Updating remaining containers...');
      const updateResult = await db.execute(`
        UPDATE containers
        SET status = 'sold', updated_at = NOW()
        WHERE excel_metadata->>'status' = 'SALE'
        AND status != 'sold'
      `);

      console.log(`✅ Updated ${updateResult.rowCount} additional containers to "sold"`);

    } else {
      console.log('\n✅ All containers with Excel "SALE" status are already marked as "sold"');
    }

    // Final verification
    const finalCheck = await db.execute(`
      SELECT status, COUNT(*) as count
      FROM containers
      WHERE excel_metadata->>'status' = 'SALE'
      GROUP BY status
    `);

    console.log('\n📊 Final status distribution for Excel SALE containers:');
    finalCheck.rows.forEach(row => {
      console.log(`- "${row.status}": ${row.count} containers`);
    });

  } catch (error) {
    console.error('❌ Error checking unsold sale containers:', error);
    process.exit(1);
  }
}

checkUnsoldSaleContainers();













