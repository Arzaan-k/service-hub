import 'dotenv/config';
import { db } from './server/db.js';
import { manualChunks } from './shared/schema.js';
import { eq, sql, lte } from 'drizzle-orm';

async function emergencyCleanup() {
  console.log('🚨 EMERGENCY DATABASE CLEANUP');
  console.log('Neon database is at 512MB limit - need to free space immediately');

  try {
    console.log('📊 Checking current status...');
    const stats = await db.execute(sql`
      SELECT COUNT(*) as total_chunks,
             pg_size_pretty(pg_total_relation_size('manual_chunks')) as table_size
      FROM manual_chunks
    `);
    console.log(`   Total chunks: ${stats.rows[0].total_chunks}`);
    console.log(`   Table size: ${stats.rows[0].table_size}`);

    // Delete chunks in small batches to avoid hitting limits
    console.log('\n🗑️ Deleting chunks in small batches...');

    const batchSize = 1000; // Small batches to avoid memory issues
    let deleted = 0;
    let totalToDelete = stats.rows[0].total_chunks;

    while (deleted < totalToDelete) {
      try {
        // Delete a small batch
        const result = await db.delete(manualChunks)
          .where(sql`id IN (SELECT id FROM manual_chunks LIMIT ${batchSize})`)
          .returning();

        deleted += result.length;
        console.log(`   Deleted ${deleted}/${totalToDelete} chunks...`);

        if (result.length === 0) break; // No more chunks to delete

      } catch (error) {
        console.log(`⚠️ Batch delete failed, trying smaller batch...`);
        // Try even smaller batches
        try {
          const result = await db.delete(manualChunks)
            .where(sql`id IN (SELECT id FROM manual_chunks LIMIT 100)`)
            .returning();
          deleted += result.length;
          console.log(`   Deleted ${deleted} chunks (smaller batch)...`);
        } catch (innerError) {
          console.log('❌ Even small batches failing. Trying table drop...');

          // Last resort: drop and recreate table
          await db.execute(sql`DROP TABLE IF EXISTS manual_chunks`);
          await db.execute(sql`
            CREATE TABLE manual_chunks (
              id text PRIMARY KEY,
              manual_id text REFERENCES manuals(id),
              chunk_text text NOT NULL,
              chunk_embedding_id text,
              embedding vector(384),
              page_num integer,
              start_offset integer,
              end_offset integer,
              metadata jsonb,
              created_at timestamp with time zone DEFAULT now()
            )
          `);
          console.log('✅ Dropped and recreated manual_chunks table');
          break;
        }
      }
    }

    console.log(`\n✅ Emergency cleanup complete!`);
    console.log(`📊 Deleted ${deleted} chunks`);

    // Final status check
    const finalStats = await db.execute(sql`
      SELECT COUNT(*) as total_chunks,
             pg_size_pretty(pg_total_relation_size('manual_chunks')) as table_size
      FROM manual_chunks
    `);
    console.log(`\n📈 Final status:`);
    console.log(`   Total chunks: ${finalStats.rows[0].total_chunks}`);
    console.log(`   Table size: ${finalStats.rows[0].table_size}`);

    console.log('\n🚀 Database space freed! You can now:');
    console.log('1. Re-upload and process manuals with Qdrant');
    console.log('2. Use smaller batch sizes for processing');
    console.log('3. Upgrade Neon plan for larger storage');

  } catch (error) {
    console.error('❌ Emergency cleanup failed:', error);
    console.log('\n💡 Manual solutions:');
    console.log('1. Go to Neon dashboard and delete data manually');
    console.log('2. Upgrade your Neon plan for more storage');
    console.log('3. Use Qdrant for vector storage instead');
  }
}

emergencyCleanup().catch(console.error);



