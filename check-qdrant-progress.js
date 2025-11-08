import 'dotenv/config';
import { cloudQdrantStore } from './server/services/cloudQdrantStore.js';

async function checkProgress() {
  console.log('📊 CHECKING QDRANT PROGRESS');
  console.log('═'.repeat(60));
  
  await cloudQdrantStore.initializeCollection();
  const stats = await cloudQdrantStore.getStats();
  
  console.log(`\n✅ Current vectors in Qdrant: ${stats.count.toLocaleString()}`);
  console.log(`🎯 Target: ~98,000 chunks`);
  console.log(`📈 Progress: ${((stats.count / 98000) * 100).toFixed(1)}%`);
  console.log(`📊 Remaining: ${(98000 - stats.count).toLocaleString()} chunks`);
  
  if (stats.count >= 98000) {
    console.log('\n🎉 ALL CHUNKS PROCESSED!');
  } else {
    console.log('\n⏳ Processing continues...');
  }
}

checkProgress().catch(console.error);



<<<<<<< Updated upstream


=======
>>>>>>> Stashed changes
