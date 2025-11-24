/**
 * SERVICE HISTORY DATABASE MIGRATION
 *
 * Creates all service history tables and views
 */

import { readFileSync } from 'fs';
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function migrateServiceHistory() {
  try {
    console.log('🚀 Starting Service History Database Migration...');

    // Read the SQL migration file
    const sqlContent = readFileSync('../../add-service-history-schema.sql', 'utf8');
    console.log('📄 SQL migration file loaded');

    // Split into individual statements (simple approach)
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📊 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
        try {
          await db.execute(sql.raw(statement));
          console.log(`✅ Statement ${i + 1} executed successfully`);
        } catch (error: any) {
          console.error(`❌ Error executing statement ${i + 1}:`, error.message);
          // Continue with other statements for non-critical errors
          if (error.message.includes('already exists')) {
            console.log(`ℹ️  Table/view already exists, continuing...`);
          } else {
            throw error;
          }
        }
      }
    }

    console.log('🎉 Service History Database Migration Completed!');
    console.log('📈 Next step: Run the import script with: npm run import:service-master');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateServiceHistory();
