import 'dotenv/config';
import { fileVectorStore } from './server/services/fileVectorStore.js';

async function checkLocalChunks() {
  console.log('📊 CHECKING LOCAL CHUNKS IN vectors.json');
  console.log('═'.repeat(60));

  const stats = await fileVectorStore.getStats();
  console.log(`✅ Local chunks in vectors.json: ${stats.count.toLocaleString()}`);
  console.log(`📚 Manuals: ${stats.manuals.length}`);
  console.log();

  stats.manuals.forEach((manual, i) => {
    console.log(`  ${i + 1}. ${manual.id} (${manual.chunksCount} chunks)`);
  });
}

checkLocalChunks().catch(console.error);



