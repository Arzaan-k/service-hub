import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

console.log('Adding missing fields to service_requests table...');

(async () => {
  try {
    // Add missing fields to service_requests table
    await sql`ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS videos TEXT[]`;
    await sql`ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS location_proof_photos TEXT[]`;

    console.log('✅ Missing fields added successfully!');
  } catch (error) {
    console.error('❌ Failed to add fields:', error);
  }
})();







