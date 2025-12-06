/**
 * Clear all auto-generated PM (Preventive Maintenance) service requests
 * WARNING: This will delete ALL auto-generated PM service requests and related data!
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

async function clearAutoPMData() {
  console.log('🧹 Starting auto PM data cleanup...');
  console.log('⚠️  WARNING: This will delete ALL auto-generated PM service requests!');

  try {
    // Count total PM service requests before deletion
    // Assuming PM requests have specific patterns or are created by system with "Preventive Maintenance" in description
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total
      FROM service_requests
      WHERE
        issue_description LIKE '%Preventive Maintenance%'
        OR issue_description LIKE '%PM%'
        OR issue_description LIKE '%(90-day threshold)%'
        OR issue_description LIKE '%(180-day threshold)%'
        OR created_by = 'system'
    `);
    const totalPMRequests = countResult.rows[0]?.total || 0;

    console.log(`📊 Found ${totalPMRequests} auto PM service requests in database`);

    if (totalPMRequests === 0) {
      console.log('✅ No auto PM service requests to clear');
      process.exit(0);
    }

    // Show breakdown
    const breakdownResult = await db.execute(sql`
      SELECT
        status,
        COUNT(*) as count
      FROM service_requests
      WHERE
        issue_description LIKE '%Preventive Maintenance%'
        OR issue_description LIKE '%PM%'
        OR issue_description LIKE '%(90-day threshold)%'
        OR issue_description LIKE '%(180-day threshold)%'
        OR created_by = 'system'
      GROUP BY status
    `);

    console.log('\n📊 PM Requests by status:');
    breakdownResult.rows.forEach((row: any) => {
      console.log(`  ${row.status}: ${row.count}`);
    });

    // Get IDs of PM requests to delete
    const pmIdsResult = await db.execute(sql`
      SELECT id
      FROM service_requests
      WHERE
        issue_description LIKE '%Preventive Maintenance%'
        OR issue_description LIKE '%PM%'
        OR issue_description LIKE '%(90-day threshold)%'
        OR issue_description LIKE '%(180-day threshold)%'
        OR created_by = 'system'
    `);

    const pmIds = pmIdsResult.rows.map((row: any) => row.id);

    console.log('\n⏳ Deleting related data first...');

    // Step 1: Delete service report PDFs
    console.log('📄 Deleting service report PDFs...');
    const pdfResult = await db.execute(sql`
      DELETE FROM service_report_pdfs
      WHERE service_request_id IN (
        SELECT id FROM service_requests
        WHERE
          issue_description LIKE '%Preventive Maintenance%'
          OR issue_description LIKE '%PM%'
          OR issue_description LIKE '%(90-day threshold)%'
          OR issue_description LIKE '%(180-day threshold)%'
          OR created_by = 'system'
      )
    `);
    console.log(`✅ Deleted ${pdfResult.rowCount || 0} service report PDFs`);

    // Step 2: Delete invoices
    console.log('💰 Deleting invoices...');
    const invoiceResult = await db.execute(sql`
      DELETE FROM invoices
      WHERE service_request_id IN (
        SELECT id FROM service_requests
        WHERE
          issue_description LIKE '%Preventive Maintenance%'
          OR issue_description LIKE '%PM%'
          OR issue_description LIKE '%(90-day threshold)%'
          OR issue_description LIKE '%(180-day threshold)%'
          OR created_by = 'system'
      )
    `);
    console.log(`✅ Deleted ${invoiceResult.rowCount || 0} invoices`);

    // Step 3: Delete technician trip tasks
    console.log('🚗 Deleting technician trip tasks...');
    const tripTasksResult = await db.execute(sql`
      DELETE FROM technician_trip_tasks
      WHERE service_request_id IN (
        SELECT id FROM service_requests
        WHERE
          issue_description LIKE '%Preventive Maintenance%'
          OR issue_description LIKE '%PM%'
          OR issue_description LIKE '%(90-day threshold)%'
          OR issue_description LIKE '%(180-day threshold)%'
          OR created_by = 'system'
      )
    `);
    console.log(`✅ Deleted ${tripTasksResult.rowCount || 0} trip tasks`);

    // Step 4: Clear alert references
    console.log('🔗 Clearing alert references...');
    await db.execute(sql`
      UPDATE alerts
      SET service_request_id = NULL
      WHERE service_request_id IN (
        SELECT id FROM service_requests
        WHERE
          issue_description LIKE '%Preventive Maintenance%'
          OR issue_description LIKE '%PM%'
          OR issue_description LIKE '%(90-day threshold)%'
          OR issue_description LIKE '%(180-day threshold)%'
          OR created_by = 'system'
      )
    `);
    console.log('✅ Cleared alert references');

    // Step 5: Delete PM service requests
    console.log('🗑️  Deleting auto PM service requests...');
    const deleteResult = await db.execute(sql`
      DELETE FROM service_requests
      WHERE
        issue_description LIKE '%Preventive Maintenance%'
        OR issue_description LIKE '%PM%'
        OR issue_description LIKE '%(90-day threshold)%'
        OR issue_description LIKE '%(180-day threshold)%'
        OR created_by = 'system'
    `);

    console.log(`✅ Successfully deleted ${totalPMRequests} auto PM service requests`);

    // Verify deletion
    const verifyResult = await db.execute(sql`
      SELECT COUNT(*) as remaining
      FROM service_requests
      WHERE
        issue_description LIKE '%Preventive Maintenance%'
        OR issue_description LIKE '%PM%'
        OR created_by = 'system'
    `);
    const remaining = verifyResult.rows[0]?.remaining || 0;

    if (remaining === 0) {
      console.log('✅ All auto PM service requests have been cleared');
    } else {
      console.log(`⚠️  Warning: ${remaining} PM service requests still remain`);
    }

    console.log('\n🎉 Auto PM cleanup completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error clearing auto PM data:', error);
    console.error('\nIf you see a foreign key constraint error, you may need to:');
    console.error('1. Clear related data first');
    console.error('2. Or update the foreign key constraints');
    process.exit(1);
  }
}

clearAutoPMData();
