/**
 * Script to check if Excel data might have different status values
 */

import { db } from './server/db.ts';

async function checkExcelImportData() {
  console.log('🔍 Checking for Excel import data and other possible status fields...');

  try {
    // Check if there's an excel_metadata field that might contain status information
    const excelMetadataContainers = await db.execute(`
      SELECT container_id, status, excel_metadata
      FROM containers
      WHERE excel_metadata IS NOT NULL
      LIMIT 5
    `);

    if (excelMetadataContainers.rows.length > 0) {
      console.log('📊 Containers with excel_metadata:');
      excelMetadataContainers.rows.forEach(row => {
        console.log(`- ${row.container_id}: ${row.status}`);
        if (row.excel_metadata) {
          console.log(`  Excel metadata: ${JSON.stringify(row.excel_metadata)}`);
        }
      });
    }

    // Check for any other fields that might contain status-like information
    const allColumns = await db.execute(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'containers'
      AND column_name NOT IN ('id', 'created_at', 'updated_at')
    `);

    console.log('\n📋 All columns in containers table:');
    allColumns.rows.forEach(col => {
      console.log(`- ${col.column_name}`);
    });

    // Check if there are any text fields that might contain "sale" or "for sale"
    const textFields = ['manufacturer', 'model', 'capacity'];
    for (const field of textFields) {
      const fieldCheck = await db.execute(`
        SELECT COUNT(*) as count
        FROM containers
        WHERE ${field} ILIKE '%for sale%' OR ${field} ILIKE '%sale%'
      `);

      if (parseInt(fieldCheck.rows[0].count) > 0) {
        console.log(`\n✅ Found ${fieldCheck.rows[0].count} containers where ${field} contains "sale"`);
      }
    }

  } catch (error) {
    console.error('❌ Error checking Excel import data:', error);
    process.exit(1);
  }
}

checkExcelImportData();
