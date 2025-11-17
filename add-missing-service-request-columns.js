import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

console.log('==================================================');
console.log('  Adding Missing Service Request Columns');
console.log('==================================================\n');

async function addColumn(columnName, columnType) {
  try {
    // Check if column already exists
    const columnCheck = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'service_requests'
      AND column_name = ${columnName}
    `;

    if (columnCheck.length > 0) {
      console.log(`  ℹ️  Column "${columnName}" already exists`);
      return false;
    }

    // Add the column
    const query = `ALTER TABLE service_requests ADD COLUMN ${columnName} ${columnType}`;
    await sql(query);

    console.log(`  ✅ Added "${columnName}" column (${columnType}) to service_requests table`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error adding column "${columnName}":`, error.message);
    throw error;
  }
}

try {
  console.log('Checking and adding missing columns...\n');

  await addColumn('signed_document_url', 'text');
  await addColumn('vendor_invoice_url', 'text');
  await addColumn('technician_notes', 'text');

  console.log('\n✅ Migration completed successfully!');
} catch (error) {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
}

console.log('\n==================================================');
process.exit(0);
