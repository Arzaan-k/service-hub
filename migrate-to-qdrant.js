import 'dotenv/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { db } from './server/db.ts';
import { manualChunks } from './shared/schema.ts';
import { sql } from 'drizzle-orm';

async function migrateToQdrant() {
  console.log('🔄 Migrating RAG data to Qdrant vector database...');
  console.log('This will completely offload vectors from your Neon DB!');

  // Initialize Qdrant client
  const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
  const qdrant = new QdrantClient({ url: qdrantUrl });

  try {
    // Test Qdrant connection
    console.log('🔗 Testing Qdrant connection...');
    const health = await qdrant.api('get', '/health');
    console.log('✅ Qdrant connection successful');

    const collectionName = 'manual_chunks';

    // Check if collection exists, create if not
    console.log('📚 Setting up Qdrant collection...');
    try {
      await qdrant.getCollection(collectionName);
      console.log('✅ Using existing collection');
    } catch {
      await qdrant.createCollection(collectionName, {
        vectors: {
          size: 384, // all-MiniLM-L6-v2 dimensions
          distance: 'Cosine'
        }
      });
      console.log('✅ Created new collection');
    }

    // Get all chunks from PostgreSQL that have embeddings
    console.log('📊 Fetching chunks from PostgreSQL...');
    const chunks = await db.execute(sql`
      SELECT id, manual_id, chunk_text, embedding, page_num,
             start_offset, end_offset, metadata, created_at
      FROM manual_chunks
      WHERE embedding IS NOT NULL
      LIMIT 10000
    `);

    console.log(`📦 Found ${chunks.rows.length} chunks with embeddings to migrate`);

    if (chunks.rows.length === 0) {
      console.log('❌ No chunks with embeddings found in PostgreSQL');
      return;
    }

    // Migrate chunks to Qdrant in batches
    const batchSize = 100;
    let migrated = 0;

    for (let i = 0; i < chunks.rows.length; i += batchSize) {
      const batch = chunks.rows.slice(i, i + batchSize);

      const points = batch.map(chunk => ({
        id: chunk.id,
        vector: chunk.embedding,
        payload: {
          manualId: chunk.manual_id,
          text: chunk.chunk_text,
          pageNum: chunk.page_num,
          startOffset: chunk.start_offset,
          endOffset: chunk.end_offset,
          metadata: chunk.metadata,
          createdAt: chunk.created_at
        }
      }));

      await qdrant.upsert(collectionName, {
        points
      });

      migrated += batch.length;
      console.log(`💾 Migrated ${migrated}/${chunks.rows.length} chunks...`);
    }

    console.log('✅ Migration to Qdrant complete!');
    console.log(`📊 Migrated ${migrated} chunks with embeddings`);

    // Verify the migration
    console.log('🔍 Verifying migration...');
    const collectionInfo = await qdrant.getCollection(collectionName);
    console.log(`📈 Qdrant collection now has ${collectionInfo.points_count} vectors`);

    console.log('\n🧹 CLEANUP OPTIONS:');
    console.log('1. Keep PostgreSQL chunks for backup (recommended)');
    console.log('2. Remove embeddings from PostgreSQL to save space:');
    console.log('   UPDATE manual_chunks SET embedding = NULL WHERE embedding IS NOT NULL;');
    console.log('3. Remove entire chunks table (if you trust Qdrant):');
    console.log('   DROP TABLE manual_chunks;');

    console.log('\n🚀 Your RAG system now uses Qdrant for blazing-fast vector search!');
    console.log('💡 Qdrant runs locally - no storage limits, no API costs!');

  } catch (error) {
    console.error('❌ Migration failed:', error);

    if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      console.log('\n💡 Qdrant not running. Start it with:');
      console.log('   docker run -p 6333:6333 qdrant/qdrant');
      console.log('   OR download from: https://qdrant.tech/documentation/quick-start/');
    }

    console.log('\n🔧 Alternative: Use cloud Qdrant');
    console.log('   Sign up at: https://qdrant.tech/');
    console.log('   Set QDRANT_URL in your .env file');
  }
}

migrateToQdrant().catch(console.error);




