import 'dotenv/config';
import { db } from './server/db.js';
import { manualChunks } from './shared/schema.js';
import { eq, sql } from 'drizzle-orm';
import { cloudQdrantStore } from './server/services/cloudQdrantStore.js';

async function migrateToCloudQdrant() {
  console.log('🚀 MIGRATING TO CLOUD QDRANT');
  console.log('Moving all vectors from Neon DB to Qdrant cloud');
  console.log('═'.repeat(60));

  // Initialize Qdrant
  await cloudQdrantStore.initializeCollection();

  // Get all chunks from database that don't have null embeddings
  console.log('📊 Fetching chunks from Neon database...');
  const chunks = await db.execute(sql`
    SELECT id, manual_id, chunk_text, embedding, page_num,
           start_offset, end_offset, metadata, created_at
    FROM manual_chunks
    WHERE embedding IS NOT NULL
    ORDER BY created_at ASC
  `);

  console.log(`📦 Found ${chunks.rows.length} chunks with embeddings to migrate`);

  if (chunks.rows.length === 0) {
    console.log('❌ No chunks with embeddings found. Run manual processing first.');
    return;
  }

  // Check current Qdrant stats
  const qdrantStats = await cloudQdrantStore.getStats();
  console.log(`📊 Qdrant currently has ${qdrantStats.count} vectors`);

  // Convert database chunks to Qdrant format
  const qdrantChunks = chunks.rows.map(row => ({
    text: row.chunk_text,
    metadata: {
      manualId: row.manual_id,
      pageNum: row.page_num,
      startOffset: row.start_offset,
      endOffset: row.end_offset,
      ...row.metadata
    },
    id: row.id,
  }));

  console.log('🔄 Starting migration to Qdrant cloud...');

  // Migrate in batches to avoid overwhelming Qdrant
  const batchSize = 500; // Smaller batches for cloud service
  let migrated = 0;

  for (let i = 0; i < qdrantChunks.length; i += batchSize) {
    const batch = qdrantChunks.slice(i, i + batchSize);

    try {
      await cloudQdrantStore.addChunks(batch);
      migrated += batch.length;

      console.log(`💾 Migrated ${migrated}/${qdrantChunks.length} chunks to Qdrant...`);

      // Small delay to avoid rate limiting
      if (i + batchSize < qdrantChunks.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      console.log(`⚠️ Batch migration failed at ${i}, retrying smaller batches...`);

      // Retry with smaller batches
      for (let j = 0; j < batch.length; j += 50) {
        const smallBatch = batch.slice(j, j + 50);
        try {
          await cloudQdrantStore.addChunks(smallBatch);
          migrated += smallBatch.length;
        } catch (smallError) {
          console.log(`❌ Failed to migrate small batch at ${i + j}`);
        }
      }
    }
  }

  // Verify migration
  const finalStats = await cloudQdrantStore.getStats();
  console.log('\n✅ MIGRATION COMPLETE!');
  console.log('═'.repeat(60));
  console.log(`📊 Migrated ${migrated} chunks to Qdrant cloud`);
  console.log(`📈 Qdrant now has ${finalStats.count} total vectors`);
  console.log(`💾 Freed up Neon database space!`);

  // Optional: Clean up Neon (remove embeddings to save space)
  console.log('\n🧹 CLEANUP OPTIONS:');
  console.log('1. Remove embeddings from Neon to save space:');
  console.log('   Run: npx tsx free-neon-space.js');
  console.log('2. Or keep both for backup (recommended initially)');

  console.log('\n🚀 RAG system now uses Qdrant cloud for vector storage!');
  console.log('💡 No more Neon database storage limits!');
}

migrateToCloudQdrant().catch(console.error);




<<<<<<< HEAD
=======

>>>>>>> all-ui-working
