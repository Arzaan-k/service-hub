/**
 * Script to verify that the container status updates actually worked
 */

import { db } from './server/db.ts';
import { containers } from './shared/schema.ts';
import { eq } from 'drizzle-orm';

async function verifyUpdate() {
  console.log('🔍 Verifying container status updates...');

  try {
    // Check how many containers have "sold" status
    const soldContainers = await db
      .select()
      .from(containers)
      .where(eq(containers.status, 'sold'));

    console.log(`📊 Containers with "sold" status: ${soldContainers.length}`);

    // Check how many containers still have "for_sale" status
    const forSaleContainers = await db
      .select()
      .from(containers)
      .where(eq(containers.status, 'for_sale'));

    console.log(`📊 Containers with "for_sale" status: ${forSaleContainers.length}`);

    // Check how many containers have Excel metadata with "SALE" status
    const excelSaleContainers = await db.execute(`
      SELECT COUNT(*) as count
      FROM containers
      WHERE excel_metadata->>'status' = 'SALE'
    `);

    console.log(`📊 Containers with Excel metadata "SALE" status: ${excelSaleContainers.rows[0].count}`);

    // Show some sample containers with different statuses
    const samples = await db.execute(`
      SELECT container_id, status, excel_metadata->>'status' as excel_status
      FROM containers
      WHERE status IN ('sold', 'for_sale', 'active', 'retired')
      LIMIT 10
    `);

    console.log('\n📦 Sample containers with their statuses:');
    samples.rows.forEach(row => {
      console.log(`- ${row.container_id}: DB status = "${row.status}", Excel status = "${row.excel_status}"`);
    });

    // Check if any containers still have "SALE" in their database status field
    const dbSaleContainers = await db.execute(`
      SELECT COUNT(*) as count
      FROM containers
      WHERE status = 'SALE'
    `);

    console.log(`\n📊 Containers with database status "SALE": ${dbSaleContainers.rows[0].count}`);

  } catch (error) {
    console.error('❌ Error verifying updates:', error);
    process.exit(1);
  }
}

verifyUpdate();












