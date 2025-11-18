import pkg from 'pg';
const { Client } = pkg;

async function analyzeDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔍 Analyzing Database Schema...\n');

    // Get all tables
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('📋 TABLES FOUND:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    console.log('\n' + '='.repeat(50) + '\n');

    // Analyze each table
    for (const tableRow of tablesResult.rows) {
      const tableName = tableRow.table_name;

      console.log(`🔍 ANALYZING TABLE: ${tableName.toUpperCase()}`);

      // Get columns
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
        FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = 'public'
        ORDER BY ordinal_position
      `, [tableName]);

      console.log(`  COLUMNS (${columnsResult.rows.length}):`);
      columnsResult.rows.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? `DEFAULT ${col.column_default}` : '';
        const maxLen = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
        console.log(`    - ${col.column_name}: ${col.data_type}${maxLen} ${nullable} ${defaultVal}`);
      });

      // Get row count
      try {
        const countResult = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        console.log(`  ROWS: ${countResult.rows[0].count}`);
      } catch (countError) {
        console.log(`  ROWS: Unable to count (${countError.message})`);
      }

      // Get sample data if table has data
      try {
        const sampleResult = await client.query(`SELECT * FROM ${tableName} LIMIT 2`);
        if (sampleResult.rows.length > 0) {
          console.log(`  SAMPLE DATA:`);
          sampleResult.rows.forEach((row, index) => {
            console.log(`    Row ${index + 1}:`, Object.keys(row).reduce((acc, key) => {
              const value = row[key];
              if (value && typeof value === 'object' && value.constructor === Date) {
                acc[key] = value.toISOString();
              } else if (typeof value === 'string' && value.length > 50) {
                acc[key] = value.substring(0, 50) + '...';
              } else {
                acc[key] = value;
              }
              return acc;
            }, {}));
          });
        } else {
          console.log(`  SAMPLE DATA: No data in table`);
        }
      } catch (sampleError) {
        console.log(`  SAMPLE DATA: Unable to fetch (${sampleError.message})`);
      }

      console.log('');
    }

    // Check for specific issues
    console.log('🔧 CHECKING FOR SPECIFIC ISSUES:\n');

    // Check technicians table
    try {
      const techColumns = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'technicians' AND table_schema = 'public'
      `);

      const existingColumns = techColumns.rows.map(r => r.column_name);
      const requiredColumns = ['grade', 'designation', 'hotel_allowance', 'local_travel_allowance', 'food_allowance', 'personal_allowance'];

      console.log('TECHNICIANS TABLE ANALYSIS:');
      console.log('  Existing columns:', existingColumns);
      console.log('  Required columns:', requiredColumns);

      const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
      if (missingColumns.length > 0) {
        console.log('  ❌ MISSING COLUMNS:', missingColumns);
        console.log('\n🔧 FIXING MISSING COLUMNS...');

        // Add missing columns
        for (const column of missingColumns) {
          let sql;
          if (['grade', 'designation'].includes(column)) {
            sql = `ALTER TABLE technicians ADD COLUMN IF NOT EXISTS ${column} TEXT`;
          } else {
            sql = `ALTER TABLE technicians ADD COLUMN IF NOT EXISTS ${column} INTEGER DEFAULT 0`;
          }

          await client.query(sql);
          console.log(`  ✅ Added column: ${column}`);
        }

        console.log('\n✅ All wage columns added successfully!');
      } else {
        console.log('  ✅ All required columns present');
      }
    } catch (error) {
      console.log('  ❌ Error checking technicians table:', error.message);
    }

  } catch (error) {
    console.error('❌ Database analysis failed:', error);
  } finally {
    await client.end();
  }
}

analyzeDatabase();
