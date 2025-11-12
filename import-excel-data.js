import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql, eq, and } from 'drizzle-orm';
import ws from 'ws';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Setup WebSocket for Neon
neonConfig.webSocketConstructor = ws;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.development
import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });

// Database connection
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set in .env.development file");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });

// Utility: Convert Excel serial date to JavaScript Date
function excelSerialToDate(serial) {
  if (!serial || typeof serial !== 'number') return null;

  // Excel date serial starts from 1900-01-01
  // JavaScript Date starts from 1970-01-01
  const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
  const jsDate = new Date(excelEpoch.getTime() + serial * 86400000);
  return jsDate;
}

// Utility: Safely get value or null
function safeValue(value) {
  if (value === undefined || value === null || value === '' || value === 'NA' || value === 'N/A') {
    return null;
  }
  return value;
}

// Utility: Generate UUID (simple version)
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Step 1: Run SQL migration
async function runMigration() {
  console.log('\n=== STEP 1: Running SQL Migration ===');

  try {
    const migrationSQL = readFileSync(join(__dirname, 'create_schema_updates.sql'), 'utf8');
    await pool.query(migrationSQL);
    console.log('✓ Migration completed successfully');
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    throw error;
  }
}

// Step 2: Clean existing data
async function cleanExistingData() {
  console.log('\n=== STEP 2: Cleaning Existing Data ===');

  try {
    // Delete in correct order due to foreign key constraints
    await pool.query('DELETE FROM container_ownership_history');
    console.log('✓ Cleaned container_ownership_history');

    await pool.query('DELETE FROM service_requests WHERE job_order IS NOT NULL');
    console.log('✓ Cleaned service_requests (Excel imports only)');

    await pool.query('DELETE FROM containers WHERE excel_metadata IS NOT NULL');
    console.log('✓ Cleaned containers (Excel imports only)');

    await pool.query('DELETE FROM customers WHERE email LIKE \'%imported%\' OR id IN (SELECT DISTINCT customer_id FROM container_ownership_history)');
    console.log('✓ Cleaned customers (Excel imports only)');

    console.log('✓ All existing data cleaned');
  } catch (error) {
    console.error('✗ Data cleaning failed:', error.message);
    throw error;
  }
}

// Step 3: Load JSON files
function loadJSONFiles() {
  console.log('\n=== STEP 3: Loading JSON Files ===');

  const files = {
    purchaseDetails1: JSON.parse(readFileSync(join(__dirname, 'data_Container_Purchase_Details1_xlsx_Sheet1.json'), 'utf8')),
    purchaseDetails2: JSON.parse(readFileSync(join(__dirname, 'data_Container_Purchase_Details2_xlsx_Sheet1.json'), 'utf8')),
    serviceHistory1: JSON.parse(readFileSync(join(__dirname, 'data_Service_History_xlsx_Sheet1.json'), 'utf8')),
    serviceHistory2: JSON.parse(readFileSync(join(__dirname, 'data_Service_History2_xlsx_Sheet1.json'), 'utf8'))
  };

  console.log(`✓ Loaded Purchase Details 1: ${files.purchaseDetails1.length} records`);
  console.log(`✓ Loaded Purchase Details 2: ${files.purchaseDetails2.length} records`);
  console.log(`✓ Loaded Service History 1: ${files.serviceHistory1.length} records`);
  console.log(`✓ Loaded Service History 2: ${files.serviceHistory2.length} records`);

  return files;
}

// Step 4: Create merged purchase data (join PD1 and PD2)
function mergePurchaseData(pd1, pd2) {
  console.log('\n=== STEP 4: Merging Purchase Data ===');

  const merged = [];
  let matchedCount = 0;
  let unmatchedCount = 0;

  // Create a map of PD2 by Quotation No and Order Received Number
  const pd2Map = new Map();
  pd2.forEach(record => {
    const key = `${record['Quotation No']}-${record['Order Received Number']}`;
    if (!pd2Map.has(key)) {
      pd2Map.set(key, []);
    }
    pd2Map.get(key).push(record);
  });

  // Merge PD1 with PD2
  pd1.forEach(pd1Record => {
    const key = `${pd1Record['Quotation No']}-${pd1Record['Order Received Number']}`;
    const pd2Records = pd2Map.get(key) || [];

    if (pd2Records.length > 0) {
      // Create one merged record for each container in PD2
      pd2Records.forEach(pd2Record => {
        merged.push({
          ...pd1Record,
          ...pd2Record,
          _source: 'merged'
        });
        matchedCount++;
      });
    } else {
      // No matching PD2 record, include PD1 only
      merged.push({
        ...pd1Record,
        _source: 'pd1_only'
      });
      unmatchedCount++;
    }
  });

  console.log(`✓ Merged ${matchedCount} records with container numbers`);
  console.log(`✓ ${unmatchedCount} records without container numbers (PD1 only)`);
  console.log(`✓ Total merged records: ${merged.length}`);

  return merged;
}

