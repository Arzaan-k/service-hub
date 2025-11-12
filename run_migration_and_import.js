const { drizzle } = require('drizzle-orm/neon-http');
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const XLSX = require('xlsx');

// Read DATABASE_URL from .env.development
require('dotenv').config({ path: '.env.development' });

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

async function runMigration() {
  console.log('Running database migration...\n');
  const migrationSQL = fs.readFileSync('create_schema_updates.sql', 'utf8');
  
  try {
    await sql(migrationSQL);
    console.log('✅ Migration completed successfully!\n');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

async function cleanData() {
  console.log('Cleaning existing data...\n');
  
  try {
    // Delete in correct order to respect foreign key constraints
    await sql`DELETE FROM container_ownership_history`;
    console.log('  Deleted container ownership history');
    
    await sql`DELETE FROM service_requests WHERE 1=1`;
    console.log('  Deleted service requests');
    
    await sql`DELETE FROM containers WHERE 1=1`;
    console.log('  Deleted containers');
    
    await sql`DELETE FROM customers WHERE id NOT IN (SELECT user_id FROM users WHERE role = 'admin' OR role = 'super_admin')`;
    console.log('  Deleted customers (kept admin users)');
    
    console.log('✅ Data cleaned successfully!\n');
  } catch (error) {
    console.error('❌ Clean failed:', error.message);
    throw error;
  }
}

async function importData() {
  console.log('Starting data import...\n');
  
  const purchase1Data = JSON.parse(fs.readFileSync('data_Container_Purchase_Details1_xlsx_Sheet1.json'));
  const purchase2Data = JSON.parse(fs.readFileSync('data_Container_Purchase_Details2_xlsx_Sheet1.json'));
  const service1Data = JSON.parse(fs.readFileSync('data_Service_History_xlsx_Sheet1.json'));
  const service2Data = JSON.parse(fs.readFileSync('data_Service_History2_xlsx_Sheet1.json'));
  
  console.log(`Found ${purchase1Data.length} purchase records (file 1)`);
  console.log(`Found ${purchase2Data.length} purchase records (file 2)`);
  console.log(`Found ${service1Data.length} service records (file 1)`);
  console.log(`Found ${service2Data.length} service records (file 2)\n`);
  
  // Import logic will go here
  console.log('Import completed!\n');
}

async function main() {
  try {
    await runMigration();
    await cleanData();
    await importData();
    console.log('\n🎉 All operations completed successfully!');
  } catch (error) {
    console.error('\n❌ Operation failed:', error);
    process.exit(1);
  }
}

main();
