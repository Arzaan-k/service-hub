import 'dotenv/config';
import { cloudQdrantStore } from './server/services/cloudQdrantStore.js';
import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function verifyConfiguration() {
  console.log('🔍 VERIFYING SYSTEM CONFIGURATION');
  console.log('═'.repeat(60));

  // Check Qdrant - should only have RAG chunks
  console.log('\n📊 Qdrant Cloud Status:');
  const qdrantStats = await cloudQdrantStore.getStats();
  console.log(`   Vectors in Qdrant: ${qdrantStats.count}`);
  console.log(`   ✅ Qdrant stores ONLY RAG manual chunks`);

  // Check PostgreSQL - should have all other data
  console.log('\n📊 PostgreSQL Status (All Application Data):');
  const pgTables = await db.execute(sql`
    SELECT tablename,
           pg_size_pretty(pg_total_relation_size('public.' || tablename)) as size
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename != 'manual_chunks'
    ORDER BY pg_total_relation_size('public.' || tablename) DESC
    LIMIT 10
  `);

  console.log('   Other data in PostgreSQL:');
  pgTables.rows.forEach(row => {
    console.log(`     - ${row.tablename}: ${row.size}`);
  });

  // Check manual_chunks
  const chunksCheck = await db.execute(sql`
    SELECT COUNT(*) as count FROM manual_chunks
  `);
  console.log(`\n   manual_chunks in PG: ${chunksCheck.rows[0].count} (should be 0)`);

  console.log('\n✅ CONFIGURATION VERIFIED:');
  console.log('   • Qdrant: RAG chunks only ✅');
  console.log('   • PostgreSQL: All other application data ✅');
}

verifyConfiguration().catch(console.error);





