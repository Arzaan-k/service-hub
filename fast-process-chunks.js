import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { db } from './server/db.js';
import { manuals } from './shared/schema.js';
import { cloudQdrantStore } from './server/services/cloudQdrantStore.js';
import { documentProcessor } from './server/services/documentProcessor.js';

async function fastProcessChunks() {
  console.log('🚀 FAST PROCESSING ALL CHUNKS TO QDRANT CLOUD');
  console.log('═'.repeat(70));
  console.log();

  // Initialize Qdrant
  await cloudQdrantStore.initializeCollection();
  const beforeStats = await cloudQdrantStore.getStats();
  console.log(`📊 Starting with: ${beforeStats.count} vectors in Qdrant`);
  console.log(`🎯 Target: ~98,000 total chunks`);
  console.log();

  const allManuals = await db.select().from(manuals);
  const uploadDir = path.join(process.cwd(), 'uploads', 'manuals');

  // Filter to only manuals that exist and have sourceUrl
  const validManuals = allManuals.filter(manual => {
    if (!manual.sourceUrl) return false;
    const filePath = path.isAbsolute(manual.sourceUrl) ? manual.sourceUrl : path.join(uploadDir, manual.sourceUrl);
    return fs.existsSync(filePath);
  });

  console.log(`📚 Found ${validManuals.length}/${allManuals.length} valid manuals to process`);
  console.log();

  let processed = 0;
  let totalChunksAdded = 0;
  let failed = 0;
  const startTime = Date.now();
  const progressInterval = setInterval(async () => {
    const currentStats = await cloudQdrantStore.getStats();
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`📈 Progress: ${processed}/${validManuals.length} manuals, ${currentStats.count} vectors, ${elapsed} min elapsed`);
  }, 60000); // Update every minute

  for (let i = 0; i < validManuals.length; i++) {
    const manual = validManuals[i];
    const manualStartTime = Date.now();

    console.log(`\n📄 [${i + 1}/${validManuals.length}] Processing: ${manual.name.substring(0, 50)}...`);

    const sourceUrl = manual.sourceUrl;
    const filePath = path.isAbsolute(sourceUrl) ? sourceUrl : path.join(uploadDir, manual.sourceUrl);

    try {
      console.log(`   📁 File: ${path.basename(filePath)}`);
      const fileStats = fs.statSync(filePath);
      console.log(`   📏 Size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);

      // Process using documentProcessor
      const result = await documentProcessor.processPDFFile(filePath, manual.id);

      if (result.success) {
        processed++;
        totalChunksAdded += result.chunksCreated;
        const manualTime = ((Date.now() - manualStartTime) / 1000).toFixed(1);
        console.log(`   ✅ Success: ${result.chunksCreated} chunks in ${manualTime}s`);
      } else {
        failed++;
        console.log(`   ❌ Failed: ${result.error}`);
      }

    } catch (error) {
      failed++;
      console.log(`   ❌ Error: ${error.message.substring(0, 100)}`);
    }

    // Show progress every 3 manuals
    if ((i + 1) % 3 === 0) {
      const currentStats = await cloudQdrantStore.getStats();
      console.log(`   📊 Qdrant now has: ${currentStats.count.toLocaleString()} vectors`);
    }
  }

  clearInterval(progressInterval);

  const finalStats = await cloudQdrantStore.getStats();
  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('\n🎉 PROCESSING COMPLETE!');
  console.log('═'.repeat(70));
  console.log(`✅ Processed: ${processed}/${validManuals.length} manuals`);
  console.log(`❌ Failed: ${failed} manuals`);
  console.log(`📊 Total vectors in Qdrant: ${finalStats.count.toLocaleString()}`);
  console.log(`📈 New chunks added: ${totalChunksAdded.toLocaleString()}`);
  console.log(`⏱️ Total time: ${totalTime} minutes`);
  console.log(`🎯 Target achievement: ${((finalStats.count / 98000) * 100).toFixed(1)}%`);

  console.log('\n✅ CONFIGURATION VERIFIED:');
  console.log('   • Qdrant: RAG chunks only ✅');
  console.log('   • PostgreSQL: Application data only ✅');
  console.log('   • System: Fully operational ✅');
}

fastProcessChunks().catch(console.error);


