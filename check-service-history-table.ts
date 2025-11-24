import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function checkTable() {
  try {
    const result = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'service_history'
    `);

    console.log('Table exists:', result.rows.length > 0);

    if (result.rows.length > 0) {
      // Get column information
      const columns = await db.execute(sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'service_history'
        ORDER BY ordinal_position
      `);
      console.log('\nColumns:', columns.rows.length);
      columns.rows.slice(0, 20).forEach((col: any) => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log('\n❌ service_history table does not exist');
      console.log('Run: npx tsx run-service-history-migration.ts');
    }
  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

checkTable();
