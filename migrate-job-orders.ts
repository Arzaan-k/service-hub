import { db } from "./server/db";
import { sql } from "drizzle-orm";

/**
 * Migration script to add job order numbers to existing service requests
 * that don't have them yet.
 */
async function migrateJobOrders() {
  console.log("Starting job order migration...");

  try {
    // Get all service requests without job orders, ordered by creation date
    const result = await db.execute(sql`
      SELECT id, created_at
      FROM service_requests
      WHERE job_order IS NULL
      ORDER BY created_at ASC
    `);

    const requests = result.rows;
    console.log(`Found ${requests.length} service requests without job orders`);

    if (requests.length === 0) {
      console.log("No service requests to migrate!");
      return;
    }

    // Group by month-year for sequential numbering
    const monthGroups: Record<string, any[]> = {};

    for (const request of requests) {
      const createdAt = new Date(request.created_at as string);
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                          'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const monthKey = `${monthNames[createdAt.getMonth()]}-${createdAt.getFullYear()}`;

      if (!monthGroups[monthKey]) {
        monthGroups[monthKey] = [];
      }
      monthGroups[monthKey].push(request);
    }

    // Update each request with a job order number
    let updatedCount = 0;

    for (const [monthKey, monthRequests] of Object.entries(monthGroups)) {
      const [monthPrefix, year] = monthKey.split('-');

      // Find the highest existing job order for this month
      const maxResult = await db.execute(sql`
        SELECT job_order
        FROM service_requests
        WHERE job_order LIKE ${monthPrefix + '%'}
          AND EXTRACT(YEAR FROM created_at) = ${parseInt(year)}
          AND job_order IS NOT NULL
        ORDER BY job_order DESC
        LIMIT 1
      `);

      let startNumber = 1;
      if (maxResult.rows.length > 0) {
        const maxJobOrder = maxResult.rows[0].job_order as string;
        const maxNumber = parseInt(maxJobOrder.substring(3));
        if (!isNaN(maxNumber)) {
          startNumber = maxNumber + 1;
        }
      }

      console.log(`\nProcessing ${monthRequests.length} requests for ${monthKey}, starting from ${monthPrefix}${startNumber.toString().padStart(3, '0')}`);

      // Update each request in this month
      for (let i = 0; i < monthRequests.length; i++) {
        const request = monthRequests[i];
        const jobOrderNumber = `${monthPrefix}${(startNumber + i).toString().padStart(3, '0')}`;

        await db.execute(sql`
          UPDATE service_requests
          SET job_order = ${jobOrderNumber}
          WHERE id = ${request.id as string}
        `);

        updatedCount++;
        console.log(`  - Updated request ${request.id} with job order: ${jobOrderNumber}`);
      }
    }

    console.log(`\n✅ Successfully migrated ${updatedCount} service requests with job order numbers!`);

    // Verify the migration
    const verifyResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM service_requests
      WHERE job_order IS NULL
    `);

    const remainingCount = verifyResult.rows[0].count;
    console.log(`\nVerification: ${remainingCount} service requests still without job orders`);

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

// Run the migration
migrateJobOrders()
  .then(() => {
    console.log("\n🎉 Migration completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Migration failed with error:", error);
    process.exit(1);
  });
