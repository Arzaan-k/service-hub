/**
 * Simple Service History Migration Script
 */

import { readFileSync } from 'fs';
import { createConnection } from '@neondatabase/serverless';

async function runMigration() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const sql = createConnection(DATABASE_URL);

  try {
    console.log('Starting migration...');

    // Read SQL file
    const sqlContent = readFileSync('add-service-history-schema.sql', 'utf8');

    // Split and execute
    const statements = sqlContent.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      console.log(`Executing ${i + 1}/${statements.length}`);
      await sql(statements[i]);
    }

    console.log('Migration complete!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

runMigration();




