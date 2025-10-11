/**
 * Script to add 'SALE' status to the database enum
 */

import { db } from './server/db.ts';

async function addSaleStatus() {
  console.log('🔄 Adding "SALE" status to database enum...');

  try {
    // Add "SALE" to the enum
    await db.execute(`ALTER TYPE container_status ADD VALUE IF NOT EXISTS 'SALE'`);

    console.log('✅ Successfully added "SALE" to container_status enum');

    // Verify the update
    const updatedEnum = await db.execute(`
      SELECT unnest(enum_range(NULL::container_status)) as status;
    `);

    console.log('Updated enum values:');
    updatedEnum.rows.forEach(row => {
      console.log(`- ${row.status}`);
    });

  } catch (error) {
    console.error('❌ Error adding SALE status:', error);
    process.exit(1);
  }
}

addSaleStatus();






