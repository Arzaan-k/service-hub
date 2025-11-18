import 'dotenv/config';
import { fileVectorStore } from './server/services/fileVectorStore.js';
import { cloudQdrantStore } from './server/services/cloudQdrantStore.js';

async function pushRemainingChunksToQdrant() {
  console.log('🎯 PUSHING REMAINING LOCAL CHUNKS TO QDRANT');
  console.log('═'.repeat(80));

  try {
    // Initialize Qdrant connection
    console.log('🔗 Initializing Qdrant connection...');
    await cloudQdrantStore.initializeCollection();

    // Get current Qdrant stats
    const qdrantStats = await cloudQdrantStore.getStats();
    console.log(`📊 Current Qdrant vectors: ${qdrantStats.count.toLocaleString()}`);

    // Get local chunks stats
    const localStats = await fileVectorStore.getStats();
    console.log(`📁 Local vectors.json chunks: ${localStats.count.toLocaleString()}`);

    // Get all chunks from local file store
    const allLocalChunks = fileVectorStore.getAllChunks();

    if (!allLocalChunks || allLocalChunks.length === 0) {
      console.log('❌ No local chunks found!');
      return;
    }

    console.log(`🔄 Processing ${allLocalChunks.length.toLocaleString()} local chunks...`);

    // Get existing original IDs from Qdrant to avoid duplicates
    console.log('🔍 Checking for existing chunks in Qdrant...');
    const existingIds = await cloudQdrantStore.getExistingOriginalIds();

    // Filter local chunks to only include those not already in Qdrant
    const newChunks = allLocalChunks.filter(chunk => !existingIds.has(chunk.id));

    if (newChunks.length === 0) {
      console.log('✅ All local chunks are already in Qdrant! No duplicates to push.');
      return;
    }

    console.log(`📤 Found ${newChunks.length.toLocaleString()} new chunks not in Qdrant`);
    console.log(`⏭️  Skipping ${existingIds.size.toLocaleString()} chunks already in Qdrant`);

    // Convert new chunks to the format expected by cloudQdrantStore
    const qdrantChunks = newChunks.map(chunk => ({
      text: chunk.text,
      metadata: chunk.metadata,
      id: chunk.id
    }));

    console.log(`📤 Starting batch upload of ${newChunks.length.toLocaleString()} new chunks to Qdrant...`);
    console.log('⏳ This may take several minutes...');

    // Process in smaller batches to avoid memory issues and provide progress updates
    const batchSize = 1000; // Process 1000 chunks at a time
    let totalProcessed = 0;

    for (let i = 0; i < qdrantChunks.length; i += batchSize) {
      const batch = qdrantChunks.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(qdrantChunks.length / batchSize);

      console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} chunks)...`);

      try {
        await cloudQdrantStore.addChunks(batch);
        totalProcessed += batch.length;
        console.log(`✅ Batch ${batchNumber}/${totalBatches} completed. Total processed: ${totalProcessed.toLocaleString()}/${qdrantChunks.length.toLocaleString()}`);
      } catch (error) {
        console.error(`❌ Error processing batch ${batchNumber}:`, error.message);
        // Continue with next batch instead of stopping
        console.log('⏭️  Continuing with next batch...');
      }

      // Small delay between batches to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Get final stats
    console.log('\n📊 FINAL VERIFICATION:');
    const finalStats = await cloudQdrantStore.getStats();
    console.log(`✅ Final Qdrant vectors: ${finalStats.count.toLocaleString()}`);

    const addedChunks = finalStats.count - qdrantStats.count;
    console.log(`🎉 Successfully added ${addedChunks.toLocaleString()} new chunks to Qdrant!`);
    console.log(`📊 Expected to add: ${newChunks.length.toLocaleString()} chunks`);

    if (addedChunks === totalProcessed) {
      console.log('\n🏆 SUCCESS! All remaining local chunks have been pushed to Qdrant without duplicates.');
      console.log('💡 Your RAG system now has access to all unique manual chunks.');
    } else if (addedChunks > 0) {
      console.log(`\n⚠️  Added ${addedChunks} chunks, processed ${totalProcessed} chunks in batches.`);
      console.log('💡 Some batches may have had processing errors, but progress was made.');
    } else {
      console.log('\n❌ No chunks were added. Check for errors above.');
    }

    const totalInQdrant = finalStats.count;
    const target = 98000; // From the original target
    const progress = ((totalInQdrant / target) * 100).toFixed(1);
    console.log(`\n🎯 Progress: ${totalInQdrant.toLocaleString()}/${target.toLocaleString()} chunks (${progress}%)`);

  } catch (error) {
    console.error('❌ Error pushing chunks to Qdrant:', error);
    console.log('\n💡 Troubleshooting:');
    console.log('1. Check your QDRANT_URL and QDRANT_API_KEY in .env');
    console.log('2. Ensure Qdrant Cloud is accessible');
    console.log('3. Check network connectivity');
    console.log('4. If the process is too slow, consider running in smaller batches');
    process.exit(1);
  }
}

// Run the script
pushRemainingChunksToQdrant().catch(console.error);
