
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config();

async function inspectInventoryDb() {
  const dbUrl = process.env.INVENTORY_SOURCE_DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ INVENTORY_SOURCE_DATABASE_URL is not defined in .env');
    process.exit(1);
  }

  console.log('🔌 Connecting to Inventory Database...');
  const sql = neon(dbUrl);

  try {
    // List tables
    console.log('📋 Listing tables in public schema:');
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    console.table(tables);

    // Check for orders table candidates
    const orderTables = tables.filter(t => t.table_name.includes('order') || t.table_name.includes('indent'));
    
    if (orderTables.length > 0) {
      console.log('\n🔍 Inspecting potential order tables:');
      for (const t of orderTables) {
        console.log(`\nTable: ${t.table_name}`);
        const columns = await sql`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = ${t.table_name}
        `;
        console.table(columns);
      }
    } else {
      console.log('\n⚠️ No obvious "order" or "indent" tables found.');
    }

  } catch (error) {
    console.error('❌ Error inspecting database:', error);
  }
}

inspectInventoryDb();
