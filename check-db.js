import { storage } from './server/storage';
import { db } from './server/db';

async function checkUsers() {
  try {
    console.log('Checking database connection...');

    // Check if there are any users in the database
    const users = await db.execute('SELECT id, name, email, role, is_active FROM users LIMIT 10');
    console.log('Users in database:', users.rows);

    // Check if there are any RAG queries
    try {
      const ragQueries = await db.execute('SELECT id, user_id, query, created_at FROM rag_queries ORDER BY created_at DESC LIMIT 5');
      console.log('Recent RAG queries:', ragQueries.rows);
    } catch (error) {
      console.log('No rag_queries table or no queries:', error.message);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkUsers();