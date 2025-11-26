import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { neon } from '@neondatabase/serverless';

config();

async function runMigration() {
  const sql = neon(process.env.DATABASE_URL!);
  
  try {
    console.log('📦 Running migration: 0005_add_inventory_fields.sql');
    
    // Read the migration file
    const migrationSQL = readFileSync(
      join(process.cwd(), 'migrations', '0005_add_inventory_fields.sql'),
      'utf-8'
    );
    
    // Split by semicolon and run each command (simple split)
    // Note: This is a simple implementation. For complex SQL, use a proper parser or separate calls.
    // The current migration file has commas but is one ALTER TABLE statement? No, it has commas.
    // "ALTER TABLE ... ADD ... , ADD ... ;" is valid single statement.
    
    await sql(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('✅ Inventory fields added to service_requests table');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
