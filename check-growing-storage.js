import 'dotenv/config';
import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function checkGrowingStorage() {
  console.log('🔍 INVESTIGATING STORAGE GROWTH');
  console.log('═'.repeat(70));
  console.log();

  try {
    // Current database size
    const dbSize = await db.execute(sql`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as total_size,
        pg_database_size(current_database()) as size_bytes
    `);
    console.log(`📊 Current Database Size: ${dbSize.rows[0].total_size} (${(dbSize.rows[0].size_bytes / 1024 / 1024).toFixed(2)} MB)`);
    console.log();

    // Check for WAL files size
    console.log('📋 CHECKING WAL (Write-Ahead Log) FILES:');
    console.log('─'.repeat(70));
    try {
      const walSize = await db.execute(sql`
        SELECT 
          pg_size_pretty(pg_current_wal_lsn() - '0/0') as wal_size,
          pg_size_pretty(SUM(pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0'))) as estimated_wal
      `);
      console.log(`   WAL information: ${JSON.stringify(walSize.rows[0])}`);
    } catch (error) {
      console.log('   ⚠️ Cannot check WAL size:', error.message);
    }

    // Check manual_chunks growth
    console.log('\n📋 CHECKING manual_chunks TABLE:');
    console.log('─'.repeat(70));
    const chunksCheck = await db.execute(sql`
      SELECT 
        COUNT(*) as total_chunks,
        COUNT(embedding) as chunks_with_embeddings,
        pg_size_pretty(pg_total_relation_size('manual_chunks')) as table_size,
        pg_size_pretty(pg_relation_size('manual_chunks')) as data_size
      FROM manual_chunks
    `);
    console.log(`   Total chunks: ${chunksCheck.rows[0].total_chunks}`);
    console.log(`   With embeddings: ${chunksCheck.rows[0].chunks_with_embeddings}`);
    console.log(`   Table size: ${chunksCheck.rows[0].table_size}`);
    console.log(`   Data size: ${chunksCheck.rows[0].data_size}`);

    // Check containers table (largest table)
    console.log('\n📋 CHECKING containers TABLE (Largest):');
    console.log('─'.repeat(70));
    const containersCheck = await db.execute(sql`
      SELECT 
        COUNT(*) as total_containers,
        pg_size_pretty(pg_total_relation_size('containers')) as table_size,
        pg_size_pretty(pg_relation_size('containers')) as data_size,
        pg_size_pretty(pg_indexes_size('containers')) as indexes_size
      FROM containers
    `);
    console.log(`   Total containers: ${containersCheck.rows[0].total_containers}`);
    console.log(`   Table size: ${containersCheck.rows[0].table_size}`);
    console.log(`   Data size: ${containersCheck.rows[0].data_size}`);
    console.log(`   Indexes size: ${containersCheck.rows[0].indexes_size}`);

    // Check for large text fields in containers
    console.log('\n🔍 CHECKING containers TEXT DATA SIZE:');
    console.log('─'.repeat(70));
    const containerText = await db.execute(sql`
      SELECT 
        AVG(LENGTH(COALESCE(model, ''))) as avg_model_length,
        AVG(LENGTH(COALESCE(container_id, ''))) as avg_id_length,
        AVG(pg_column_size(current_location)) as avg_location_size,
        AVG(pg_column_size(last_telemetry)) as avg_telemetry_size,
        AVG(pg_column_size(excel_metadata)) as avg_metadata_size,
        SUM(LENGTH(COALESCE(model, ''))) as total_model_bytes,
        SUM(LENGTH(COALESCE(container_id, ''))) as total_id_bytes,
        SUM(pg_column_size(current_location)) as total_location_bytes,
        SUM(pg_column_size(last_telemetry)) as total_telemetry_bytes,
        SUM(pg_column_size(excel_metadata)) as total_metadata_bytes
      FROM containers
    `);
    const textData = containerText.rows[0];
    console.log(`   Model text: ${(textData.total_model_bytes / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Location JSON: ${(textData.total_location_bytes / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Telemetry JSON: ${(textData.total_telemetry_bytes / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Excel Metadata: ${(textData.total_metadata_bytes / 1024 / 1024).toFixed(2)} MB`);

    // Check for recent activity
    console.log('\n📋 RECENT DATABASE ACTIVITY:');
    console.log('─'.repeat(70));
    
    // Check recent inserts/updates
    const recentActivity = await db.execute(sql`
      SELECT 
        'containers' as table_name,
        COUNT(*) as recent_count
      FROM containers
      WHERE created_at > NOW() - INTERVAL '24 hours'
      UNION ALL
      SELECT 
        'manual_chunks' as table_name,
        COUNT(*) as recent_count
      FROM manual_chunks
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);
    
    console.log('   Recent inserts (last 24 hours):');
    recentActivity.rows.forEach(row => {
      if (parseInt(row.recent_count) > 0) {
        console.log(`     - ${row.table_name}: ${row.recent_count} new rows`);
      }
    });

    // Check all table sizes
    console.log('\n📊 ALL TABLE SIZES:');
    console.log('─'.repeat(70));
    const allTables = await db.execute(sql`
      SELECT 
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
        pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        AND pg_total_relation_size(schemaname||'.'||tablename) > 0
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `);

    let total = 0;
    allTables.rows.forEach((row, i) => {
      total += parseInt(row.size_bytes) || 0;
      const sizeMB = (parseInt(row.size_bytes) || 0) / 1024 / 1024;
      if (sizeMB > 0.1) {
        console.log(`   ${(i + 1).toString().padStart(2, ' ')}. ${row.tablename.padEnd(30, ' ')} │ ${row.size.padEnd(12, ' ')} │ ${sizeMB.toFixed(2)} MB`);
      }
    });

    console.log('─'.repeat(70));
    console.log(`   Total Tables: ${(total / 1024 / 1024).toFixed(2)} MB`);

    console.log('\n═'.repeat(70));
    console.log('💡 DIAGNOSIS:');
    console.log('   If Neon shows 1.69 GB but PostgreSQL reports ~12 MB:');
    console.log('   - This is likely WAL files and Neon platform overhead');
    console.log('   - Neon maintains backups and transaction logs');
    console.log('   - Actual database data is only ~12 MB');
    console.log('   - Storage growth may be from backups accumulating');

  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
}

checkGrowingStorage().catch(console.error);


