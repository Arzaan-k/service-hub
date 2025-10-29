import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function checkSchema() {
  console.log('🔍 Checking database schema...');
  
  try {
    // Check if manuals table exists
    const manualsTableExists = await db.execute(
      sql`SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'manuals'
      );`
    );
    
    console.log('Manuals table exists:', manualsTableExists.rows[0].exists);
    
    // Check if manual_chunks table exists
    const chunksTableExists = await db.execute(
      sql`SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'manual_chunks'
      );`
    );
    
    console.log('Manual chunks table exists:', chunksTableExists.rows[0].exists);
    
    // Check if rag_queries table exists
    const queriesTableExists = await db.execute(
      sql`SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'rag_queries'
      );`
    );
    
    console.log('RAG queries table exists:', queriesTableExists.rows[0].exists);
    
    // List all tables
    const tables = await db.execute(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`
    );
    
    console.log('All tables:');
    tables.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });
  } catch (error) {
    console.error('❌ Error checking schema:', error);
  }
}

checkSchema();