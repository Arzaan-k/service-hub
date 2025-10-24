import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function run() {
  console.log('Starting container schema migration...');

  // 1) Ensure current_location field exists in containers table
  try {
    await db.execute(sql`
      ALTER TABLE containers
      ADD COLUMN IF NOT EXISTS current_location jsonb;
    `);
    console.log('✔ containers.current_location field ensured');
  } catch (err) {
    console.error('✖ Failed to ensure containers.current_location:', err);
    throw err;
  }

  // 2) Ensure new telemetry fields exist
  try {
    await db.execute(sql`
      ALTER TABLE containers
      ADD COLUMN IF NOT EXISTS last_update_timestamp timestamp;
    `);
    await db.execute(sql`
      ALTER TABLE containers
      ADD COLUMN IF NOT EXISTS location_lat decimal(10, 8);
    `);
    await db.execute(sql`
      ALTER TABLE containers
      ADD COLUMN IF NOT EXISTS location_lng decimal(11, 8);
    `);
    await db.execute(sql`
      ALTER TABLE containers
      ADD COLUMN IF NOT EXISTS last_telemetry jsonb;
    `);
    await db.execute(sql`
      ALTER TABLE containers
      ADD COLUMN IF NOT EXISTS last_synced_at timestamp;
    `);
    console.log('✔ containers telemetry fields ensured');
  } catch (err) {
    console.error('✖ Failed to ensure containers telemetry fields:', err);
    throw err;
  }

  // 3) Check if we have any containers
  try {
    const result = await db.execute(sql`SELECT COUNT(*) as count FROM containers`);
    const containerCount = result.rows[0]?.count || 0;
    console.log(`📦 Found ${containerCount} containers in database`);

    if (containerCount === 0) {
      console.log('⚠️ No containers found. You may need to run the import script: npm run import:rentals');
    }
  } catch (err) {
    console.error('✖ Failed to check container count:', err);
  }

  console.log('Container schema migration complete.');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
