import { sql } from "drizzle-orm";
import { db } from "../db.js";

async function migrateTechnicianFields() {
  console.log("Starting technician fields migration...");

  try {
    // Add the missing columns to the technicians table
    await db.execute(sql`
      ALTER TABLE technicians
      ADD COLUMN IF NOT EXISTS hotel_allowance INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS local_travel_allowance INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS food_allowance INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS personal_allowance INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS service_request_cost INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pm_cost INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tasks_per_day INTEGER DEFAULT 3,
      ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7),
      ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7),
      ADD COLUMN IF NOT EXISTS location_address TEXT;
    `);

    console.log("✅ Successfully added technician fields to database");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run the migration
migrateTechnicianFields()
  .then(() => {
    console.log("Migration completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
