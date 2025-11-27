import { db } from './server/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log('🚀 Running courier shipments migration...');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add_courier_shipments.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split by semicolons but keep only non-empty statements
    // Remove comments first, then split
    const cleanedSQL = migrationSQL
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        console.log(`\n[${i + 1}/${statements.length}] Executing statement...`);
        console.log(statement.substring(0, 100) + '...');

        await db.execute(sql.raw(statement));
        console.log(`✅ Statement ${i + 1} executed successfully`);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\nCreated:');
    console.log('  - courier_shipment_status enum');
    console.log('  - courier_shipments table');
    console.log('  - 4 indexes for performance');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  }
}

runMigration();
