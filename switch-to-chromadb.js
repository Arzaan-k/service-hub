import 'dotenv/config';
import { ChromaClient } from 'chromadb';
import { db } from './server/db.ts';
import { manualChunks } from './shared/schema.ts';
import { eq, sql } from 'drizzle-orm';

async function migrateToChromaDB() {
  console.log('🔄 Migrating RAG data from PostgreSQL to ChromaDB...');
  console.log('This will free up your Neon database storage.');

  // Initialize ChromaDB client
  const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8000';
  const chroma = new ChromaClient({ path: chromaUrl });

  try {
    // Test ChromaDB connection
    console.log('🔗 Testing ChromaDB connection...');
    await chroma.heartbeat();
    console.log('✅ ChromaDB connection successful');

    // Create or get collection
    console.log('📚 Setting up ChromaDB collection...');
    let collection;
    try {
      collection = await chroma.getCollection({ name: 'manual_chunks' });
      console.log('✅ Using existing collection');
    } catch {
      collection = await chroma.createCollection({ name: 'manual_chunks' });
      console.log('✅ Created new collection');
    }

    // Get all chunks from PostgreSQL that have embeddings
    console.log('📊 Fetching chunks from PostgreSQL...');
    const chunks = await db.select().from(manualChunks).where(sql`${manualChunks.embedding} IS NOT NULL`);

    console.log(`📦 Found ${chunks.length} chunks with embeddings to migrate`);

    if (chunks.length === 0) {
      console.log('❌ No chunks with embeddings found. Run manual processing first.');
      return;
    }

    // Migrate chunks to ChromaDB in batches
    const batchSize = 100;
    let migrated = 0;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      const ids = batch.map(chunk => chunk.id);
      const documents = batch.map(chunk => chunk.chunkText);
      const embeddings = batch.map(chunk => chunk.embedding);
      const metadatas = batch.map(chunk => ({
        manualId: chunk.manualId,
        pageNum: chunk.pageNum,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
        ...chunk.metadata
      }));

      await collection.add({
        ids,
        documents,
        embeddings,
        metadatas
      });

      migrated += batch.length;
      console.log(`💾 Migrated ${migrated}/${chunks.length} chunks...`);
    }

    console.log('✅ Migration to ChromaDB complete!');
    console.log(`📊 Migrated ${migrated} chunks with embeddings`);

    // Optional: Clean up PostgreSQL (be careful!)
    console.log('\n🧹 To free up Neon storage, you can now:');
    console.log('   1. Keep embeddings in ChromaDB only');
    console.log('   2. Remove embedding column from PostgreSQL');
    console.log('   3. Or keep both for redundancy');

    console.log('\n🚀 Your RAG system now uses ChromaDB for vectors!');
    console.log('💡 ChromaDB runs locally - no storage limits!');

  } catch (error) {
    console.error('❌ Migration failed:', error);

    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 ChromaDB not running. Start it with:');
      console.log('   docker run -p 8000:8000 chromadb/chroma:latest');
    }
  }
}

migrateToChromaDB().catch(console.error);
