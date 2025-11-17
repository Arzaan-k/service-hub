import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

console.log('Adding received to whatsapp_message_status enum...');

(async () => {
  try {
    await sql`ALTER TYPE whatsapp_message_status ADD VALUE 'received'`;
    console.log('✅ Enum updated successfully!');
  } catch (error) {
    console.error('❌ Failed to update enum:', error);
    // If the value already exists, that's fine
    if (error.message && error.message.includes('already exists')) {
      console.log('ℹ️ Enum value already exists');
    }
  }
})();







