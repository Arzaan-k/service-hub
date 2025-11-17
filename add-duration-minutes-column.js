import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

console.log('==================================================');
console.log('  Adding duration_minutes Column');
console.log('==================================================\n');

async function addColumn() {
  try {
    // Check if column already exists
    const columnCheck = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'service_requests'
      AND column_name = 'duration_minutes'
    `;

    if (columnCheck.length > 0) {
      console.log('  ℹ️  Column "duration_minutes" already exists');
      return false;
    }

    // Add the column
    await sql`
      ALTER TABLE service_requests
      ADD COLUMN duration_minutes integer
    `;

    console.log('  ✅ Added "duration_minutes" column to service_requests table');
    return true;
  } catch (error) {
    console.error('  ❌ Error adding column:', error.message);
    throw error;
  }
}

try {
  await addColumn();
  console.log('\n✅ Migration completed successfully!');
} catch (error) {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
}

console.log('\n==================================================');
process.exit(0);
