import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

console.log('============================================================');
console.log('  Running Container Master Sheet Migration');
console.log('============================================================\n');

const migrations = [
  // Product information fields
  "ALTER TABLE containers ADD COLUMN IF NOT EXISTS product_type TEXT",
  "ALTER TABLE containers ADD COLUMN IF NOT EXISTS size_type TEXT",
  "ALTER TABLE containers ADD COLUMN IF NOT EXISTS group_name TEXT",
  "ALTER TABLE containers ADD COLUMN IF NOT EXISTS gku_product_name TEXT",
  "ALTER TABLE containers ADD COLUMN IF NOT EXISTS category TEXT",
  "ALTER TABLE containers ADD COLUMN IF NOT EXISTS size INTEGER",

  // Location and depot
  "ALTER TABLE containers ADD COLUMN IF NOT EXISTS depot TEXT",

  // Container details
  "ALTER TABLE containers ADD COLUMN IF NOT EXISTS yom INTEGER",
  "ALTER TABLE containers ADD COLUMN IF NOT EXISTS grade TEXT",

  // Reefer specific
  "ALTER TABLE containers ADD COLUMN IF NOT EXISTS reefer_unit TEXT",
  "ALTER TABLE containers ADD COLUMN IF NOT EXISTS reefer_model TEXT",

  // Images and metadata
  "ALTER TABLE containers ADD COLUMN IF NOT EXISTS image_links TEXT",
  "ALTER TABLE containers ADD COLUMN IF NOT EXISTS master_sheet_data JSONB",

  // Indexes
  "CREATE INDEX IF NOT EXISTS idx_containers_product_type ON containers(product_type)",
  "CREATE INDEX IF NOT EXISTS idx_containers_depot ON containers(depot)",
  "CREATE INDEX IF NOT EXISTS idx_containers_grade ON containers(grade)",
  "CREATE INDEX IF NOT EXISTS idx_containers_yom ON containers(yom)",
  "CREATE INDEX IF NOT EXISTS idx_containers_category ON containers(category)",
];

let completed = 0;
let failed = 0;

for (const migration of migrations) {
  try {
    await sql(migration);
    completed++;
    console.log(`✓ ${migration.substring(0, 60)}...`);
  } catch (error) {
    failed++;
    console.error(`✗ Failed: ${migration.substring(0, 60)}...`);
    console.error(`  Error: ${error.message}`);
  }
}

console.log(`\n=== Migration Summary ===`);
console.log(`✓ Completed: ${completed}`);
console.log(`✗ Failed: ${failed}`);

if (failed === 0) {
  console.log('\n✅ All migrations completed successfully!');
} else {
  console.log(`\n⚠️  ${failed} migrations failed. Please check the errors above.`);
}

process.exit(failed > 0 ? 1 : 0);
