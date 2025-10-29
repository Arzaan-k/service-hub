import { db } from './dist/services/db.js';
import { users } from './shared/schema.js';

async function checkUsers() {
  try {
    console.log('Checking existing users...');
    
    const allUsers = await db.select().from(users);
    console.log('Total users found:', allUsers.length);
    
    if (allUsers.length > 0) {
      console.log('Existing users:');
      allUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email} - ${user.name} - Verified: ${user.emailVerified ? 'Yes' : 'No'}`);
      });
    } else {
      console.log('No users found in database');
    }
    
  } catch (error) {
    console.error('Error checking users:', error.message);
  }
}

checkUsers();