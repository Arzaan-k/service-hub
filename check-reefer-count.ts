import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function checkReeferCount() {
  console.log('🔍 Checking reefer container data...\n');

  try {
    // Count reefer containers
    const reeferResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM containers
      WHERE product_type = 'Reefer'
    `);
    console.log(`🧊 Reefer containers: ${reeferResult.rows[0].count}`);

    // Count dry containers
    const dryResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM containers
      WHERE product_type = 'Dry'
    `);
    console.log(`📦 Dry containers: ${dryResult.rows[0].count}`);

    // Sample reefer containers
    const sampleReeferResult = await db.execute(sql`
      SELECT container_id, product_type, size, depot, grade, reefer_unit, inventory_status
      FROM containers
      WHERE product_type = 'Reefer'
      LIMIT 5
    `);
    console.log('\n📊 Sample reefer containers:');
    console.log(JSON.stringify(sampleReeferResult.rows, null, 2));

    // Check distinct product types
    const typesResult = await db.execute(sql`
      SELECT DISTINCT product_type, COUNT(*) as count
      FROM containers
      WHERE product_type IS NOT NULL
      GROUP BY product_type
      ORDER BY count DESC
    `);
    console.log('\n📋 All product types:');
    console.log(JSON.stringify(typesResult.rows, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

checkReeferCount();
