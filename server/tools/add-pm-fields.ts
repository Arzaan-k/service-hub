import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration(migrationFile: string) {
  const migrationPath = path.join(process.cwd(), 'migrations', migrationFile);

  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    return false;
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
  console.log(`\n📄 Running migration: ${migrationFile}`);
  console.log(`   Path: ${migrationPath}`);

  try {
    // Split the SQL into individual statements (split by semicolon + newline)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`   Found ${statements.length} SQL statements to execute`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        try {
          await db.execute(sql.raw(statement));
          console.log(`   ✅ Statement ${i + 1}/${statements.length} executed successfully`);
        } catch (err: any) {
          // If error is "column already exists" or "index already exists", that's okay
          if (err?.message?.includes('already exists') || err?.message?.includes('does not exist')) {
            console.log(`   ⚠️  Statement ${i + 1}/${statements.length} - ${err.message} (skipping)`);
          } else {
            throw err;
          }
        }
      }
    }

    console.log(`✅ Migration ${migrationFile} completed successfully\n`);
    return true;
  } catch (err: any) {
    console.error(`❌ Migration ${migrationFile} failed:`, err.message);
    return false;
  }
}

async function run() {
  console.log('='.repeat(80));
  console.log('🚀 Starting PM Fields Migration');
  console.log('='.repeat(80));
  console.log(`\n📊 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);

  // Migration to run
  const migration = '20250221_add_pm_fields.sql';

  const success = await runMigration(migration);

  console.log('='.repeat(80));
  console.log('📈 Migration Summary');
  console.log('='.repeat(80));
  console.log(`✅ Successful migrations: ${success ? 1 : 0}`);
  console.log(`❌ Failed migrations: ${success ? 0 : 1}`);
  console.log(`📊 Total migrations: 1`);

  // Verify the columns were added
  console.log('\n🔍 Verifying new PM columns...');
  try {
    const result = await db.execute(sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'containers'
      AND column_name IN (
        'last_pm_date', 'next_pm_due_date', 'pm_frequency_days', 'pm_status'
      )
      ORDER BY column_name
    `);

    console.log(`\n✅ Found ${result.rows.length} PM columns in containers table:`);
    result.rows.forEach((row: any) => {
      console.log(`   - ${row.column_name} (${row.data_type}) ${row.column_default ? `DEFAULT ${row.column_default}` : ''}`);
    });

    // Also check if the enum exists
    const enumResult = await db.execute(sql`
      SELECT n.nspname AS schema_name, t.typname AS type_name
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typname = 'pm_status_enum'
    `);

    if (enumResult.rows.length > 0) {
      console.log(`\n✅ PM status enum 'pm_status_enum' exists`);
    } else {
      console.log(`\n❌ PM status enum 'pm_status_enum' does not exist`);
    }

  } catch (err: any) {
    console.error('❌ Failed to verify columns:', err.message);
  }

  console.log('\n' + '='.repeat(80));
  console.log(success ? '✅ Migration completed successfully!' : '❌ Migration failed');
  console.log('='.repeat(80));
  console.log('');
}

run().catch((err) => {
  console.error('\n❌ Migration script failed:', err);
  process.exit(1);
});
