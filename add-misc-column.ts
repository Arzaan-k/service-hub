import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function addMiscellaneousAmountColumn() {
    try {
        console.log('Adding miscellaneous_amount column to technician_trips table...');

        await db.execute(sql`
      ALTER TABLE technician_trips 
      ADD COLUMN IF NOT EXISTS miscellaneous_amount DECIMAL(10, 2) DEFAULT 0.00
    `);

        console.log('✅ Successfully added miscellaneous_amount column');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error adding column:', error);
        process.exit(1);
    }
}

addMiscellaneousAmountColumn();
