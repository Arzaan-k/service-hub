import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function addConfirmedToTripStatus() {
    try {
        console.log('Adding "confirmed" value to trip_status enum...');

        // Add the new enum value
        await db.execute(sql`
      ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'confirmed' AFTER 'planned'
    `);

        console.log('✅ Successfully added "confirmed" to trip_status enum');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error adding enum value:', error);
        process.exit(1);
    }
}

addConfirmedToTripStatus();
