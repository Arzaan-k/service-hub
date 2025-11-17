import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

console.log('==================================================');
console.log('  Checking WhatsApp Data for Service Requests');
console.log('==================================================\n');

async function checkData() {
  try {
    // Get the most recent service request
    const recentSR = await sql`
      SELECT id, request_number, client_uploaded_photos, client_uploaded_videos, before_photos, videos
      FROM service_requests
      ORDER BY created_at DESC
      LIMIT 5
    `;

    console.log('Recent Service Requests:\n');
    for (const sr of recentSR) {
      console.log(`SR: ${sr.request_number} (${sr.id})`);
      console.log(`  client_uploaded_photos: ${JSON.stringify(sr.client_uploaded_photos)}`);
      console.log(`  client_uploaded_videos: ${JSON.stringify(sr.client_uploaded_videos)}`);
      console.log(`  before_photos: ${JSON.stringify(sr.before_photos)}`);
      console.log(`  videos: ${JSON.stringify(sr.videos)}`);
      console.log('');

      // Check WhatsApp messages for this SR
      const messages = await sql`
        SELECT id, message_type, related_entity_id, message_content
        FROM whatsapp_messages
        WHERE related_entity_type = 'ServiceRequest'
        AND related_entity_id = ${sr.id}
        ORDER BY sent_at DESC
      `;

      console.log(`  WhatsApp Messages: ${messages.length}`);
      for (const msg of messages) {
        const content = typeof msg.message_content === 'string' ? JSON.parse(msg.message_content) : msg.message_content;
        console.log(`    - Type: ${msg.message_type}, Has Image: ${!!(content.image)}, Has Video: ${!!(content.video)}`);
      }
      console.log('---');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

await checkData();
process.exit(0);
