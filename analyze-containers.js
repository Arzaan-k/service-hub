import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

console.log('Analyzing containers tables...\n');

// Check if container2 table exists
try {
  const container2Result = await sql`
    SELECT COUNT(*) as count
    FROM container2
  `;
  console.log('✓ container2 table exists with', container2Result[0].count, 'rows');

  // Get sample data from container2
  const container2Sample = await sql`
    SELECT *
    FROM container2
    LIMIT 5
  `;
  console.log('\nSample data from container2:');
  console.log(JSON.stringify(container2Sample, null, 2));

  // Get column names from container2
  const container2Columns = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'container2'
    ORDER BY ordinal_position
  `;
  console.log('\nColumns in container2:');
  container2Columns.forEach(col => {
    console.log(`  - ${col.column_name} (${col.data_type})`);
  });

} catch (error) {
  console.log('✗ container2 table does not exist or error:', error.message);
}

// Check containers table
const containersCount = await sql`SELECT COUNT(*) as count FROM containers`;
console.log('\n✓ containers table exists with', containersCount[0].count, 'rows');

// Get column names from containers
const containersColumns = await sql`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'containers'
  ORDER BY ordinal_position
`;
console.log('\nColumns in containers:');
containersColumns.forEach(col => {
  console.log(`  - ${col.column_name} (${col.data_type})`);
});

// Check for duplicate container_ids
const duplicates = await sql`
  SELECT container_id, COUNT(*) as count
  FROM containers
  GROUP BY container_id
  HAVING COUNT(*) > 1
`;
console.log('\nDuplicate container_ids in containers table:', duplicates.length);
if (duplicates.length > 0) {
  console.log('Duplicates:', duplicates);
}

process.exit(0);
