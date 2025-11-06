import XLSX from 'xlsx';
import dotenv from 'dotenv';
import { db } from './server/db.js';
import { containers } from './shared/schema.js';

// Load environment variables
dotenv.config();

// Read the Excel file
const workbook = XLSX.readFile('Container Master Sheet.xlsx');
const sheetName = workbook.SheetNames[0]; // Get first sheet
const worksheet = workbook.Sheets[sheetName];

// Convert to JSON
const data = XLSX.utils.sheet_to_json(worksheet);

console.log('Excel file analysis:');
console.log('Sheet name:', sheetName);
console.log('Total rows:', data.length);
console.log('Columns:', Object.keys(data[0] || {}));
console.log('\nFirst 3 rows:');
console.log(JSON.stringify(data.slice(0, 3), null, 2));

// Check current database state
console.log('\nCurrent containers in database:');
const existingContainers = await db.select().from(containers);
console.log('Count:', existingContainers.length);
if (existingContainers.length > 0) {
  console.log('Sample container:', existingContainers[0]);
}
