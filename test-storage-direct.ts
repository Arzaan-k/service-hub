import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function testStorage() {
  console.log('🔍 Testing storage.getAllContainers() behavior...\n');

  try {
    // Simulate what storage.getAllContainers() does
    const result: any = await db.execute(sql`SELECT * FROM containers ORDER BY id LIMIT 3`);
    const rows: any[] = Array.isArray(result) ? result : (result?.rows || []);

    console.log('📦 Sample containers from SELECT *:');

    if (rows.length > 0) {
      const sample = rows[0];
      console.log('\nFirst container columns:');
      console.log('- id:', sample.id);
      console.log('- container_id:', sample.container_id);
      console.log('- product_type:', sample.product_type);
      console.log('- size:', sample.size);
      console.log('- depot:', sample.depot);
      console.log('- grade:', sample.grade);
      console.log('- reefer_unit:', sample.reefer_unit);
      console.log('- inventory_status:', sample.inventory_status);
      console.log('- available_location:', sample.available_location);

      console.log('\n✅ All column names returned:');
      console.log(Object.keys(sample).slice(0, 30));
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

testStorage();
