/**
 * Clear all service requests from the database
 * WARNING: This will delete ALL service requests permanently!
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

async function clearAllServiceRequests() {
  console.log('🧹 Starting service requests cleanup...');
  console.log('⚠️  WARNING: This will delete ALL service requests permanently!');

  try {
    // Count total service requests before deletion
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total FROM service_requests
    `);
    const totalRequests = countResult.rows[0]?.total || 0;

    console.log(`📊 Found ${totalRequests} service requests in database`);

    if (totalRequests === 0) {
      console.log('✅ No service requests to clear');
      process.exit(0);
    }

    // Get breakdown by status
    const statusResult = await db.execute(sql`
      SELECT status, COUNT(*) as count
      FROM service_requests
      GROUP BY status
    `);

    console.log('\n📊 Service requests by status:');
    statusResult.rows.forEach((row: any) => {
      console.log(`  ${row.status}: ${row.count}`);
    });

    console.log('\n⏳ Deleting related data first...');

    // Step 1: Delete service report PDFs
    console.log('📄 Deleting service report PDFs...');
    const pdfResult = await db.execute(sql`
      DELETE FROM service_report_pdfs
      WHERE service_request_id IN (SELECT id FROM service_requests)
    `);
    console.log(`✅ Deleted ${pdfResult.rowCount || 0} service report PDFs`);

    // Step 2: Delete invoices linked to service requests
    console.log('💰 Deleting invoices linked to service requests...');
    const invoiceResult = await db.execute(sql`
      DELETE FROM invoices
      WHERE service_request_id IN (SELECT id FROM service_requests)
    `);
    console.log(`✅ Deleted ${invoiceResult.rowCount || 0} invoices`);

    // Step 3: Delete technician trip tasks
    console.log('🚗 Deleting technician trip tasks...');
    const tripTasksResult = await db.execute(sql`
      DELETE FROM technician_trip_tasks
      WHERE service_request_id IN (SELECT id FROM service_requests)
    `);
    console.log(`✅ Deleted ${tripTasksResult.rowCount || 0} trip tasks`);

    // Step 4: Clear alert references
    console.log('🔗 Clearing alert references...');
    await db.execute(sql`
      UPDATE alerts
      SET service_request_id = NULL
      WHERE service_request_id IS NOT NULL
    `);
    console.log('✅ Cleared alert references');

    // Step 5: Now delete all service requests
    console.log('🗑️  Deleting all service requests...');
    const deleteResult = await db.execute(sql`
      DELETE FROM service_requests
    `);

    console.log(`✅ Successfully deleted ${totalRequests} service requests`);

    // Verify deletion
    const verifyResult = await db.execute(sql`
      SELECT COUNT(*) as remaining FROM service_requests
    `);
    const remaining = verifyResult.rows[0]?.remaining || 0;

    if (remaining === 0) {
      console.log('✅ All service requests have been cleared');
    } else {
      console.log(`⚠️  Warning: ${remaining} service requests still remain`);
    }

    console.log('\n🎉 Cleanup completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error clearing service requests:', error);
    console.error('\nIf you see a foreign key constraint error, you may need to:');
    console.error('1. Clear related data first (alerts, schedules, etc.)');
    console.error('2. Or update the foreign key constraints');
    process.exit(1);
  }
}

clearAllServiceRequests();
