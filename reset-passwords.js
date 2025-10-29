import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';

// Create a PostgreSQL pool
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function resetPasswords() {
  let client;
  try {
    // Get a client from the pool
    client = await pool.connect();
    console.log('Database connection successful');
    
    // Hash a new password
    const salt = await bcrypt.genSalt(10);
    const newPassword = await bcrypt.hash('Password123!', salt);
    
    // Reset passwords for key users and mark them as email verified
    const emailsToUpdate = [
      'brocklesnar12124@gmail.com',
      'arzaan@example.com',
      'admin@containergenie.com'
    ];
    
    for (const email of emailsToUpdate) {
      const result = await client.query(
        'UPDATE users SET password = $1, email_verified = true WHERE email = $2 RETURNING id, email, name',
        [newPassword, email]
      );
      
      if (result.rowCount > 0) {
        console.log(`✅ Updated password for: ${result.rows[0].email} (${result.rows[0].name})`);
        console.log(`   New password: Password123!`);
      } else {
        console.log(`⚠️  User not found: ${email}`);
      }
    }
    
    console.log('\n🔧 Login credentials:');
    console.log('=====================');
    emailsToUpdate.forEach(email => {
      console.log(`📧 Email: ${email}`);
      console.log(`🔒 Password: Password123!`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error resetting passwords:', error.message);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

resetPasswords();