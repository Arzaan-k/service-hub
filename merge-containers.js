import { neon } from '@neondatabase/serverless';
import XLSX from 'xlsx';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

console.log('='.repeat(60));
console.log('  Container Merge and Update Strategy');
console.log('  Merging container2 into containers using container_id');
console.log('='.repeat(60));
console.log('');

// Step 1: Analyze Excel sheets
console.log('STEP 1: Analyzing Purchase Details Excel Sheets\n');

const workbook1 = XLSX.readFile('Container Purchase Details1.xlsx');
const sheet1 = workbook1.Sheets[workbook1.SheetNames[0]];
const data1 = XLSX.utils.sheet_to_json(sheet1);

const workbook2 = XLSX.readFile('Container Purchase Details2.xlsx');
const sheet2 = workbook2.Sheets[workbook2.SheetNames[0]];
const data2 = XLSX.utils.sheet_to_json(sheet2);

console.log(`✓ Loaded ${data1.length} rows from Purchase Details1`);
console.log(`✓ Loaded ${data2.length} rows from Purchase Details2`);

// Combine both datasets
const allPurchaseDetails = [...data1, ...data2];
console.log(`✓ Total purchase detail rows: ${allPurchaseDetails.length}\n`);

// Analyze quotation numbers
const quotationNos = new Set();
const containerNos = new Set();
allPurchaseDetails.forEach(row => {
  const quotNo = row['Quotation No'] || row['quotation_no'];
  const containerNo = row['Container No/Vehicle No.'] || row['container_code'];
  if (quotNo) quotationNos.add(quotNo);
  if (containerNo) containerNos.add(containerNo);
});

console.log(`✓ Unique Quotation Numbers: ${quotationNos.size}`);
console.log(`✓ Unique Container Numbers: ${containerNos.size}\n`);

// Step 2: Fetch data from containers and container2
console.log('STEP 2: Fetching Database Data\n');

const containersData = await sql`SELECT * FROM containers`;
const container2Data = await sql`SELECT * FROM container2`;

console.log(`✓ Containers table: ${containersData.length} rows`);
console.log(`✓ Container2 table: ${container2Data.length} rows\n`);

// Step 3: Analyze overlap and differences
console.log('STEP 3: Analyzing Data Overlap\n');

const containersMap = new Map();
containersData.forEach(c => {
  containersMap.set(c.container_id, c);
});

const container2Map = new Map();
container2Data.forEach(c => {
  container2Map.set(c.container_code, c);
});

let inBoth = 0;
let onlyInContainers = 0;
let onlyInContainer2 = 0;

// Check containers in container2
container2Data.forEach(c2 => {
  if (containersMap.has(c2.container_code)) {
    inBoth++;
  } else {
    onlyInContainer2++;
  }
});

// Check containers only in containers table
containersData.forEach(c => {
  if (!container2Map.has(c.container_id)) {
    onlyInContainers++;
  }
});

console.log(`✓ Containers in BOTH tables: ${inBoth}`);
console.log(`✓ Containers ONLY in containers table: ${onlyInContainers}`);
console.log(`✓ Containers ONLY in container2 table: ${onlyInContainer2}\n`);

// Step 4: Create merge strategy
console.log('STEP 4: Merge Strategy\n');

console.log('Strategy:');
console.log('1. For containers in BOTH tables: UPDATE containers with container2 data');
console.log('2. For containers ONLY in container2: INSERT into containers');
console.log('3. For containers ONLY in containers: Keep as is');
console.log('4. Map Quotation No from excel_metadata to containers\n');

// Save summary to file
const summary = {
  timestamp: new Date().toISOString(),
  purchaseDetails: {
    total: allPurchaseDetails.length,
    uniqueQuotations: quotationNos.size,
    uniqueContainers: containerNos.size
  },
  database: {
    containersTable: containersData.length,
    container2Table: container2Data.length,
    inBoth,
    onlyInContainers,
    onlyInContainer2
  },
  strategy: {
    toUpdate: inBoth,
    toInsert: onlyInContainer2,
    unchanged: onlyInContainers
  }
};

console.log('Summary:');
console.log(JSON.stringify(summary, null, 2));

console.log('\n' + '='.repeat(60));
console.log('Analysis Complete!');
console.log('='.repeat(60));

process.exit(0);
