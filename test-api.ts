import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function testAPI() {
  console.log('🧪 Testing Service History API Endpoints...\n');

  const testContainer = 'APRU5000210';

  console.log(`Testing: /api/service-history/container/${testContainer}\n`);

  // Simulate what the API does
  const history = await db.execute(sql`
    SELECT *
    FROM service_history
    WHERE container_number = ${testContainer}
    ORDER BY complaint_attended_date DESC
  `);

  console.log(`✅ Found ${history.rows.length} service records`);

  if (history.rows.length > 0) {
    console.log('\n📋 First Record:');
    const first = history.rows[0] as any;
    console.log(`   Job Order: ${first.job_order_number}`);
    console.log(`   Container: ${first.container_number}`);
    console.log(`   Client: ${first.client_name}`);
    console.log(`   Date: ${first.complaint_attended_date}`);
    console.log(`   Technician: ${first.technician_name || 'N/A'}`);
    console.log(`   Work Type: ${first.work_type || 'N/A'}`);
    console.log(`   Job Type: ${first.job_type || 'N/A'}`);
  }

  // Check timeline endpoint
  console.log(`\n\nTesting: /api/service-history/container/${testContainer}/timeline\n`);

  const timeline = await db.execute(sql`
    SELECT
      job_order_number,
      complaint_attended_date,
      work_type,
      job_type,
      technician_name,
      issues_found,
      work_description,
      required_spare_parts
    FROM service_history
    WHERE container_number = ${testContainer}
    ORDER BY complaint_attended_date ASC
  `);

  console.log(`✅ Found ${timeline.rows.length} timeline records`);

  if (timeline.rows.length > 0) {
    console.log('\n📅 Timeline:');
    timeline.rows.forEach((record: any, index) => {
      console.log(`\n${index + 1}. ${record.job_order_number} - ${record.complaint_attended_date}`);
      console.log(`   Work: ${record.work_type || 'N/A'}`);
      console.log(`   Issues: ${record.issues_found || 'N/A'}`);
    });
  }

  // Now check what containers exist in the main containers table
  console.log('\n\n🔍 Checking Main Containers Table...\n');

  const mainContainers = await db.execute(sql`
    SELECT container_id
    FROM containers
    WHERE container_id LIKE 'APRU%'
    LIMIT 10
  `);

  console.log('Sample Container IDs in Main Table:');
  mainContainers.rows.forEach((row: any, index) => {
    console.log(`${index + 1}. ${row.container_id}`);
  });

  // Check if APRU5000210 exists in main table
  const matchingContainer = await db.execute(sql`
    SELECT container_id, id
    FROM containers
    WHERE container_id = ${testContainer}
  `);

  if (matchingContainer.rows.length > 0) {
    console.log(`\n✅ Container ${testContainer} EXISTS in main containers table`);
    console.log(`   ID: ${(matchingContainer.rows[0] as any).id}`);
  } else {
    console.log(`\n⚠️  Container ${testContainer} NOT FOUND in main containers table`);
    console.log('   This means the container from service history does not exist in your container master data');
  }
}

testAPI()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
