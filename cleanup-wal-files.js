import 'dotenv/config';
import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function cleanupWALFiles() {
  console.log('🧹 CLEANING UP WAL FILES AND RECLAIMING SPACE');
  console.log('═'.repeat(70));
  console.log();

  try {
    // Check current WAL size
    console.log('📊 Current WAL Status:');
    const walCheck = await db.execute(sql`
      SELECT 
        pg_size_pretty(pg_current_wal_lsn() - '0/0') as wal_size
    `);
    console.log(`   WAL Size: ${walCheck.rows[0].wal_size}`);
    console.log();

    // Run CHECKPOINT to force WAL cleanup
    console.log('🔄 Running CHECKPOINT to flush WAL files...');
    try {
      await db.execute(sql`CHECKPOINT`);
      console.log('   ✅ Checkpoint completed');
    } catch (error) {
      console.log('   ⚠️ Checkpoint failed:', error.message);
    }

    // Vacuum full to reclaim space
    console.log('\n🧹 Running VACUUM FULL on all tables...');
    const tables = await db.execute(sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    `);

    for (const table of tables.rows) {
      try {
        console.log(`   Vacuuming ${table.tablename}...`);
        await db.execute(sql.raw(`VACUUM FULL ${table.tablename}`));
        console.log(`   ✅ ${table.tablename} cleaned`);
      } catch (error) {
        console.log(`   ⚠️ Failed to vacuum ${table.tablename}: ${error.message}`);
      }
    }

    // Analyze tables for optimization
    console.log('\n📊 Analyzing tables for optimization...');
    await db.execute(sql`ANALYZE`);
    console.log('   ✅ Tables analyzed');

    // Check database size after cleanup
    console.log('\n📊 Final Database Size:');
    const finalSize = await db.execute(sql`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as total_size,
        pg_database_size(current_database()) as size_bytes
    `);
    console.log(`   Database Size: ${finalSize.rows[0].total_size}`);
    console.log(`   Size in MB: ${(finalSize.rows[0].size_bytes / 1024 / 1024).toFixed(2)} MB`);

    console.log('\n═'.repeat(70));
    console.log('💡 IMPORTANT NOTES:');
    console.log('   - WAL files are maintained by Neon automatically');
    console.log('   - The 1.69 GB shown in Neon dashboard includes:');
    console.log('     • Active database data: ~12 MB');
    console.log('     • WAL files: ~1.7 GB (transaction logs)');
    console.log('     • Neon backups: Varies');
    console.log('   - WAL files will be cleaned by Neon over time');
    console.log('   - You may need to wait or contact Neon support for WAL cleanup');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

cleanupWALFiles().catch(console.error);




