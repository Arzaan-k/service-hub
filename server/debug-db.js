import { db } from './db.ts';

async function debugDatabase() {
  try {
    console.log('Testing database connection...');
    
    // Test if we can connect to the database
    const result = await db.execute('SELECT 1 as test');
    console.log('Database connection test:', result);
    
    // Check what tables exist
    const tables = await db.execute(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Existing tables:', tables);
    
    // Check containers table structure
    const containerColumns = await db.execute(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'containers'
    `);
    console.log('Containers table columns:', containerColumns);
    
  } catch (error) {
    console.error('Database debug error:', error);
  }
}

debugDatabase();
