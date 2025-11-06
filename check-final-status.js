import { cloudQdrantStore } from './server/services/cloudQdrantStore.js';
import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function checkMigrationStatus() {
  console.log('🔍 FINAL MIGRATION STATUS CHECK');
  console.log('═'.repeat(50));

  // Check Qdrant status
  console.log('📊 Qdrant Cloud Status:');
  const qdrantStats = await cloudQdrantStore.getStats();
  console.log(`   Vectors in Qdrant: ${qdrantStats.count}`);
  console.log(`   Collections: ${qdrantStats.manuals.length}`);

  // Check PostgreSQL status
  console.log('\n📊 PostgreSQL Status:');
  const pgStats = await db.execute(sql`
    SELECT
      COUNT(*) as total_chunks,
      COUNT(embedding) as chunks_with_embeddings,
      pg_size_pretty(pg_total_relation_size('manual_chunks')) as table_size
    FROM manual_chunks
  `);
  console.log(`   Total chunks in PG: ${pgStats.rows[0].total_chunks}`);
  console.log(`   Chunks with embeddings in PG: ${pgStats.rows[0].chunks_with_embeddings}`);
  console.log(`   Table size: ${pgStats.rows[0].table_size}`);

  // Summary
  console.log('\n✅ MIGRATION SUMMARY:');
  if (pgStats.rows[0].chunks_with_embeddings === 0 && qdrantStats.count > 0) {
    console.log('   ✅ SUCCESS: All vectors moved to Qdrant!');
    console.log('   ✅ PostgreSQL embeddings cleared!');
    console.log('   ✅ Neon storage freed!');
  } else if (qdrantStats.count > 0 && pgStats.rows[0].chunks_with_embeddings > 0) {
    console.log('   ⚠️ PARTIAL: Vectors in both systems (backup mode)');
    console.log('   💡 Can run cleanup to remove PG embeddings');
  } else {
    console.log('   ❌ INCOMPLETE: Migration may have failed');
  }

  console.log(`\n🚀 SYSTEM STATUS: ${qdrantStats.count > 0 ? 'OPERATIONAL WITH QDRANT' : 'NEEDS ATTENTION'}`);
}

checkMigrationStatus();




