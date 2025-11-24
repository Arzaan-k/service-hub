import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function testContainerAPI() {
  console.log('🧪 Testing Container Service History API Logic\n');
  console.log('='.repeat(60));

  // Test with a container that has both main record AND service history
  const testContainer = 'BMOU9782197'; // From our verification, has 10 services

  console.log(`\n📦 Testing Container: ${testContainer}`);
  console.log('-'.repeat(60));

  // 1. Check if container exists in main table
  console.log('\n1️⃣  Checking main containers table...');
  const containerCheck = await db.execute(sql`
    SELECT id, container_id, assigned_client_id
    FROM containers
    WHERE container_id = ${testContainer} OR id::text = ${testContainer}
    LIMIT 1
  `);

  if (containerCheck.rows.length > 0) {
    const container = containerCheck.rows[0];
    console.log(`   ✅ Found in containers table`);
    console.log(`   ID: ${container.id}`);
    console.log(`   Container ID: ${container.container_id}`);
    console.log(`   Client ID: ${container.assigned_client_id || 'None'}`);
  } else {
    console.log(`   ❌ NOT found in containers table`);
  }

  // 2. Check service history
  console.log('\n2️⃣  Checking service_history table...');
  const serviceHistory = await db.execute(sql`
    SELECT
      id,
      job_order_number,
      container_number,
      client_name,
      complaint_attended_date,
      technician_name
    FROM service_history
    WHERE container_number = ${testContainer}
    ORDER BY complaint_attended_date DESC
  `);

  console.log(`   ✅ Found ${serviceHistory.rows.length} service records`);
  if (serviceHistory.rows.length > 0) {
    console.log(`\n   Recent services:`);
    serviceHistory.rows.slice(0, 5).forEach((row: any, index) => {
      console.log(`   ${index + 1}. ${row.job_order_number} - ${row.complaint_attended_date}`);
      console.log(`      Client: ${row.client_name}`);
      console.log(`      Technician: ${row.technician_name || 'N/A'}`);
    });
  }

  // 3. Test with CXRU1043337 (user's reported container)
  console.log('\n\n' + '='.repeat(60));
  const userContainer = 'CXRU1043337';
  console.log(`\n📦 Testing User's Container: ${userContainer}`);
  console.log('-'.repeat(60));

  const userContainerCheck = await db.execute(sql`
    SELECT id, container_id, assigned_client_id
    FROM containers
    WHERE container_id = ${userContainer} OR id::text = ${userContainer}
    LIMIT 1
  `);

  if (userContainerCheck.rows.length > 0) {
    const container = userContainerCheck.rows[0];
    console.log(`\n1️⃣  Main Table:`);
    console.log(`   ✅ Found`);
    console.log(`   ID: ${container.id}`);
    console.log(`   Container ID: ${container.container_id}`);
  } else {
    console.log(`\n1️⃣  Main Table: ❌ NOT found`);
  }

  const userServiceHistory = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM service_history
    WHERE container_number = ${userContainer}
  `);

  console.log(`\n2️⃣  Service History: ✅ ${userServiceHistory.rows[0].count} records`);

  console.log('\n' + '='.repeat(60));
  console.log('✅ API LOGIC TEST COMPLETE\n');
}

testContainerAPI()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
