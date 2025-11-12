import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('='.repeat(70));
console.log('  Import Data Preview');
console.log('='.repeat(70));
console.log();

// Load all files
const pd1 = JSON.parse(readFileSync(join(__dirname, 'data_Container_Purchase_Details1_xlsx_Sheet1.json'), 'utf8'));
const pd2 = JSON.parse(readFileSync(join(__dirname, 'data_Container_Purchase_Details2_xlsx_Sheet1.json'), 'utf8'));
const sh1 = JSON.parse(readFileSync(join(__dirname, 'data_Service_History_xlsx_Sheet1.json'), 'utf8'));
const sh2 = JSON.parse(readFileSync(join(__dirname, 'data_Service_History2_xlsx_Sheet1.json'), 'utf8'));

// Analyze Purchase Details
console.log('📦 PURCHASE DETAILS ANALYSIS');
console.log('-'.repeat(70));

const uniqueCustomers = new Set();
pd1.forEach(record => {
  if (record['Customer Name']) {
    uniqueCustomers.add(record['Customer Name']);
  }
});

console.log(`Total Purchase Records: ${pd1.length + pd2.length}`);
console.log(`  - File 1 (Customer Info): ${pd1.length} records`);
console.log(`  - File 2 (Container Info): ${pd2.length} records`);
console.log(`Unique Customers: ${uniqueCustomers.size}`);

// Find matching quotations
const pd1QuotationSet = new Set();
pd1.forEach(record => {
  const key = `${record['Quotation No']}-${record['Order Received Number']}`;
  pd1QuotationSet.add(key);
});

const pd2QuotationSet = new Set();
pd2.forEach(record => {
  const key = `${record['Quotation No']}-${record['Order Received Number']}`;
  pd2QuotationSet.add(key);
});

let matchingQuotations = 0;
pd1QuotationSet.forEach(key => {
  if (pd2QuotationSet.has(key)) {
    matchingQuotations++;
  }
});

console.log(`Matching Quotations: ${matchingQuotations}`);
console.log(`Containers with Numbers: ${pd2.length}`);

// Sample customer
console.log('\nSample Customer:');
const sampleCustomer = pd1[0];
console.log(`  Name: ${sampleCustomer['Customer Name']}`);
console.log(`  Type: ${sampleCustomer['Customer Type']}`);
console.log(`  Order Type: ${sampleCustomer['Order Type']}`);
console.log(`  Product: ${sampleCustomer['Product']}`);
console.log(`  Quotation: ${sampleCustomer['Quotation No']}`);

// Sample container
console.log('\nSample Container:');
const sampleContainer = pd2[0];
console.log(`  Container No: ${sampleContainer['Container No/Vehicle No.']}`);
console.log(`  Quotation: ${sampleContainer['Quotation No']}`);
console.log(`  YOM: ${sampleContainer['YOM']}`);
console.log(`  Machine: ${sampleContainer['Machine Model']}`);

console.log();
console.log('='.repeat(70));
console.log();

// Analyze Service History
console.log('🔧 SERVICE HISTORY ANALYSIS');
console.log('-'.repeat(70));

const allServiceHistory = [...sh1, ...sh2];
console.log(`Total Service Records: ${allServiceHistory.length}`);
console.log(`  - File 1: ${sh1.length} records`);
console.log(`  - File 2: ${sh2.length} records`);

// Unique job orders
const uniqueJobOrders = new Set();
allServiceHistory.forEach(record => {
  const jobOrder = record['Job Order No.'] || record['Job order No'];
  if (jobOrder) {
    uniqueJobOrders.add(jobOrder);
  }
});

console.log(`Unique Job Orders: ${uniqueJobOrders.size}`);

// Unique containers in service history
const serviceContainers = new Set();
allServiceHistory.forEach(record => {
  const containerNo = record['Container Number'] || record['Container No'];
  if (containerNo) {
    serviceContainers.add(containerNo);
  }
});

console.log(`Unique Containers Serviced: ${serviceContainers.size}`);

// Unique clients in service history
const serviceClients = new Set();
allServiceHistory.forEach(record => {
  if (record['Client Name']) {
    serviceClients.add(record['Client Name']);
  }
});

console.log(`Unique Service Clients: ${serviceClients.size}`);

// Work types
const workTypes = new Set();
allServiceHistory.forEach(record => {
  if (record['Work Type']) {
    workTypes.add(record['Work Type']);
  }
});

console.log(`Work Types: ${[...workTypes].join(', ')}`);

// Sample service request
console.log('\nSample Service Request:');
const sampleService = sh1[0];
console.log(`  Job Order: ${sampleService['Job Order No.']}`);
console.log(`  Client: ${sampleService['Client Name']}`);
console.log(`  Container: ${sampleService['Container Number']}`);
console.log(`  Work Type: ${sampleService['Work Type']}`);
console.log(`  Status: ${sampleService['Call Status']}`);
console.log(`  Month/Year: ${sampleService['Month']} ${sampleService['Year']}`);

console.log();
console.log('='.repeat(70));
console.log();

// Cross-reference analysis
console.log('🔗 CROSS-REFERENCE ANALYSIS');
console.log('-'.repeat(70));

// How many containers in PD2 have service records?
const pd2Containers = new Set();
pd2.forEach(record => {
  if (record['Container No/Vehicle No.']) {
    pd2Containers.add(record['Container No/Vehicle No.']);
  }
});

let containersWithService = 0;
pd2Containers.forEach(containerNo => {
  if (serviceContainers.has(containerNo)) {
    containersWithService++;
  }
});

console.log(`Containers in Purchase Details: ${pd2Containers.size}`);
console.log(`Containers with Service Records: ${containersWithService}`);
console.log(`Containers without Service Records: ${pd2Containers.size - containersWithService}`);

// How many service containers are NOT in purchase details?
let serviceContainersNotInPD = 0;
serviceContainers.forEach(containerNo => {
  if (!pd2Containers.has(containerNo)) {
    serviceContainersNotInPD++;
  }
});

console.log(`Service Records for Unknown Containers: ${serviceContainersNotInPD}`);

console.log();
console.log('='.repeat(70));
console.log();

console.log('📊 IMPORT SUMMARY');
console.log('-'.repeat(70));
console.log(`Expected Customers to Import: ~${uniqueCustomers.size}`);
console.log(`Expected Containers to Import: ${pd2Containers.size}`);
console.log(`Expected Ownership Records: ${pd2.length}`);
console.log(`Expected Service Requests: ${uniqueJobOrders.size}`);
console.log();
console.log('⚠️  Notes:');
console.log('  - Actual counts may vary due to data cleaning and validation');
console.log('  - Duplicate customers will be merged');
console.log('  - Service requests without matching containers will be skipped');
console.log();
console.log('='.repeat(70));
console.log();
console.log('Ready to import? Run:');
console.log('  npm run import:excel');
console.log();
