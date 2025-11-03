import 'dotenv/config';
import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function detailedStorageAnalysis() {
  console.log('📊 DETAILED POSTGRESQL STORAGE BREAKDOWN');
  console.log('═'.repeat(70));
  console.log();

  try {
    // Database size
    console.log('💾 DATABASE OVERALL SIZE:');
    console.log('─'.repeat(70));
    const dbSize = await db.execute(sql`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as total_size,
        pg_database_size(current_database()) as size_bytes
    `);
    console.log(`   Total Database Size: ${dbSize.rows[0].total_size}`);
    console.log(`   Size in Bytes: ${(dbSize.rows[0].size_bytes / 1024 / 1024).toFixed(2)} MB`);
    console.log();

    // Table sizes with detailed breakdown
    console.log('📋 ALL TABLES WITH DETAILED BREAKDOWN:');
    console.log('─'.repeat(70));
    const allTables = await db.execute(sql`
      SELECT 
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
        pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS indexes_size,
        pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.tablename) AS column_count
      FROM pg_tables t
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `);

    let totalTablesSize = 0;
    allTables.rows.forEach((row, index) => {
      totalTablesSize += parseInt(row.size_bytes) || 0;
      const sizeMB = (parseInt(row.size_bytes) || 0) / 1024 / 1024;
      const tableMB = (parseInt(row.table_size?.replace(/[^0-9]/g, '') || 0) / 1024) || 0;
      const indexMB = (parseInt(row.indexes_size?.replace(/[^0-9]/g, '') || 0) / 1024) || 0;

      if (sizeMB > 0.01) {
        console.log(`${(index + 1).toString().padStart(2, ' ')}. ${row.tablename.padEnd(30, ' ')} │ ${row.total_size.padEnd(12, ' ')} │ Data: ${tableMB.toFixed(2)} MB │ Indexes: ${indexMB.toFixed(2)} MB │ ${row.column_count} cols`);
      }
    });

    console.log('─'.repeat(70));
    console.log(`   Total Tables Size: ${(totalTablesSize / 1024 / 1024).toFixed(2)} MB`);
    console.log();

    // Check for large data types
    console.log('🔍 CHECKING FOR LARGE TEXT/JSON COLUMNS:');
    console.log('─'.repeat(70));
    const largeColumns = await db.execute(sql`
      SELECT 
        table_name,
        column_name,
        data_type,
        character_maximum_length
      FROM information_schema.columns
      WHERE (data_type IN ('text', 'jsonb', 'bytea', 'character varying') OR data_type LIKE '%text%')
        AND table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_name, column_name
    `);

    console.log('   Large data type columns found:');
    largeColumns.rows.forEach(col => {
      const maxLen = col.character_maximum_length ? `(max ${col.character_maximum_length})` : '(unlimited)';
      console.log(`     - ${col.table_name}.${col.column_name}: ${col.data_type} ${maxLen}`);
    });
    console.log();

    // Check for bloat
    console.log('🧹 CHECKING FOR DATABASE BLOAT:');
    console.log('─'.repeat(70));
    try {
      const bloat = await db.execute(sql`
        SELECT 
          schemaname || '.' || tablename AS table_name,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS bloat_size
        FROM pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
          AND pg_total_relation_size(schemaname||'.'||tablename) > pg_relation_size(schemaname||'.'||tablename) * 2
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      `);

      if (bloat.rows.length > 0) {
        console.log('   Tables with significant bloat (indexes much larger than data):');
        bloat.rows.forEach(row => {
          console.log(`     - ${row.table_name}: ${row.bloat_size} bloat`);
        });
      } else {
        console.log('   ✅ No significant bloat detected');
      }
    } catch (error) {
      console.log('   ⚠️ Could not check bloat:', error.message);
    }
    console.log();

    // Summary
    const dbSizeMB = dbSize.rows[0].size_bytes / 1024 / 1024;
    const tablesSizeMB = totalTablesSize / 1024 / 1024;
    const overheadMB = dbSizeMB - tablesSizeMB;

    console.log('═'.repeat(70));
    console.log('📊 STORAGE SUMMARY:');
    console.log('─'.repeat(70));
    console.log(`   Database Total: ${dbSizeMB.toFixed(2)} MB`);
    console.log(`   Tables Data: ${tablesSizeMB.toFixed(2)} MB`);
    console.log(`   Overhead/WAL/System: ${overheadMB.toFixed(2)} MB`);
    console.log(`   Overhead %: ${((overheadMB / dbSizeMB) * 100).toFixed(1)}%`);
    console.log();

    console.log('🎯 TOP SPACE CONSUMERS:');
    const top3 = allTables.rows.slice(0, 3);
    top3.forEach((table, i) => {
      const sizeMB = (parseInt(table.size_bytes) || 0) / 1024 / 1024;
      console.log(`   ${i + 1}. ${table.tablename}: ${sizeMB.toFixed(2)} MB`);
    });

    console.log();
    console.log('💡 NOTE: If Neon shows 1.54 GB but analysis shows ~3.38 MB,');
    console.log('   this is likely due to:');
    console.log('   - WAL (Write-Ahead Log) files');
    console.log('   - Temporary files');
    console.log('   - Database backups');
    console.log('   - Neon cloud overhead');

  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
}

detailedStorageAnalysis().catch(console.error);


