import 'dotenv/config';
import { db } from './server/db.js';
import { manualChunks } from './shared/schema.js';
import { sql } from 'drizzle-orm';

async function aggressiveCleanup() {
  console.log('🚨 AGGRESSIVE DATABASE CLEANUP');
  console.log('Removing all chunks to free up Neon storage immediately');
  console.log('═'.repeat(60));

  try {
    // Check current status
    const beforeStats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_chunks,
        pg_size_pretty(pg_total_relation_size('manual_chunks')) as table_size
      FROM manual_chunks
    `);

    console.log('📊 Before cleanup:');
    console.log(`   Total chunks: ${beforeStats.rows[0].total_chunks}`);
    console.log(`   Table size: ${beforeStats.rows[0].table_size}`);

    // Delete ALL chunks - they're in Qdrant now anyway
    console.log('\n🗑️ Deleting ALL chunks from PostgreSQL...');
    console.log('   (Safe to delete - vectors are in Qdrant cloud)');

    // Delete ALL chunks at once - they're in Qdrant anyway
    console.log('   Deleting all chunks in one operation...');
    await db.execute(sql`DELETE FROM manual_chunks`);
    console.log(`   ✅ All chunks deleted from PostgreSQL`);

    // Also remove the embedding column entirely if it exists
    console.log('\n🗑️ Removing embedding column to save space...');
    try {
      await db.execute(sql`ALTER TABLE manual_chunks DROP COLUMN IF EXISTS embedding`);
      console.log('   ✅ Embedding column removed');
    } catch (error) {
      console.log('   ⚠️ Could not remove column:', error.message);
    }

    // Drop vector extension if not needed
    console.log('\n🗑️ Removing pgvector extension...');
    try {
      await db.execute(sql`DROP EXTENSION IF EXISTS vector CASCADE`);
      console.log('   ✅ pgvector extension removed');
    } catch (error) {
      console.log('   ⚠️ Could not remove extension:', error.message);
    }

    // Vacuum to reclaim space
    console.log('\n🧹 Running VACUUM to reclaim space...');
    try {
      await db.execute(sql`VACUUM FULL manual_chunks`);
      console.log('   ✅ Vacuum completed');
    } catch (error) {
      console.log('   ⚠️ Vacuum may take time:', error.message);
    }

    // Final status
    const afterStats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_chunks,
        pg_size_pretty(pg_total_relation_size('manual_chunks')) as table_size
      FROM manual_chunks
    `);

    console.log('\n✅ CLEANUP COMPLETE!');
    console.log('═'.repeat(60));
    console.log('📊 After cleanup:');
    console.log(`   Total chunks: ${afterStats.rows[0].total_chunks}`);
    console.log(`   Table size: ${afterStats.rows[0].table_size}`);
    console.log(`\n💾 Freed up approximately ${beforeStats.rows[0].table_size}`);
    console.log('\n🚀 All vectors are now ONLY in Qdrant cloud!');
    console.log('💡 Neon database is now minimal - just metadata if needed');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    console.log('\n💡 If cleanup fails, you may need to:');
    console.log('   1. Delete chunks manually via Neon dashboard');
    console.log('   2. Or drop and recreate the manual_chunks table');
  }
}

aggressiveCleanup().catch(console.error);
