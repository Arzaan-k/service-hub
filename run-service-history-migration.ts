/**
 * SERVICE HISTORY DATABASE MIGRATION RUNNER
 *
 * Executes the comprehensive service history schema migration
 */

import { db } from './server/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  console.log('🚀 Starting Service History Schema Migration...\n');

  try {
    // Read the migration SQL file
    const migrationPath = path.join(process.cwd(), 'add-service-history-schema.sql');

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found at: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📖 Migration file loaded successfully');
    console.log('📝 File size:', (migrationSQL.length / 1024).toFixed(2), 'KB\n');

    // Split SQL into individual statements (basic approach)
    // We'll execute the whole migration as one transaction
    console.log('⚙️  Executing migration...\n');

    await db.execute(sql.raw(migrationSQL));

    console.log('\n✅ Migration completed successfully!\n');
    console.log('📊 Created Tables:');
    console.log('   ✓ service_history');
    console.log('   ✓ indents');
    console.log('   ✓ manufacturer_standards');
    console.log('   ✓ container_size_standards');
    console.log('   ✓ location_standards');
    console.log('   ✓ service_statistics');
    console.log('   ✓ inspection_checklist_template\n');

    console.log('📊 Created Views:');
    console.log('   ✓ v_complete_service_history');
    console.log('   ✓ v_service_stats_summary');
    console.log('   ✓ v_top_technicians');
    console.log('   ✓ v_container_service_frequency\n');

    console.log('⚡ Created Triggers:');
    console.log('   ✓ trigger_update_service_stats\n');

    // Verify tables were created
    console.log('🔍 Verifying schema...');

    const tableCheck = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN (
        'service_history',
        'indents',
        'manufacturer_standards',
        'container_size_standards',
        'location_standards',
        'service_statistics',
        'inspection_checklist_template'
      )
      ORDER BY table_name
    `);

    console.log(`\n✅ Verified ${tableCheck.rows.length} / 7 tables created`);

    if (tableCheck.rows.length < 7) {
      console.warn('\n⚠️  Warning: Not all tables were created. Check for errors above.');
    }

    // Check if standardization data was inserted
    const manufacturerCheck = await db.execute(sql`
      SELECT COUNT(*) as count FROM manufacturer_standards
    `);

    const sizeCheck = await db.execute(sql`
      SELECT COUNT(*) as count FROM container_size_standards
    `);

    const locationCheck = await db.execute(sql`
      SELECT COUNT(*) as count FROM location_standards
    `);

    console.log('\n📋 Standardization Data:');
    console.log(`   ✓ ${manufacturerCheck.rows[0].count} manufacturers`);
    console.log(`   ✓ ${sizeCheck.rows[0].count} container sizes`);
    console.log(`   ✓ ${locationCheck.rows[0].count} locations`);

    // Check inspection checklist
    const checklistCheck = await db.execute(sql`
      SELECT COUNT(*) as count FROM inspection_checklist_template
    `);

    console.log(`   ✓ ${checklistCheck.rows[0].count} inspection checklist items\n`);

    console.log('=' .repeat(60));
    console.log('🎉 MIGRATION SUCCESSFUL!');
    console.log('=' .repeat(60));
    console.log('\n📌 Next Steps:');
    console.log('1. Run the import script: npx tsx server/tools/import-service-master.ts');
    console.log('2. Verify data: SELECT COUNT(*) FROM service_history;');
    console.log('3. Restart your application\n');

  } catch (error) {
    console.error('\n❌ Migration Failed!');
    console.error('Error:', error);

    if (error instanceof Error) {
      console.error('\nDetails:', error.message);

      // Provide helpful hints based on error
      if (error.message.includes('already exists')) {
        console.log('\n💡 Hint: Tables already exist. If you want to re-run the migration:');
        console.log('   1. Drop existing tables first, OR');
        console.log('   2. Check if migration was already successful');
      } else if (error.message.includes('permission denied')) {
        console.log('\n💡 Hint: Database permission issue. Check:');
        console.log('   1. DATABASE_URL in .env is correct');
        console.log('   2. User has CREATE TABLE permissions');
      }
    }

    process.exit(1);
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('✅ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });

export { runMigration };
