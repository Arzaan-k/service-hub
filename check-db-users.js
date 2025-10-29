// Simple script to check database users
import { db } from './dist/services/db.js';

async function checkUsers() {
  try {
    console.log('Connecting to database...');
    
    // Direct query to check users table
    const result = await db.execute('SELECT id, email, name, email_verified FROM users LIMIT 10');
    console.log('Users found:', result.rows.length);
    
    if (result.rows.length > 0) {
      console.log('Sample users:');
      result.rows.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email} - ${user.name} - Verified: ${user.email_verified ? 'Yes' : 'No'}`);
      });
    } else {
      console.log('No users found in database');
    }
    
  } catch (error) {
    console.error('Error checking users:', error.message);
    console.error('Full error:', error);
  }
}

checkUsers();