// Step 5: Import Customers
async function importCustomers(mergedData) {
  console.log('\n=== STEP 5: Importing Customers ===');

  const customerMap = new Map();
  let created = 0;
  let skipped = 0;

  for (const record of mergedData) {
    const customerName = safeValue(record['Customer Name']);
    if (!customerName) {
      skipped++;
      continue;
    }

    // Skip if already processed
    if (customerMap.has(customerName)) {
      continue;
    }

    const customerId = generateUUID();
    const userId = generateUUID();

    // Extract contact information
    const phone = safeValue(record['Contact Person Number (Billing)']) || '0000000000';
    const email = safeValue(record['Contact Person Email ID']) || `${customerName.toLowerCase().replace(/[^a-z0-9]/g, '')}@imported.local`;
    const contactPerson = safeValue(record['Contact Person Name (Billing)']) || 'Unknown';
    const whatsappNumber = phone;
    const billingAddress = safeValue(record['Billing Address']) || 'Not provided';
    const shippingAddress = safeValue(record['Dispatch Address']) || billingAddress;
    const gstin = safeValue(record['Billing Address'])?.match(/GST No[.\s:]*([A-Z0-9]+)/i)?.[1] || null;

    try {
      // Create user first, or get existing user ID
      const userResult = await pool.query(
        `INSERT INTO users (id, phone_number, name, email, role, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'client', true, NOW(), NOW())
         ON CONFLICT (phone_number) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [userId, phone, contactPerson, email]
      );

      const actualUserId = userResult.rows[0]?.id || userId;

      // Create customer
      const customerResult = await pool.query(
        `INSERT INTO customers (id, user_id, company_name, contact_person, email, phone, whatsapp_number,
                                billing_address, shipping_address, gstin, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', NOW(), NOW())
         ON CONFLICT (email) DO UPDATE SET company_name = EXCLUDED.company_name
         RETURNING id`,
        [customerId, actualUserId, customerName, contactPerson, email, phone, whatsappNumber,
         billingAddress, shippingAddress, gstin]
      );

      const actualCustomerId = customerResult.rows[0]?.id || customerId;
      customerMap.set(customerName, actualCustomerId);
      created++;

      if (created % 50 === 0) {
        console.log(`  Progress: ${created} customers created...`);
      }
    } catch (error) {
      console.error(`  ✗ Failed to create customer "${customerName}":`, error.message);
      skipped++;
    }
  }

  console.log(`✓ Created ${created} customers`);
  console.log(`✓ Skipped ${skipped} records`);

  return customerMap;
}

// Step 6: Import Containers and Ownership History
async function importContainersAndOwnership(mergedData, customerMap) {
  console.log('\n=== STEP 6: Importing Containers and Ownership History ===');

  const containerMap = new Map();
  let containersCreated = 0;
  let ownershipCreated = 0;
  let skipped = 0;

  for (const record of mergedData) {
    const containerNumber = safeValue(record['Container No/Vehicle No.']);
    const customerName = safeValue(record['Customer Name']);

    if (!containerNumber) {
      skipped++;
      continue;
    }

    if (!customerName || !customerMap.has(customerName)) {
      console.error(`  ✗ Customer not found for container ${containerNumber}: ${customerName}`);
      skipped++;
      continue;
    }

    const customerId = customerMap.get(customerName);

    try {
      // Check if container already exists
      let containerId;
      const existingContainer = await pool.query(
        'SELECT id FROM containers WHERE container_id = $1',
        [containerNumber]
      );

      if (existingContainer.rows.length > 0) {
        containerId = existingContainer.rows[0].id;
      } else {
        // Create container
        containerId = generateUUID();
        const containerType = determineContainerType(record['Product']);
        const yom = safeValue(record['YOM']) || null;
        const manufacturingDate = yom ? new Date(`${yom}-01-01`) : null;
        const startDate = excelSerialToDate(record['Date']) || excelSerialToDate(record['Internal Sales Order Date']) || new Date();

        await pool.query(
          `INSERT INTO containers (id, container_id, type, manufacturer, model, status,
                                   assigned_client_id, assignment_date, manufacturing_date,
                                   excel_metadata, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, $9, NOW(), NOW())`,
          [
            containerId,
            containerNumber,
            containerType,
            safeValue(record['Machine Make']),
            safeValue(record['Machine Model']),
            customerId,
            startDate,
            manufacturingDate,
            JSON.stringify(record)
          ]
        );

        containerMap.set(containerNumber, containerId);
        containersCreated++;
      }

      // Create ownership history
      const ownershipId = generateUUID();
      const orderType = safeValue(record['Order Type']) || 'Lease';
      const startDate = excelSerialToDate(record['Date']) || excelSerialToDate(record['Internal Sales Order Date']) || new Date();
      const tenure = {
        years: safeValue(record['Tenure (Lease period) YEAR']) || 0,
        months: safeValue(record['Tenure (Lease period) MONTHS']) || 0,
        days: safeValue(record['Tenure (Lease period) DAYS']) || 0
      };
      const basicAmount = safeValue(record['Basic Amount / Rent (Per Container)']) || 0;
      const securityDeposit = safeValue(record['Security Deposit']) || 0;

      await pool.query(
        `INSERT INTO container_ownership_history
         (id, container_id, customer_id, order_type, quotation_no, order_received_number,
          internal_sales_order_no, purchase_order_number, start_date, tenure,
          basic_amount, security_deposit, is_current, purchase_details, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, $13, NOW(), NOW())`,
        [
          ownershipId,
          containerId,
          customerId,
          orderType,
          safeValue(record['Quotation No']),
          safeValue(record['Order Received Number']),
          safeValue(record['Internal Sales Order No']),
          safeValue(record['Purchase Order Number']),
          startDate,
          JSON.stringify(tenure),
          basicAmount,
          securityDeposit,
          JSON.stringify(record)
        ]
      );

      ownershipCreated++;

      if (ownershipCreated % 50 === 0) {
        console.log(`  Progress: ${containersCreated} containers, ${ownershipCreated} ownership records...`);
      }
    } catch (error) {
      console.error(`  ✗ Failed to create container/ownership for ${containerNumber}:`, error.message);
      skipped++;
    }
  }

  console.log(`✓ Created ${containersCreated} containers`);
  console.log(`✓ Created ${ownershipCreated} ownership history records`);
  console.log(`✓ Skipped ${skipped} records`);

  return containerMap;
}

// Step 7: Import Service Requests from Service History
async function importServiceRequests(serviceHistory1, serviceHistory2, containerMap, customerMap) {
  console.log('\n=== STEP 7: Importing Service Requests ===');

  // Combine both service history files
  const allServiceHistory = [...serviceHistory1, ...serviceHistory2];
  console.log(`✓ Total service history records to process: ${allServiceHistory.length}`);

  let created = 0;
  let skipped = 0;
  const customerNameMap = new Map();

  // Build reverse customer map (name -> id)
  for (const [name, id] of customerMap.entries()) {
    customerNameMap.set(name.toLowerCase().trim(), id);
  }

  // Build reverse container map (number -> id)
  const containerNumberMap = new Map();
  const containerResult = await pool.query('SELECT id, container_id FROM containers');
  containerResult.rows.forEach(row => {
    containerNumberMap.set(row.container_id.toLowerCase().trim(), row.id);
  });

  for (const record of allServiceHistory) {
    const jobOrder = safeValue(record['Job Order No.'] || record['Job order No']);
    const containerNumber = safeValue(record['Container Number'] || record['Container No']);
    const clientName = safeValue(record['Client Name']);

    if (!jobOrder) {
      skipped++;
      continue;
    }

    // Find container ID
    let containerId = null;
    if (containerNumber) {
      containerId = containerNumberMap.get(containerNumber.toLowerCase().trim());
    }

    if (!containerId) {
      console.error(`  ✗ Container not found for job order ${jobOrder}: ${containerNumber}`);
      skipped++;
      continue;
    }

    // Find customer ID
    let customerId = null;
    if (clientName) {
      customerId = customerNameMap.get(clientName.toLowerCase().trim());
    }

    // If customer not found, try to get from container ownership
    if (!customerId) {
      const ownershipResult = await pool.query(
        'SELECT customer_id FROM container_ownership_history WHERE container_id = $1 AND is_current = true LIMIT 1',
        [containerId]
      );
      if (ownershipResult.rows.length > 0) {
        customerId = ownershipResult.rows[0].customer_id;
      }
    }

    if (!customerId) {
      console.error(`  ✗ Customer not found for job order ${jobOrder}: ${clientName}`);
      skipped++;
      continue;
    }

    try {
      // Get admin user ID for created_by
      const adminResult = await pool.query(
        "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
      );
      let createdBy = adminResult.rows.length > 0 ? adminResult.rows[0].id : null;

      // If no admin, create a system user
      if (!createdBy) {
        createdBy = generateUUID();
        await pool.query(
          `INSERT INTO users (id, phone_number, name, role, is_active, created_at, updated_at)
           VALUES ($1, 'system', 'System Import', 'admin', true, NOW(), NOW())
           ON CONFLICT (phone_number) DO UPDATE SET id = EXCLUDED.id`,
          [createdBy]
        );
      }

      const serviceId = generateUUID();
      const requestNumber = `SR-${jobOrder}`;
      const issueDescription = safeValue(record['Whats the complaint?'] || record['Issue(s) found']) || 'Imported from Excel';
      const workType = safeValue(record['Work Type']);
      const clientType = safeValue(record['Client Type']);
      const jobType = safeValue(record['Job Type']);
      const billingType = safeValue(record['Billing Type']);
      const callStatus = safeValue(record['Call Status'] || record['Status']);
      const month = safeValue(record['Month']);
      const year = safeValue(record['Year']);

      // Determine status from call status
      let status = 'completed';
      if (callStatus && callStatus.toLowerCase().includes('pending')) {
        status = 'pending';
      } else if (callStatus && callStatus.toLowerCase().includes('progress')) {
        status = 'in_progress';
      }

      // Parse timestamp
      let requestedAt = new Date();
      const timestamp = record['Timestamp'];
      if (timestamp) {
        if (typeof timestamp === 'string') {
          requestedAt = new Date(timestamp);
        } else if (typeof timestamp === 'number') {
          requestedAt = excelSerialToDate(timestamp);
        }
      }

      await pool.query(
        `INSERT INTO service_requests
         (id, request_number, job_order, container_id, client_id, issue_description,
          status, requested_at, work_type, client_type, job_type, billing_type,
          call_status, month, year, excel_data, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
         ON CONFLICT (job_order) DO NOTHING`,
        [
          serviceId,
          requestNumber,
          jobOrder,
          containerId,
          customerId,
          issueDescription,
          status,
          requestedAt,
          workType,
          clientType,
          jobType,
          billingType,
          callStatus,
          month,
          year,
          JSON.stringify(record),
          createdBy
        ]
      );

      created++;

      if (created % 100 === 0) {
        console.log(`  Progress: ${created} service requests created...`);
      }
    } catch (error) {
      if (error.message.includes('duplicate key')) {
        // Skip duplicates silently
        skipped++;
      } else {
        console.error(`  ✗ Failed to create service request ${jobOrder}:`, error.message);
        skipped++;
      }
    }
  }

  console.log(`✓ Created ${created} service requests`);
  console.log(`✓ Skipped ${skipped} records`);
}

// Helper: Determine container type from product description
function determineContainerType(product) {
  if (!product) return 'dry';

  const productLower = product.toLowerCase();
  if (productLower.includes('reefer') || productLower.includes('refrigerated')) {
    return 'refrigerated';
  } else if (productLower.includes('dry')) {
    return 'dry';
  } else if (productLower.includes('special')) {
    return 'special';
  }
  return 'dry';
}

// Main execution
async function main() {
  console.log('='.repeat(60));
  console.log('  Excel Data Import Script');
  console.log('  Service Hub Database Migration');
  console.log('='.repeat(60));

  const startTime = Date.now();

  try {
    // Step 1: Run migration
    await runMigration();

    // Step 2: Clean existing data
    await cleanExistingData();

    // Step 3: Load JSON files
    const files = loadJSONFiles();

    // Step 4: Merge purchase data
    const mergedPurchaseData = mergePurchaseData(files.purchaseDetails1, files.purchaseDetails2);

    // Step 5: Import customers
    const customerMap = await importCustomers(mergedPurchaseData);

    // Step 6: Import containers and ownership
    const containerMap = await importContainersAndOwnership(mergedPurchaseData, customerMap);

    // Step 7: Import service requests
    await importServiceRequests(files.serviceHistory1, files.serviceHistory2, containerMap, customerMap);

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log('  Import Summary');
    console.log('='.repeat(60));
    console.log(`✓ Total execution time: ${duration} seconds`);
    console.log(`✓ Customers imported: ${customerMap.size}`);
    console.log(`✓ Containers imported: ${containerMap.size}`);
    console.log('✓ All data imported successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('  Import Failed!');
    console.error('='.repeat(60));
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
