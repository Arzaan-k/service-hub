import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config();

async function addEscalationColumn() {
  const sql = neon(process.env.DATABASE_URL!);
  
  try {
    console.log('📦 Running migration: add_password_escalation_field.sql');
    
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_escalation_sent_at TIMESTAMP`;
    
    console.log('✅ Column "password_escalation_sent_at" added to users table');
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

addEscalationColumn();

