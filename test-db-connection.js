import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';
import ws from 'ws';

// Create a pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Test the connection
async function testConnection() {
    try {
        console.log('Testing database connection...');
        const client = await pool.connect();
        console.log('Connected to database successfully');
        
        // Test a simple query
        const result = await client.query('SELECT 1 as test');
        console.log('Simple query result:', result.rows);
        
        client.release();
        await pool.end();
        console.log('Database connection test completed successfully');
    } catch (error) {
        console.error('Database connection error:', error);
        process.exit(1);
    }
}

testConnection();