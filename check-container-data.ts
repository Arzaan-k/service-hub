import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function checkContainerData() {
  console.log('🔍 Checking container data in database...\n');

  try {
    // Check first 3 containers
    const result = await db.execute(sql`
      SELECT
        id,
        container_id,
        product_type,
        size,
        size_type,
        category,
        depot,
        grade,
        reefer_unit,
        inventory_status
      FROM containers
      LIMIT 3
    `);

    console.log('📊 Sample containers from database:');
    console.log(JSON.stringify(result.rows, null, 2));

    // Check total count
    const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM containers`);
    console.log(`\n📦 Total containers in database: ${countResult.rows[0].count}`);

    // Check how many have product_type filled
    const filledResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM containers
      WHERE product_type IS NOT NULL AND product_type != ''
    `);
    console.log(`✅ Containers with product_type: ${filledResult.rows[0].count}`);

    // Check how many have NULL or empty fields
    const emptyResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM containers
      WHERE product_type IS NULL OR product_type = ''
    `);
    console.log(`❌ Containers with NULL/empty product_type: ${emptyResult.rows[0].count}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

checkContainerData();
