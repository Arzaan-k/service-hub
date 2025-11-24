import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function checkSchema() {
  console.log('📋 Checking containers table schema...\n');

  const columns = await db.execute(sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'containers'
    AND column_name LIKE '%container%'
    ORDER BY ordinal_position
  `);

  console.log('Columns with "container" in name:');
  columns.rows.forEach((row: any) => {
    console.log(`  - ${row.column_name}: ${row.data_type}`);
  });

  // Also check all columns
  const allColumns = await db.execute(sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'containers'
    ORDER BY ordinal_position
  `);

  console.log('\nAll containers table columns:');
  allColumns.rows.forEach((row: any) => {
    console.log(`  - ${row.column_name}: ${row.data_type}`);
  });

  // Check a sample container
  const sampleContainer = await db.execute(sql`
    SELECT * FROM containers LIMIT 1
  `);

  if (sampleContainer.rows.length > 0) {
    console.log('\nSample container keys:');
    const keys = Object.keys(sampleContainer.rows[0]);
    keys.forEach(key => {
      console.log(`  - ${key}`);
    });
  }
}

checkSchema()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
