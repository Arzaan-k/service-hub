import { promises as fs } from 'fs';
import { join } from 'path';

const filesToDelete = [
  // Test files
  'test-api-comprehensive.js',
  'test-api-connectivity.js',
  'test-api-correct.js',
  'test-api-simple.js',
  'test-api.js',
  'test-auth-data.js',
  'test-auth.js',
  'test-db-connection.js',
  'test-db.js',
  'test-env-load.js',
  'test-env-vars.js',
  'test-import.js',
  'test-orbcomm-data.js',
  'test-orbcomm-postman.js',
  'test-password-reset.js',
  'test-registration.js',
  'test-server.js',
  'test-simple.js',
  'test-storage.js',
  'test-users.js',
  'test-webhook.js',
  'test-whatsapp-env.js',
  'test-whatsapp-flow.js',
  'test-whatsapp-integration.js',
  'test-whatsapp-simple.js',

  // Check/debug files
  'check-actual-statuses.js',
  'check-admin-users.js',
  'check-all-manuals.js',
  'check-basic-data.js',
  'check-containers.js',
  'check-current-statuses.js',
  'check-db-state.js',
  'check-db-users.js',
  'check-excel-import.js',
  'check-manuals.js',
  'check-schema.js',
  'check-unsold-sale-containers.js',
  'check-user.js',
  'check-users.js',

  // Simple/minimal test files
  'simple-db-check.js',
  'simple-http-test.js',
  'simple-orbcomm-test.js',
  'simple-server.js',
  'simple-test-server.js',
  'minimal-test.js',

  // User/database management scripts (temporary)
  'create-test-user.js',
  'delete-admin-users.js',
  'delete-container-data.js',
  'delete-specific-users.js',
  'find-user.js',
  'insert-manuals-direct.js',
  'insert-test-manual.js',
  'list-users.js',
  'reset-existing-password.js',
  'reset-passwords.js',
  'verify-cleanup.js',
  'verify-update.js',

  // Utility/debug scripts
  'fake-work-progress.js',
  'final-status-check.js',
  'quick-seed.js',
  'seed-manuals-simple.js',
  'seed-rag-manuals.js',

  // Update scripts
  'update-containers-active-to-sold.js',
  'update-containers-to-sold.js',
  'update-database-enum.js',
  'update-excel-metadata-sale-to-sold.js',
  'update-excel-sale-to-sold.js',
  'update-sale-to-sold.js',
  'update-alert-source-enum.js',

  // Population scripts (keep these as they might be useful)
  // 'populate-container-locations.js',
  // 'populate-locations.js',
  // 'add-current-location-migration.sql',
  // 'add-default-locations.js',
  // 'add-locations-sqlite.js',
  // 'add-sale-status.js',
  // 'add-sold-status-to-frontend.js',
];

async function cleanupFiles() {
  console.log('🧹 Starting cleanup of unused/test files...\n');

  let deletedCount = 0;
  let errorCount = 0;

  for (const fileName of filesToDelete) {
    try {
      await fs.unlink(join(process.cwd(), fileName));
      console.log(`✅ Deleted: ${fileName}`);
      deletedCount++;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.log(`❌ Error deleting ${fileName}: ${error.message}`);
        errorCount++;
      } else {
        console.log(`⚠️  Already deleted: ${fileName}`);
      }
    }
  }

  console.log(`\n📊 Cleanup Summary:`);
  console.log(`   ✅ Files deleted: ${deletedCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📁 Total files processed: ${filesToDelete.length}`);

  // List remaining JS files
  console.log('\n📋 Remaining JS files in root directory:');
  try {
    const files = await fs.readdir(process.cwd());
    const jsFiles = files.filter(file => file.endsWith('.js')).sort();

    if (jsFiles.length === 0) {
      console.log('   No JS files remaining');
    } else {
      jsFiles.forEach(file => console.log(`   - ${file}`));
    }
  } catch (error) {
    console.log(`   Error listing files: ${error.message}`);
  }

  console.log('\n🎉 Cleanup completed!');
}

cleanupFiles().catch(console.error);
