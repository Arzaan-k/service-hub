import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function run() {
  console.log('Starting password reset flag migration...');

  try {
    await db.execute(sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS requires_password_reset boolean NOT NULL DEFAULT false;
    `);
    console.log('✔ users.requires_password_reset column added');
  } catch (err) {
    console.error('✖ Failed to add requires_password_reset column:', err);
    throw err;
  }

  console.log('Password reset flag migration completed successfully!');
}

run().catch(console.error);


