import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function findUserByEmailOrPhone() {
  let client;
  try {
    client = await pool.connect();

    console.log('🔍 Searching for users with:');
    console.log('Email: arzaanalikhan12@gmail.com');
    console.log('Phone: 7021307474\n');

    // Find by email
    const emailResult = await client.query('SELECT id, email, name, phone_number, role FROM users WHERE email = $1', ['arzaanalikhan12@gmail.com']);
    console.log('Users with email arzaanalikhan12@gmail.com:');
    if (emailResult.rows.length > 0) {
      emailResult.rows.forEach(user => {
        console.log(`  - ${user.email} (${user.name}) - Role: ${user.role} - Phone: ${user.phone_number} - ID: ${user.id}`);
      });
    } else {
      console.log('  None found');
    }

    // Find by phone
    const phoneResult = await client.query('SELECT id, email, name, phone_number, role FROM users WHERE phone_number = $1', ['7021307474']);
    console.log('\nUsers with phone 7021307474:');
    if (phoneResult.rows.length > 0) {
      phoneResult.rows.forEach(user => {
        console.log(`  - ${user.email} (${user.name}) - Role: ${user.role} - Phone: ${user.phone_number} - ID: ${user.id}`);
      });
    } else {
      console.log('  None found');
    }

    // Check for partial matches
    const partialPhoneResult = await client.query("SELECT id, email, name, phone_number, role FROM users WHERE phone_number LIKE '%7021307474%'");
    console.log('\nUsers with phone containing 7021307474:');
    if (partialPhoneResult.rows.length > 0) {
      partialPhoneResult.rows.forEach(user => {
        console.log(`  - ${user.email} (${user.name}) - Role: ${user.role} - Phone: ${user.phone_number} - ID: ${user.id}`);
      });
    } else {
      console.log('  None found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

findUserByEmailOrPhone();
