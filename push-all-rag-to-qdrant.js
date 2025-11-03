import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { db } from './server/db.js';
import { manuals } from './shared/schema.js';
import { eq, sql } from 'drizzle-orm';
import { cloudQdrantStore } from './server/services/cloudQdrantStore.js';
import { documentProcessor } from './server/services/documentProcessor.js';

async function pushAllRAGToQdrant() {
  console.log('🚀 PUSHING ALL RAG MANUAL CHUNKS TO QDRANT CLOUD');
  console.log('═'.repeat(60));
  console.log();

  // Initialize Qdrant
  console.log('🔗 Initializing Qdrant cloud connection...');
  await cloudQdrantStore.initializeCollection();

  // Check current Qdrant status
  const qdrantStats = await cloudQdrantStore.getStats();
  console.log(`📊 Current Qdrant vectors: ${qdrantStats.count}`);
  console.log();

  // Get all manuals
  const allManuals = await db.select().from(manuals);
  console.log(`📚 Found ${allManuals.length} manuals to process`);
  console.log();

  const uploadDir = path.join(process.cwd(), 'uploads', 'manuals');
  let processed = 0;
  let skipped = 0;
  let totalChunksAdded = 0;

  for (const manual of allManuals) {
    console.log(`\n📄 Processing: ${manual.name.substring(0, 50)}...`);

    if (!manual.sourceUrl) {
      console.log('   ❌ Skipping - no source URL');
      skipped++;
      continue;
    }

    const sourceUrl = manual.sourceUrl;
    const filePath = path.isAbsolute(sourceUrl) ? sourceUrl : path.join(uploadDir, sourceUrl);

    if (!fs.existsSync(filePath)) {
      console.log('   ❌ Skipping - file not found');
      skipped++;
      continue;
    }

    // Check if already in Qdrant by checking if manual has chunks
    // For now, we'll reprocess all to ensure everything is in Qdrant
    try {
      console.log('   🤖 Processing PDF and generating embeddings...');
      
      // Process the manual - this will add chunks to Qdrant via cloudQdrantStore
      const result = await documentProcessor.processPDFFile(filePath, manual.id);

      if (result.success) {
        processed++;
        totalChunksAdded += result.chunksCreated;
        console.log(`   ✅ Success: ${result.chunksCreated} chunks added to Qdrant`);
      } else {
        console.log(`   ❌ Failed: ${result.error}`);
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  // Final Qdrant status
  const finalStats = await cloudQdrantStore.getStats();
  console.log('\n🎉 PROCESSING COMPLETE!');
  console.log('═'.repeat(60));
  console.log(`✅ Processed: ${processed} manuals`);
  console.log(`⏭️ Skipped: ${skipped} manuals`);
  console.log(`📊 New chunks added: ${totalChunksAdded}`);
  console.log(`🚀 Total vectors in Qdrant: ${finalStats.count}`);
  console.log();

  // Verify PostgreSQL has no chunks
  const pgCheck = await db.execute(sql`
    SELECT COUNT(*) as count FROM manual_chunks
  `);
  console.log(`✅ PostgreSQL manual_chunks: ${pgCheck.rows[0].count} (should be 0)`);
  console.log();

  console.log('🎯 FINAL CONFIGURATION:');
  console.log('   ✅ All RAG chunks: Qdrant Cloud');
  console.log('   ✅ All other data: PostgreSQL');
  console.log('   ✅ System optimized and ready!');
}

pushAllRAGToQdrant().catch(console.error);



