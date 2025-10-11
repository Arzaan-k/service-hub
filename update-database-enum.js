/**
 * Script to update the database enum to include "for_sale" and "sold" statuses
 */

import { db } from './server/db.ts';

async function updateDatabaseEnum() {
  console.log('🔄 Updating database enum to include "for_sale" and "sold" statuses...');

  try {
    // First, let's check the current enum values
    const currentEnum = await db.execute(`
      SELECT unnest(enum_range(NULL::container_status)) as status;
    `);
    console.log('Current enum values:', currentEnum);

    // Add "for_sale" to the enum if it doesn't exist
    await db.execute(`
      ALTER TYPE container_status ADD VALUE IF NOT EXISTS 'for_sale';
    `);

    // Add "sold" to the enum if it doesn't exist
    await db.execute(`
      ALTER TYPE container_status ADD VALUE IF NOT EXISTS 'sold';
    `);

    console.log('✅ Database enum updated successfully!');

    // Verify the update
    const updatedEnum = await db.execute(`
      SELECT unnest(enum_range(NULL::container_status)) as status;
    `);
    console.log('Updated enum values:', updatedEnum);

  } catch (error) {
    console.error('❌ Error updating database enum:', error);
    process.exit(1);
  }
}

updateDatabaseEnum();

