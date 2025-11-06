import { CloudQdrantStore } from './server/services/cloudQdrantStore.js';

async function testQdrant() {
  console.log('🔍 Testing Qdrant connection and content...');
  
  try {
    const store = new CloudQdrantStore();
    await store.initializeCollection();
    
    // Get stats
    const stats = await store.getStats();
    console.log('📊 Qdrant Stats:', stats);
    
    // Get sample chunks and look for readable text
    console.log('📝 Looking for readable chunks...');
    const samples = await store.listSamples(20);
    let readableCount = 0;
    
    samples.forEach((sample, index) => {
      const isReadable = /[a-zA-Z]{3,}/.test(sample.text);
      if (isReadable) {
        readableCount++;
        console.log(`\n✅ Readable Sample ${readableCount}:`);
        console.log(`  ID: ${sample.id}`);
        console.log(`  Manual: ${sample.metadata.manualId}`);
        console.log(`  Page: ${sample.metadata.pageNum}`);
        console.log(`  Text: ${sample.text.substring(0, 300)}...`);
        console.log(`  Score: ${sample.score}`);
      } else {
        console.log(`❌ Sample ${index + 1}: Binary/corrupted data`);
      }
    });
    
    console.log(`\n📈 Found ${readableCount} readable chunks out of ${samples.length} samples`);
    
    // Test search for different terms
    const searchTerms = ['Alarm 17', 'temperature', 'sensor', 'fault', 'error', 'maintenance'];
    
    for (const term of searchTerms) {
      console.log(`\n🔍 Testing search for "${term}":`);
      const searchResults = await store.search(term, 3);
      
      let readableResults = 0;
      searchResults.forEach((result, index) => {
        const isReadable = /[a-zA-Z]{3,}/.test(result.text);
        if (isReadable) {
          readableResults++;
          console.log(`  ✅ Result ${index + 1} (Score: ${result.score}): ${result.text.substring(0, 150)}...`);
        } else {
          console.log(`  ❌ Result ${index + 1}: Binary data (Score: ${result.score})`);
        }
      });
      
      console.log(`  📊 ${readableResults} readable results out of ${searchResults.length}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing Qdrant:', error);
  }
}

testQdrant();
