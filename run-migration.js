import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

console.log('==================================================');
console.log('  Running WhatsApp Enum Migration');
console.log('==================================================\n');

try {
  const migrationSQL = readFileSync('./fix-whatsapp-enums.sql', 'utf-8');

  console.log('Executing migration...\n');
  await sql(migrationSQL);

  console.log('\n✅ Migration completed successfully!');
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}

console.log('\n==================================================');
process.exit(0);
