import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

console.log('==================================================');
console.log('  Migrating Existing Client Photos');
console.log('==================================================\n');

async function migrateClientPhotos() {
  try {
    console.log('Finding service requests with photos that need migration...\n');

    // Find service requests that:
    // 1. Have data in before_photos or videos
    // 2. Don't have data in client_uploaded_photos/videos yet
    // 3. Status is 'pending' (haven't been started by technician)
    const requests = await sql`
      SELECT id, request_number, before_photos, videos, status
      FROM service_requests
      WHERE status = 'pending'
      AND (
        (before_photos IS NOT NULL AND array_length(before_photos, 1) > 0)
        OR (videos IS NOT NULL AND array_length(videos, 1) > 0)
      )
      AND (client_uploaded_photos IS NULL OR array_length(client_uploaded_photos, 1) IS NULL)
    `;

    if (requests.length === 0) {
      console.log('  ℹ️  No service requests need migration.');
      return;
    }

    console.log(`  Found ${requests.length} service request(s) to migrate:\n`);

    for (const req of requests) {
      console.log(`  📝 ${req.request_number}:`);
      console.log(`     - Photos: ${req.before_photos?.length || 0}`);
      console.log(`     - Videos: ${req.videos?.length || 0}`);

      // Move before_photos to client_uploaded_photos and clear before_photos
      // Move videos to client_uploaded_videos and clear videos
      await sql`
        UPDATE service_requests
        SET
          client_uploaded_photos = ${req.before_photos || []},
          client_uploaded_videos = ${req.videos || []},
          before_photos = ARRAY[]::text[],
          videos = ARRAY[]::text[]
        WHERE id = ${req.id}
      `;

      console.log(`     ✅ Migrated to client_uploaded fields\n`);
    }

    console.log(`\n✅ Successfully migrated ${requests.length} service request(s)!`);
  } catch (error) {
    console.error('  ❌ Error during migration:', error.message);
    throw error;
  }
}

try {
  await migrateClientPhotos();
  console.log('\n✅ Migration completed successfully!');
} catch (error) {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
}

console.log('\n==================================================');
process.exit(0);
