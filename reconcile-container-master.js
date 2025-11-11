import XLSX from 'xlsx';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

// Load environment variables
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

console.log('============================================================');
console.log('  Container Master Sheet Reconciliation');
console.log('  Reconciling and updating container data from master sheet');
console.log('============================================================\n');

// Read the Container Master Sheet
const workbook = XLSX.readFile('Container Master Sheet.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const masterData = XLSX.utils.sheet_to_json(worksheet);

console.log(`✓ Loaded ${masterData.length} containers from master sheet`);
console.log(`✓ Columns: ${Object.keys(masterData[0] || {}).join(', ')}\n`);

// Statistics
const stats = {
  total: masterData.length,
  matched: 0,
  updated: 0,
  notFound: 0,
  errors: 0,
  fieldsUpdated: {
    productType: 0,
    sizeType: 0,
    groupName: 0,
    gkuProductName: 0,
    category: 0,
    location: 0,
    depot: 0,
    yom: 0,
    status: 0,
    grade: 0,
    reeferUnit: 0,
    reeferModel: 0,
    imageLinks: 0,
    size: 0,
  }
};

console.log('=== STEP 1: Reconciling Container Data ===\n');

for (const row of masterData) {
  const containerCode = row['__EMPTY']; // Container ID is in __EMPTY column

  if (!containerCode) {
    stats.errors++;
    continue;
  }

  try {
    // Find container in database
    const existingContainers = await sql`
      SELECT * FROM containers
      WHERE container_id = ${containerCode}
      LIMIT 1
    `;

    if (existingContainers.length === 0) {
      stats.notFound++;
      if (stats.notFound <= 10) {
        console.log(`  ⚠ Container not found in DB: ${containerCode}`);
      }
      continue;
    }

    const existingContainer = existingContainers[0];
    stats.matched++;

    // Prepare update data
    const updates = {};
    let hasUpdates = false;

    // Map master sheet fields to database fields
    const productType = row['Product Type'];
    const sizeType = row['Size Type'];
    const groupName = row['GROUP NAME'];
    const gkuProductName = row['GKU - PRODUCT NAME'];
    const category = row['Category(Condition and usage state)'];
    const location = row['Location'];
    const depot = row['Depot'];
    const yom = row['YOM'] ? parseInt(row['YOM']) : null;
    const status = row['Status'] || row['Current'];
    const grade = row['Grade'];
    const reeferUnit = row['Reefer Unit'];
    const reeferModel = row['Reefer Unit Model Name (Thinline / MP)'];
    const imageLinks = row['Image Links'];
    const size = row['SIZE'] ? parseInt(row['SIZE']) : null;

    // Build update fields
    const fieldsToUpdate = [];
    const values = [containerCode]; // First parameter for WHERE clause
    let paramIndex = 2;

    const addField = (field, value, statKeyName) => {
      if (value && value !== 'NA' && value !== '') {
        if (!existingContainer[field] || existingContainer[field] !== value) {
          fieldsToUpdate.push(`${field} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
          stats.fieldsUpdated[statKeyName]++;
          hasUpdates = true;
        }
      }
    };

    addField('product_type', productType, 'productType');
    addField('size_type', sizeType, 'sizeType');
    addField('group_name', groupName, 'groupName');
    addField('gku_product_name', gkuProductName, 'gkuProductName');
    addField('category', category, 'category');
    // Skip current_location - it's a JSONB field, not text
    addField('depot', depot, 'depot');
    addField('yom', yom, 'yom');
    addField('status', status, 'status');
    addField('grade', grade, 'grade');
    addField('reefer_unit', reeferUnit, 'reeferUnit');
    addField('reefer_model', reeferModel, 'reeferModel');
    addField('image_links', imageLinks, 'imageLinks');
    addField('size', size, 'size');

    // Skip JSON field for now - causes issues with special characters
    // Just update individual fields which is safer

    // Always update the updated_at timestamp
    fieldsToUpdate.push(`updated_at = NOW()`);

    // Perform update if there are changes
    if (hasUpdates && fieldsToUpdate.length > 0) {
      const updateQuery = `
        UPDATE containers
        SET ${fieldsToUpdate.join(', ')}
        WHERE container_id = $1
      `;

      await sql(updateQuery, values);
      stats.updated++;

      if (stats.updated <= 5) {
        console.log(`  ✓ Updated ${containerCode}: ${fieldsToUpdate.length} fields`);
      } else if (stats.updated % 100 === 0) {
        console.log(`  Progress: ${stats.updated} containers updated...`);
      }
    }

  } catch (error) {
    stats.errors++;
    console.error(`  ✗ Error processing ${containerCode}:`, error.message);
  }
}

console.log('\n=== RECONCILIATION COMPLETE ===\n');
console.log('Summary:');
console.log(`  Total containers in master sheet: ${stats.total}`);
console.log(`  Matched in database: ${stats.matched}`);
console.log(`  Updated with new data: ${stats.updated}`);
console.log(`  Not found in database: ${stats.notFound}`);
console.log(`  Errors: ${stats.errors}`);

console.log('\nFields Updated:');
for (const [field, count] of Object.entries(stats.fieldsUpdated)) {
  if (count > 0) {
    console.log(`  ${field}: ${count} containers`);
  }
}

console.log('\n✅ Container master sheet reconciliation completed!');
process.exit(0);
