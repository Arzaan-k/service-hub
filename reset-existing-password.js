import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';

// Create a PostgreSQL pool
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function resetPassword() {
  let client;
  try {
    // Get a client from the pool
    client = await pool.connect();
    console.log('Database connection successful');
    
    // Reset password for arzaanalikhan12@gmail.com (verified admin)
    const email = 'arzaanalikhan12@gmail.com';
    
    // Hash a new password
    const salt = await bcrypt.genSalt(10);
    const newPassword = await bcrypt.hash('Container123!', salt);
    
    const result = await client.query(
      'UPDATE users SET password = $1, email_verified = true WHERE email = $2 RETURNING id, email, name',
      [newPassword, email]
    );
    
    if (result.rowCount > 0) {
      console.log(`✅ Updated password for: ${result.rows[0].email} (${result.rows[0].name})`);
      console.log(`   New password: Container123!`);
      console.log(`   This user is verified and has admin role`);
    } else {
      console.log(`⚠️  User not found: ${email}`);
    }
    
    console.log('\n🔧 Login credentials:');
    console.log('=====================');
    console.log(`📧 Email: ${email}`);
    console.log(`🔒 Password: Container123!`);
    console.log('(This is an existing user in your database)');
    
  } catch (error) {
    console.error('Error resetting password:', error.message);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

resetPassword();