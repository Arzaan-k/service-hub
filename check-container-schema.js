import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function check() {
  const cols = await db.execute(sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'containers' 
    ORDER BY ordinal_position
  `);
  console.log('Container columns:');
  cols.rows.forEach(c => console.log('  -', c.column_name, '(', c.data_type, ')'));
  process.exit(0);
}

check();

