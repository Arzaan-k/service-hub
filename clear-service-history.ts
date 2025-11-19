import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function clearServiceHistory() {
  console.log('🗑️  Clearing existing service history data...\n');

  try {
    // Delete in order (indents first due to foreign keys)
    await db.execute(sql`DELETE FROM indents`);
    console.log('✅ Cleared indents table');

    await db.execute(sql`DELETE FROM service_statistics`);
    console.log('✅ Cleared service_statistics table');

    await db.execute(sql`DELETE FROM service_history`);
    console.log('✅ Cleared service_history table');

    // Verify
    const count = await db.execute(sql`SELECT COUNT(*) as count FROM service_history`);
    console.log(`\n📊 Verification: ${count.rows[0].count} records remaining (should be 0)`);

    console.log('\n✅ All service history data cleared. Ready for fresh import!');

  } catch (error) {
    console.error('❌ Error clearing data:', error);
    throw error;
  }
}

clearServiceHistory()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
