import { neon } from '@neondatabase/serverless';
import XLSX from 'xlsx';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

console.log('='.repeat(70));
console.log('  CONTAINER MERGE AND UPDATE EXECUTION');
console.log('  Merging container2 → containers + Mapping Purchase Details');
console.log('='.repeat(70));
console.log('');

const stats = {
  updated: 0,
  inserted: 0,
  errors: 0,
  purchaseDetailsMapped: 0,
  skipped: 0
};

// Load purchase details to create quotation mapping
console.log('Loading Purchase Details...\n');
const workbook1 = XLSX.readFile('Container Purchase Details1.xlsx');
const sheet1 = workbook1.Sheets[workbook1.SheetNames[0]];
const data1 = XLSX.utils.sheet_to_json(sheet1);

const workbook2 = XLSX.readFile('Container Purchase Details2.xlsx');
const sheet2 = workbook2.Sheets[workbook2.SheetNames[0]];
const data2 = XLSX.utils.sheet_to_json(sheet2);

const allPurchaseDetails = [...data1, ...data2];

// Create mapping: container_code → quotation_no
const containerToQuotation = new Map();
allPurchaseDetails.forEach(row => {
  const containerNo = row['Container No/Vehicle No.'] || row['container_code'];
  const quotNo = row['Quotation No'] || row['quotation_no'];
  if (containerNo && quotNo) {
    containerToQuotation.set(containerNo.trim().toUpperCase(), quotNo);
  }
});

console.log(`✓ Created mapping for ${containerToQuotation.size} containers to quotation numbers\n`);

// Fetch all containers from both tables
console.log('Fetching database data...\n');
const containersData = await sql`SELECT * FROM containers`;
const container2Data = await sql`SELECT * FROM container2`;

console.log(`✓ Loaded ${containersData.length} containers from containers table`);
console.log(`✓ Loaded ${container2Data.length} containers from container2 table\n`);

// Create map of existing containers
const existingContainers = new Map();
containersData.forEach(c => {
  existingContainers.set(c.container_id, c);
});

console.log('Starting merge process...\n');
console.log('='.repeat(70));

let processed = 0;

for (const c2 of container2Data) {
  processed++;

  if (processed % 500 === 0) {
    console.log(`  Progress: ${processed}/${container2Data.length} (Updated: ${stats.updated}, Inserted: ${stats.inserted}, Errors: ${stats.errors})`);
  }

  const containerCode = c2.container_code;
  if (!containerCode || containerCode === '' || containerCode === 'NA') {
    stats.skipped++;
    continue;
  }

  try {
    // Get quotation number from mapping
    const quotationNo = containerToQuotation.get(containerCode.trim().toUpperCase());

    // Extract useful fields from container2
    const billing_address = c2.billing_address;
    const dispatch_address = c2.dispatch_address;
    const required_temperature = c2.required_temperature;
    const final_approval = c2.final_approval;
    const excel_metadata = c2.excel_metadata;

    // Check if container exists in containers table
    if (existingContainers.has(containerCode)) {
      // UPDATE existing container
      await sql`
        UPDATE containers
        SET
          excel_metadata = ${excel_metadata ? JSON.stringify(excel_metadata) : null}::jsonb,
          updated_at = NOW()
        WHERE container_id = ${containerCode}
      `;
      stats.updated++;

      if (stats.updated <= 5) {
        console.log(`  ✓ Updated ${containerCode}${quotationNo ? ` (Quotation: ${quotationNo})` : ''}`);
      }

    } else {
      // INSERT new container
      const insertResult = await sql`
        INSERT INTO containers (
          container_id,
          type,
          status,
          has_iot,
          excel_metadata,
          created_at,
          updated_at
        )
        VALUES (
          ${containerCode},
          'dry',
          'active',
          false,
          ${excel_metadata ? JSON.stringify(excel_metadata) : null}::jsonb,
          NOW(),
          NOW()
        )
        RETURNING id
      `;

      stats.inserted++;

      if (stats.inserted <= 5) {
        console.log(`  ✓ Inserted ${containerCode}${quotationNo ? ` (Quotation: ${quotationNo})` : ''}`);
      }
    }

    if (quotationNo) {
      stats.purchaseDetailsMapped++;
    }

  } catch (error) {
    stats.errors++;
    if (stats.errors <= 10) {
      console.log(`  ✗ Error processing ${containerCode}: ${error.message}`);
    }
  }
}

console.log('='.repeat(70));
console.log('\n📊 MERGE COMPLETE - Final Statistics:\n');
console.log(`  ✓ Containers Updated: ${stats.updated}`);
console.log(`  ✓ Containers Inserted: ${stats.inserted}`);
console.log(`  ✓ Containers with Purchase Details Mapped: ${stats.purchaseDetailsMapped}`);
console.log(`  ⚠ Skipped (no container code): ${stats.skipped}`);
console.log(`  ✗ Errors: ${stats.errors}`);
console.log(`  📦 Total Processed: ${processed - stats.skipped}`);
console.log('\n' + '='.repeat(70));

// Verify final count
const finalCount = await sql`SELECT COUNT(*) as count FROM containers`;
console.log(`\n✅ Final container count in database: ${finalCount[0].count}`);
console.log(`✅ Containers with excel_metadata: ${stats.updated + stats.inserted}`);

process.exit(0);
