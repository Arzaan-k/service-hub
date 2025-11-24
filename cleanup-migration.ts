import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function cleanup() {
  console.log('🧹 Cleaning up partial migration...');

  await db.execute(sql`DROP TABLE IF EXISTS service_history CASCADE`);
  console.log('   ✓ Dropped service_history');

  await db.execute(sql`DROP TABLE IF EXISTS indents CASCADE`);
  console.log('   ✓ Dropped indents');

  await db.execute(sql`DROP TABLE IF EXISTS manufacturer_standards CASCADE`);
  console.log('   ✓ Dropped manufacturer_standards');

  await db.execute(sql`DROP TABLE IF EXISTS container_size_standards CASCADE`);
  console.log('   ✓ Dropped container_size_standards');

  await db.execute(sql`DROP TABLE IF EXISTS location_standards CASCADE`);
  console.log('   ✓ Dropped location_standards');

  await db.execute(sql`DROP TABLE IF EXISTS service_statistics CASCADE`);
  console.log('   ✓ Dropped service_statistics');

  await db.execute(sql`DROP TABLE IF EXISTS inspection_checklist_template CASCADE`);
  console.log('   ✓ Dropped inspection_checklist_template');

  console.log('\n✅ Cleanup complete\n');
}

cleanup()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  });
