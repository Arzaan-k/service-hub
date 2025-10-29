import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkRemainingUser() {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query('SELECT email, name, role FROM users WHERE email = $1', ['test@gmail.com']);
    if (result.rows.length > 0) {
      console.log('Remaining user:', result.rows[0]);
    } else {
      console.log('User not found');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

checkRemainingUser();
