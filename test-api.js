import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

console.log('Testing database queries...\n');

try {
  // Test simple count
  const count = await sql`SELECT COUNT(*) as count FROM containers`;
  console.log('✓ Total containers:', count[0].count);

  // Test simple select
  const sample = await sql`SELECT * FROM containers LIMIT 1`;
  console.log('\n✓ Sample container columns:');
  if (sample[0]) {
    console.log(Object.keys(sample[0]).join(', '));
  }

  // Test service requests
  const srCount = await sql`SELECT COUNT(*) as count FROM service_requests`;
  console.log('\n✓ Total service requests:', srCount[0].count);

  const srSample = await sql`SELECT * FROM service_requests LIMIT 1`;
  console.log('\n✓ Sample service request columns:');
  if (srSample[0]) {
    console.log(Object.keys(srSample[0]).join(', '));
  }

} catch (error) {
  console.error('✗ Error:', error.message);
  console.error('Details:', error);
}

process.exit(0);
