import 'dotenv/config';
import pg from 'pg';

// Create a PostgreSQL pool
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test the connection
async function testConnection() {
  let client;
  try {
    // Get a client from the pool
    client = await pool.connect();
    console.log('Database connection successful');
    
    // Check users table
    const userResult = await client.query('SELECT id, email, name, email_verified FROM users LIMIT 5');
    console.log('Users found:', userResult.rowCount);
    
    if (userResult.rows.length > 0) {
      console.log('Sample users:');
      userResult.rows.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email} - ${user.name} - Verified: ${user.email_verified ? 'Yes' : 'No'}`);
      });
    } else {
      console.log('No users found in database');
    }
    
    // Check if there are any users at all
    const countResult = await client.query('SELECT COUNT(*) as count FROM users');
    console.log('Total users in database:', countResult.rows[0].count);
    
    // Mark some users as verified for testing
    console.log('\nUpdating some users to be email verified...');
    const updateResult = await client.query(
      "UPDATE users SET email_verified = true WHERE email IN ('brocklesnar12124@gmail.com', 'arzaan@example.com', 'admin@containergenie.com') RETURNING id, email, name"
    );
    
    if (updateResult.rowCount > 0) {
      console.log('Successfully verified users:');
      updateResult.rows.forEach(user => {
        console.log(`- ${user.email} (${user.name})`);
      });
    } else {
      console.log('No users were updated');
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

testConnection();