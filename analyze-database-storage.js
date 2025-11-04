import 'dotenv/config';
import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function analyzeDatabaseStorage() {
  console.log('📊 POSTGRESQL DATABASE STORAGE ANALYSIS');
  console.log('═'.repeat(70));
  console.log();

  try {
    // Get all table sizes
    console.log('📋 TABLE SIZES (Largest to Smallest):');
    console.log('─'.repeat(70));
    const tableSizes = await db.execute(sql`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size,
        pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `);

    let totalSize = 0;
    tableSizes.rows.forEach((row, index) => {
      totalSize += parseInt(row.size_bytes) || 0;
      console.log(`${(index + 1).toString().padStart(2, ' ')}. ${row.tablename.padEnd(35, ' ')} │ ${row.size.padEnd(12, ' ')} │ Table: ${row.table_size.padEnd(10, ' ')} │ Indexes: ${row.indexes_size}`);
    });

    console.log('─'.repeat(70));
    console.log(`   TOTAL DATABASE SIZE: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log();

    // Get row counts for each table
    console.log('📊 TABLE ROW COUNTS:');
    console.log('─'.repeat(70));
    const rowCounts = await db.execute(sql`
      SELECT 
        tablename,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.tablename) AS column_count
      FROM pg_tables t
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY tablename
    `);

    for (const row of rowCounts.rows) {
      try {
        const countResult = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${row.tablename}`));
        const count = countResult.rows[0]?.count || 0;
        console.log(`   ${row.tablename.padEnd(35, ' ')} │ ${count.toString().padStart(10, ' ')} rows │ ${row.column_count} columns`);
      } catch (error) {
        console.log(`   ${row.tablename.padEnd(35, ' ')} │ (unable to count)`);
      }
    }
    console.log();

    // Get largest tables detail
    console.log('🔍 DETAILED ANALYSIS OF TOP 10 TABLES:');
    console.log('─'.repeat(70));

    const topTables = tableSizes.rows.slice(0, 10);
    for (const table of topTables) {
      const tableName = table.tablename;
      const sizeMB = (parseInt(table.size_bytes) || 0) / 1024 / 1024;

      console.log(`\n📄 Table: ${tableName}`);
      console.log(`   Total Size: ${table.size}`);
      console.log(`   Table Data: ${table.table_size}`);
      console.log(`   Indexes: ${table.indexes_size}`);
      console.log(`   Size in MB: ${sizeMB.toFixed(2)} MB`);

      // Get column sizes if it's a large table
      if (sizeMB > 1) {
        try {
          const columnSizes = await db.execute(sql.raw(`
            SELECT 
              column_name,
              data_type,
              character_maximum_length,
              pg_size_pretty(SUM(pg_column_size(quote_ident(column_name)))) as estimated_size
            FROM information_schema.columns
            WHERE table_name = '${tableName}'
            GROUP BY column_name, data_type, character_maximum_length
            ORDER BY pg_size_pretty(SUM(pg_column_size(quote_ident(column_name)))) DESC
            LIMIT 5
          `));

          if (columnSizes.rows.length > 0) {
            console.log(`   Top columns by size:`);
            columnSizes.rows.forEach(col => {
              console.log(`     - ${col.column_name} (${col.data_type}): ${col.estimated_size || 'N/A'}`);
            });
          }
        } catch (error) {
          // Skip if query fails
        }

        // Get row count
        try {
          const countResult = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${tableName}`));
          const count = countResult.rows[0]?.count || 0;
          console.log(`   Total Rows: ${count.toLocaleString()}`);
          if (count > 0) {
            const avgRowSize = (sizeMB * 1024 * 1024) / count;
            console.log(`   Avg Row Size: ${avgRowSize.toFixed(0)} bytes`);
          }
        } catch (error) {
          // Skip if query fails
        }
      }
    }

    console.log();
    console.log('═'.repeat(70));
    console.log('💡 SUMMARY:');
    console.log(`   Largest table: ${tableSizes.rows[0]?.tablename || 'N/A'} (${tableSizes.rows[0]?.size || 'N/A'})`);
    console.log(`   Total database size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Total tables analyzed: ${tableSizes.rows.length}`);

  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
}

analyzeDatabaseStorage().catch(console.error);





