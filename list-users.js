import 'dotenv/config';
import pg from 'pg';

// Create a PostgreSQL pool
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function listUsers() {
  let client;
  try {
    // Get a client from the pool
    client = await pool.connect();
    console.log('Database connection successful');
    
    // Check users table - show some real users
    const userResult = await client.query('SELECT id, email, name, email_verified, role FROM users ORDER BY created_at DESC LIMIT 10');
    console.log('Recent users in database:');
    console.log('========================');
    
    if (userResult.rows.length > 0) {
      userResult.rows.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email} - ${user.name} - Role: ${user.role} - Verified: ${user.email_verified ? 'Yes' : 'No'}`);
      });
    } else {
      console.log('No users found in database');
    }
    
    // Also check if there are any admins
    const adminResult = await client.query('SELECT id, email, name, email_verified FROM users WHERE role = $1 LIMIT 5', ['admin']);
    console.log('\nAdmin users:');
    console.log('============');
    
    if (adminResult.rows.length > 0) {
      adminResult.rows.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email} - ${user.name} - Verified: ${user.email_verified ? 'Yes' : 'No'}`);
      });
    } else {
      console.log('No admin users found');
    }
    
  } catch (error) {
    console.error('Database connection error:', error.message);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

listUsers();