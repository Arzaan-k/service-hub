import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

console.log('==================================================');
console.log('  Adding end_time Column to service_requests');
console.log('==================================================\n');

async function addColumn() {
  try {
    // Check if column already exists
    const columnCheck = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'service_requests'
      AND column_name = 'end_time'
    `;

    if (columnCheck.length > 0) {
      console.log('  ℹ️  Column "end_time" already exists in service_requests table');
      return false;
    }

    // Add the column
    await sql`
      ALTER TABLE service_requests
      ADD COLUMN end_time timestamp
    `;

    console.log('  ✅ Added "end_time" column to service_requests table');
    return true;
  } catch (error) {
    console.error('  ❌ Error adding column:', error.message);
    throw error;
  }
}

try {
  await addColumn();

  // Verify all time-related columns
  console.log('\n📋 Time-related columns in service_requests:');
  const columns = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'service_requests'
    AND column_name LIKE '%time%'
    ORDER BY column_name
  `;

  columns.forEach(col => {
    console.log(`  • ${col.column_name}: ${col.data_type}`);
  });

  console.log('\n✅ Migration completed successfully!');
} catch (error) {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
}

console.log('\n==================================================');
process.exit(0);
