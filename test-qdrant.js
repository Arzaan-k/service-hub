import { cloudQdrantStore } from './server/services/cloudQdrantStore.js';

async function testQdrant() {
  try {
    console.log('Testing Cloud Qdrant connection...');
    await cloudQdrantStore.initializeCollection();
    console.log('✅ Cloud Qdrant is working!');

    const stats = await cloudQdrantStore.getStats();
    console.log('📊 Stats:', stats);
  } catch (error) {
    console.log('❌ Cloud Qdrant test failed:', error.message);
  }
}

testQdrant();





