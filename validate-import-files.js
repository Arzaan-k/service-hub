import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('='.repeat(60));
console.log('  Import Files Validation');
console.log('='.repeat(60));
console.log();

const files = [
  {
    name: 'SQL Migration',
    path: 'create_schema_updates.sql',
    type: 'sql'
  },
  {
    name: 'Purchase Details 1',
    path: 'data_Container_Purchase_Details1_xlsx_Sheet1.json',
    type: 'json',
    expectedRecords: 619
  },
  {
    name: 'Purchase Details 2',
    path: 'data_Container_Purchase_Details2_xlsx_Sheet1.json',
    type: 'json',
    expectedRecords: 626
  },
  {
    name: 'Service History 1',
    path: 'data_Service_History_xlsx_Sheet1.json',
    type: 'json',
    expectedRecords: 1478
  },
  {
    name: 'Service History 2',
    path: 'data_Service_History2_xlsx_Sheet1.json',
    type: 'json',
    expectedRecords: 923
  }
];

let allValid = true;

files.forEach(file => {
  const fullPath = join(__dirname, file.path);
  process.stdout.write(`Checking ${file.name}... `);

  if (!existsSync(fullPath)) {
    console.log('✗ NOT FOUND');
    allValid = false;
    return;
  }

  try {
    const content = readFileSync(fullPath, 'utf8');

    if (file.type === 'json') {
      const data = JSON.parse(content);

      if (!Array.isArray(data)) {
        console.log('✗ INVALID (not an array)');
        allValid = false;
        return;
      }

      const actualRecords = data.length;
      if (file.expectedRecords && actualRecords !== file.expectedRecords) {
        console.log(`⚠ WARNING (expected ${file.expectedRecords}, got ${actualRecords})`);
      } else {
        console.log(`✓ OK (${actualRecords} records)`);
      }
    } else if (file.type === 'sql') {
      if (content.length < 100) {
        console.log('✗ INVALID (file too small)');
        allValid = false;
        return;
      }
      console.log(`✓ OK (${(content.length / 1024).toFixed(2)} KB)`);
    }
  } catch (error) {
    console.log(`✗ ERROR: ${error.message}`);
    allValid = false;
  }
});

console.log();
console.log('='.repeat(60));

if (allValid) {
  console.log('✓ All files are valid and ready for import!');
  console.log();
  console.log('You can now run the import script:');
  console.log('  npm run import:excel');
  console.log('  or');
  console.log('  node import-excel-data.js');
} else {
  console.log('✗ Some files are missing or invalid.');
  console.log();
  console.log('Please ensure all required files are present before running import.');
}

console.log('='.repeat(60));

process.exit(allValid ? 0 : 1);
