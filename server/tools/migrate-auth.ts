import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function run() {
  console.log('Starting auth DB migration...');

  // 1) Ensure users.email_verified exists
  try {
    await db.execute(sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
    `);
    console.log('✔ users.email_verified ensured');
  } catch (err) {
    console.error('✖ Failed to ensure users.email_verified:', err);
    throw err;
  }

  // 2) Create email_verifications table
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS email_verifications (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code_hash text NOT NULL,
        expires_at timestamp NOT NULL,
        attempts integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);
    console.log('✔ email_verifications table ensured');
  } catch (err) {
    console.error('✖ Failed to ensure email_verifications table:', err);
    throw err;
  }

  // 3) Indexes (idempotent)
  try {
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
      ON users(email)
      WHERE email IS NOT NULL;
    `);
    console.log('✔ users.email unique index ensured');
  } catch (err) {
    console.warn('⚠ Could not ensure users.email unique index:', err);
  }

  try {
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS ix_email_verifications_user_id
      ON email_verifications(user_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS ix_email_verifications_expires_at
      ON email_verifications(expires_at);
    `);
    console.log('✔ email_verifications indexes ensured');
  } catch (err) {
    console.warn('⚠ Could not ensure email_verifications indexes:', err);
  }

  console.log('Auth DB migration complete.');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});




















