import { db } from './server/db.js';
import { users, customers } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function checkUsers() {
  try {
    console.log('Users in database:');
    const allUsers = await db.select().from(users);
    for (const user of allUsers) {
      const customer = await db.select().from(customers).where(eq(customers.userId, user.id));
      console.log('- ID:', user.id, 'Phone:', user.phoneNumber, 'Email:', user.email, 'Has Customer:', customer.length > 0);
    }
  } catch (error) {
    console.error('Database error:', error);
  }
  process.exit(0);
}

checkUsers();