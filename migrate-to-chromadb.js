import 'dotenv/config';
import { db } from './server/db.js';
import { manualChunks } from './shared/schema.js';
import { eq } from 'drizzle-orm';
import { chromaVectorStore } from './server/services/chromaVectorStore.js';

async function migrateToChromaDB() {
  console.log('🚀 MIGRATING FROM POSTGRESQL TO CHROMADB');
  console.log('═'.repeat(60));

  try {
    // Initialize ChromaDB
    console.log('Initializing ChromaDB...');
    await chromaVectorStore.initialize();

    // Get all chunks with embeddings from PostgreSQL
    console.log('Fetching chunks from PostgreSQL...');
    const allChunks = await db.select().from(manualChunks);

    // Filter chunks that have embeddings
    const chunks = allChunks.filter(chunk => chunk.embedding !== null);

    if (chunks.length === 0) {
      console.log('No chunks with embeddings found in PostgreSQL');
      return;
    }

    console.log(`Found ${chunks.length} chunks with embeddings to migrate`);

    // Convert to ChromaDB format
    const chromaChunks = chunks.map(chunk => ({
      id: chunk.id,
      text: chunk.chunkText,
      metadata: {
        manualId: chunk.manualId,
        pageNum: chunk.pageNum,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
        brand: chunk.metadata?.brand || 'Unknown',
        model: chunk.metadata?.model || 'Unknown',
        alarmCodes: chunk.metadata?.alarmCodes || [],
        partNumbers: chunk.metadata?.partNumbers || []
      }
    }));

    // Add to ChromaDB in batches
    console.log('Migrating to ChromaDB...');
    await chromaVectorStore.addChunks(chromaChunks);

    console.log('✅ Migration completed successfully!');
    console.log(`📊 Migrated ${chunks.length} chunks to ChromaDB`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

migrateToChromaDB();
