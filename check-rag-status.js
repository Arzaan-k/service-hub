import 'dotenv/config';
import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function checkRAGStatus() {
  try {
    console.log('🔍 RAG System Status Check');
    console.log('═'.repeat(50));

    // Check data status
    const countResult = await db.execute(sql`SELECT COUNT(*) as total, COUNT(embedding) as with_embeddings FROM manual_chunks`);
    console.log('📊 Total chunks:', countResult.rows[0].total);
    console.log('🤖 Chunks with embeddings:', countResult.rows[0].with_embeddings);

    // Check manuals
    const manualsResult = await db.execute(sql`SELECT COUNT(*) as count FROM manuals`);
    console.log('📚 Total manuals:', manualsResult.rows[0].count);

    // Check recent queries
    const queryResult = await db.execute(sql`SELECT COUNT(*) as count FROM rag_queries`);
    console.log('💬 Total RAG queries:', queryResult.rows[0].count);

    console.log('═'.repeat(50));

    if (countResult.rows[0].with_embeddings > 0) {
      console.log('🎉 RAG system is operational!');
    } else {
      console.log('⚠️ RAG system needs manual processing');
    }

  } catch (error) {
    console.error('❌ Status check failed:', error.message);
  }
}

checkRAGStatus();



