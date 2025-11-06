import 'dotenv/config';
import { fileVectorStore } from './server/services/fileVectorStore.js';
import { cloudQdrantStore } from './server/services/cloudQdrantStore.js';

async function pushAllLocalChunksToQdrant() {
  console.log('🚀 PUSHING ALL LOCAL CHUNKS TO QDRANT');
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
    const chunks = fileVectorStore.getAllChunks();

    if (!chunks || chunks.length === 0) {
      console.log('❌ No local chunks found!');
      return;
    }

    console.log(`📤 Preparing to push ${chunks.length.toLocaleString()} chunks to Qdrant...`);

    // Convert local chunks to the format expected by cloudQdrantStore
    const qdrantChunks = chunks.map(chunk => ({
      text: chunk.text,
      metadata: chunk.metadata,
      id: chunk.id
    }));

    console.log('📤 Starting batch upload to Qdrant...');
    console.log('⏳ This may take several minutes depending on chunk count...');

    // Push chunks to Qdrant
    await cloudQdrantStore.addChunks(qdrantChunks);

    // Get final stats
    console.log('\n📊 FINAL VERIFICATION:');
    const finalStats = await cloudQdrantStore.getStats();
    console.log(`✅ Final Qdrant vectors: ${finalStats.count.toLocaleString()}`);

    const addedChunks = finalStats.count - qdrantStats.count;
    console.log(`🎉 Successfully added ${addedChunks.toLocaleString()} chunks to Qdrant!`);

    if (addedChunks > 0) {
      console.log('\n🏆 SUCCESS! All local chunks have been pushed to Qdrant Cloud.');
      console.log('💡 Your RAG system now has access to all manual chunks.');
    } else {
      console.log('\n⚠️  No new chunks were added. They may already exist in Qdrant.');
    }

  } catch (error) {
    console.error('❌ Error pushing chunks to Qdrant:', error);
    console.log('\n💡 Troubleshooting:');
    console.log('1. Check your QDRANT_URL and QDRANT_API_KEY in .env');
    console.log('2. Ensure Qdrant Cloud is accessible');
    console.log('3. Check network connectivity');
    process.exit(1);
  }
}

// Run the script
pushAllLocalChunksToQdrant().catch(console.error);
