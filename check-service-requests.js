import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

console.log('Checking service requests and containers data...\n');

async function checkData() {
  try {
    // Check service requests
    const serviceRequestsCount = await sql`SELECT COUNT(*) as count FROM service_requests`;
    console.log('Service requests count:', serviceRequestsCount[0].count);

    // Check containers
    const containersCount = await sql`SELECT COUNT(*) as count FROM containers`;
    console.log('Containers count:', containersCount[0].count);

    if (serviceRequestsCount[0].count > 0) {
      const sampleRequests = await sql`
        SELECT id, request_number, container_id, status, priority, issue_description
        FROM service_requests
        LIMIT 5
      `;
      console.log('\nSample service requests:');
      console.log(JSON.stringify(sampleRequests, null, 2));

      // Check if container_ids exist in containers table
      const containerIds = sampleRequests.map(r => r.container_id).filter(id => id);
      if (containerIds.length > 0) {
        console.log('\nChecking container IDs:', containerIds);
        const matchingContainers = await sql`
          SELECT id, container_id
          FROM containers
          WHERE id = ANY(${containerIds})
        `;
        console.log('Matching containers in containers table:', matchingContainers.length);
        console.log(JSON.stringify(matchingContainers, null, 2));
      }
    } else {
      console.log('No service requests found in database');
    }

    // Sample containers
    const sampleContainers = await sql`
      SELECT id, container_id
      FROM containers
      LIMIT 3
    `;
    console.log('\nSample containers:');
    console.log(JSON.stringify(sampleContainers, null, 2));

  } catch (error) {
    console.error('Error:', error);
  }
}

checkData();
