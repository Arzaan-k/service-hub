import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function checkContainers() {
  try {
    const result = await db.execute(sql`
      SELECT
        container_id,
        type,
        has_iot,
        status,
        assigned_client_id
      FROM containers
      LIMIT 20
    `);

    console.log('Sample containers in database:');
    console.log(JSON.stringify(result.rows, null, 2));

    const reeferCount = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM containers
      WHERE type = 'refrigerated'
    `);

    console.log('\nTotal refrigerated containers:', reeferCount.rows[0]);

    const reeferWithIoT = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM containers
      WHERE type = 'refrigerated' AND has_iot = true
    `);

    console.log('Refrigerated with IoT:', reeferWithIoT.rows[0]);

    const reeferDeployed = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM containers
      WHERE type = 'refrigerated' AND status IN ('active', 'in_service')
    `);

    console.log('Refrigerated deployed (active/in_service):', reeferDeployed.rows[0]);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkContainers();
