import { db } from './server/db.js';
import { users } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function verifyEmail() {
  try {
    await db.update(users).set({ emailVerified: true }).where(eq(users.email, 'admin@test.com'));
    console.log('Email verified for admin@test.com');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verifyEmail();




