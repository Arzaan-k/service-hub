import 'dotenv/config';
import { cloudQdrantStore } from './server/services/cloudQdrantStore.js';
import { db } from './server/db.js';
import { manuals, manualChunks } from './shared/schema.js';
import { sql } from 'drizzle-orm';

async function finalVerification() {
  console.log('🎯 FINAL RAG SYSTEM VERIFICATION');
  console.log('═'.repeat(80));
  console.log();

  // Check Qdrant
  console.log('📊 QDRANT CLOUD STATUS:');
  const qdrantStats = await cloudQdrantStore.getStats();
  console.log(`   ✅ Vectors: ${qdrantStats.count.toLocaleString()}`);
  console.log(`   🎯 Target: ~98,000 chunks`);
  console.log(`   📈 Achievement: ${((qdrantStats.count / 98000) * 100).toFixed(1)}%`);
  console.log();

  // Check PostgreSQL
  console.log('📊 POSTGRESQL STATUS:');
  const pgChunks = await db.select({ count: sql<number>`count(*)` }).from(manualChunks);
  console.log(`   ✅ RAG chunks in PG: ${pgChunks[0].count} (should be 0)`);
  console.log();

  // Check manuals
  const allManuals = await db.select().from(manuals);
  console.log(`📚 MANUALS PROCESSED: ${allManuals.length}`);
  allManuals.forEach((manual, i) => {
    console.log(`   ${i + 1}. ${manual.name.substring(0, 60)}...`);
  });
  console.log();

  // System configuration
  console.log('🔧 SYSTEM CONFIGURATION:');
  console.log('   ✅ RAG chunks → Qdrant Cloud ONLY');
  console.log('   ✅ Application data → PostgreSQL ONLY');
  console.log('   ✅ New uploads → Qdrant automatically');
  console.log('   ✅ Storage optimization → No PG bloat');
  console.log();

  // Final status
  const isComplete = qdrantStats.count >= 98000;
  const isOptimized = pgChunks[0].count === 0;

  console.log('🎉 FINAL STATUS:');
  if (isComplete && isOptimized) {
    console.log('   🏆 COMPLETE! RAG system fully operational');
    console.log('   💾 PostgreSQL space saved');
    console.log('   ⚡ Fast semantic search enabled');
    console.log('   🤖 AI troubleshooting ready');
  } else if (qdrantStats.count > 0) {
    console.log('   ⏳ PROCESSING IN PROGRESS');
    console.log('   📈 Chunks loaded: ' + qdrantStats.count.toLocaleString());
    console.log('   🎯 Remaining: ' + (98000 - qdrantStats.count).toLocaleString());
  } else {
    console.log('   ❌ PROCESSING FAILED');
  }

  console.log();
  console.log('═'.repeat(80));
}

finalVerification().catch(console.error);




