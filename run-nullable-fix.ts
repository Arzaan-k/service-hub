import { db } from './server/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';

async function runNullableFix() {
  console.log('🔧 Fixing service_history table to allow NULL dates...\n');

  try {
    // Read SQL file
    const migrationSQL = fs.readFileSync('./fix-service-history-nullable.sql', 'utf-8');

    // Execute the migration
    await db.execute(sql.raw(migrationSQL));

    console.log('✅ Migration completed successfully!');
    console.log('✅ complaint_attended_date now allows NULL values');
    console.log('✅ Indexes updated for better performance\n');

    // Verify the change
    const check = await db.execute(sql`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_name = 'service_history'
      AND column_name = 'complaint_attended_date'
    `);

    console.log('📋 Verification:');
    console.log(`   Column: ${check.rows[0].column_name}`);
    console.log(`   Type: ${check.rows[0].data_type}`);
    console.log(`   Nullable: ${check.rows[0].is_nullable}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

runNullableFix()
  .then(() => {
    console.log('\n✅ Ready to import all service records!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
