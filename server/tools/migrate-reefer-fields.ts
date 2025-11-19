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
          if (err?.message?.includes('already exists')) {
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
  console.log('🚀 Starting Reefer Master Fields Migration');
  console.log('='.repeat(80));
  console.log(`\n📊 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);

  // List of migrations to run in order
  const migrations = [
    '20251119_add_reefer_master_fields.sql',
    '20251120_add_more_master_fields.sql'
  ];

  let successCount = 0;
  let failCount = 0;

  for (const migration of migrations) {
    const success = await runMigration(migration);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('='.repeat(80));
  console.log('📈 Migration Summary');
  console.log('='.repeat(80));
  console.log(`✅ Successful migrations: ${successCount}`);
  console.log(`❌ Failed migrations: ${failCount}`);
  console.log(`📊 Total migrations: ${migrations.length}`);

  // Verify the columns were added
  console.log('\n🔍 Verifying new columns...');
  try {
    const result = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'containers'
      AND column_name IN (
        'product_type', 'size_type', 'group_name', 'gku_product_name',
        'category', 'depot', 'yom', 'grade', 'reefer_unit', 'reefer_model',
        'container_no', 'available_location', 'mfg_year', 'inventory_status',
        'reefer_unit_model_name', 'reefer_unit_serial_no'
      )
      ORDER BY column_name
    `);

    console.log(`\n✅ Found ${result.rows.length} reefer master columns in containers table:`);
    result.rows.forEach((row: any) => {
      console.log(`   - ${row.column_name} (${row.data_type})`);
    });
  } catch (err: any) {
    console.error('❌ Failed to verify columns:', err.message);
  }

  console.log('\n' + '='.repeat(80));
  console.log(failCount === 0 ? '✅ All migrations completed successfully!' : '⚠️  Some migrations failed');
  console.log('='.repeat(80));
  console.log('');
}

run().catch((err) => {
  console.error('\n❌ Migration script failed:', err);
  process.exit(1);
});
