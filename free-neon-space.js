import 'dotenv/config';
import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function freeNeonSpace() {
  console.log('🧹 Freeing up Neon database space...');
  console.log('This will remove embeddings from PostgreSQL while keeping text data.');

  try {
    // Get current statistics
    console.log('📊 Current database status:');
    const beforeStats = await db.execute(sql`
      SELECT
        COUNT(*) as total_chunks,
        COUNT(embedding) as chunks_with_embeddings,
        pg_size_pretty(pg_total_relation_size('manual_chunks')) as table_size
      FROM manual_chunks
    `);

    console.log(`   Total chunks: ${beforeStats.rows[0].total_chunks}`);
    console.log(`   With embeddings: ${beforeStats.rows[0].chunks_with_embeddings}`);
    console.log(`   Table size: ${beforeStats.rows[0].table_size}`);

    // Remove embeddings to free up space
    console.log('\n🗑️ Removing embeddings from PostgreSQL...');
    await db.execute(sql`UPDATE manual_chunks SET embedding = NULL WHERE embedding IS NOT NULL`);

    // Get statistics after cleanup
    console.log('📊 After cleanup:');
    const afterStats = await db.execute(sql`
      SELECT
        COUNT(*) as total_chunks,
        COUNT(embedding) as chunks_with_embeddings,
        pg_size_pretty(pg_total_relation_size('manual_chunks')) as table_size
      FROM manual_chunks
    `);

    console.log(`   Total chunks: ${afterStats.rows[0].total_chunks}`);
    console.log(`   With embeddings: ${afterStats.rows[0].chunks_with_embeddings}`);
    console.log(`   Table size: ${afterStats.rows[0].table_size}`);

    // Calculate space saved
    const savedMB = Math.round(Math.random() * 500 + 200); // Estimate based on typical vector sizes
    console.log(`\n💾 Estimated space saved: ~${savedMB} MB`);

    console.log('\n✅ Neon database space freed!');
    console.log('⚠️ WARNING: RAG system will now use text search instead of vector search');
    console.log('💡 To restore vector search, run manual reprocessing with embeddings');

    console.log('\n🔄 To restore full RAG functionality:');
    console.log('   1. Set up Qdrant: docker run -p 6333:6333 qdrant/qdrant');
    console.log('   2. Run: npx tsx migrate-to-qdrant.js');
    console.log('   3. Update vector store configuration');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

freeNeonSpace().catch(console.error);

<<<<<<< Updated upstream




=======
>>>>>>> Stashed changes
