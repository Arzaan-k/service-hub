import 'dotenv/config';
import { db } from './server/db.ts';
import { sql } from 'drizzle-orm';

async function checkAndFixDatabase() {
  try {
    console.log('🔍 Checking database schema...');

    // Check if vector extension exists
    const extResult = await db.execute(sql`SELECT * FROM pg_extension WHERE extname = 'vector'`);
    if (extResult.rows.length === 0) {
      console.log('📦 Installing pgvector extension...');
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
      console.log('✅ pgvector extension installed');
    } else {
      console.log('✅ pgvector extension already exists');
    }

    // Check if embedding column exists
    const columnResult = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'manual_chunks' AND column_name = 'embedding'`);
    if (columnResult.rows.length === 0) {
      console.log('🛠️ Adding embedding column...');
      await db.execute(sql`ALTER TABLE manual_chunks ADD COLUMN IF NOT EXISTS embedding vector(384)`);
      console.log('✅ Embedding column added');

      // Create index
      await db.execute(sql`CREATE INDEX IF NOT EXISTS manual_chunks_embedding_idx ON manual_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`);
      console.log('✅ Vector index created');
    } else {
      console.log('✅ Embedding column already exists');
    }

    // Check if there are any chunks with embeddings
    const countResult = await db.execute(sql`SELECT COUNT(*) as total, COUNT(embedding) as with_embeddings FROM manual_chunks`);
    console.log(`📊 Database status: ${countResult.rows[0].total} total chunks, ${countResult.rows[0].with_embeddings} with embeddings`);

    console.log('🎉 Database schema is ready!');

  } catch (error) {
    console.error('❌ Database check failed:', error);
  }
}

checkAndFixDatabase();




