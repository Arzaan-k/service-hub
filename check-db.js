import { Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

async function checkDatabase() {
  try {
    console.log('Checking database connection...');

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();

    console.log('Connected to database');

    // Check if containers table exists
    const tableResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'containers'
    `);

    if (tableResult.rows.length === 0) {
      console.log('❌ containers table does not exist');
      return;
    }

    console.log('✅ containers table exists');

    // Check container count
    const countResult = await client.query('SELECT COUNT(*) as count FROM containers');
    console.log(`📊 Container count: ${countResult.rows[0].count}`);

    if (parseInt(countResult.rows[0].count) > 0) {
      // Get sample containers
      const sampleResult = await client.query('SELECT id, "containerCode", type, status FROM containers LIMIT 3');
      console.log('📋 Sample containers:', sampleResult.rows);
    }

    await client.release();
    console.log('✅ Database check completed');

  } catch (error) {
    console.error('❌ Database error:', error.message);
  }
}

checkDatabase();
