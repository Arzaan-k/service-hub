// Quick migration script to add password_reminder_sent_at column
import { db } from './db.js';

async function migrate() {
    try {
        console.log('Adding password_reminder_sent_at column to users table...');

        await db.execute(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS password_reminder_sent_at TIMESTAMP;
    `);

        console.log('✅ Column added successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
