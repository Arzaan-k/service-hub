import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function test() {
  try {
    // Test PM records query
    const pmRecords = await db.execute(sql`
      SELECT 
        UPPER(TRIM(container_number)) as container_number,
        MAX(complaint_attended_date) as last_pm_date,
        COUNT(*) as pm_count
      FROM service_history
      WHERE UPPER(work_type) LIKE '%PREVENTIVE%'
        AND container_number IS NOT NULL
        AND container_number != ''
      GROUP BY UPPER(TRIM(container_number))
      LIMIT 10
    `);
    
    console.log('PM Records found:', pmRecords.rows.length);
    console.log('Sample PM records:', JSON.stringify(pmRecords.rows.slice(0,3), null, 2));
    
    // Test containers query
    const containers = await db.execute(sql`
      SELECT 
        c.id,
        c.container_id,
        c.status,
        c.depot
      FROM containers c
      WHERE c.status = 'active'
      LIMIT 5
    `);
    console.log('\nActive containers sample:', JSON.stringify(containers.rows, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

test();

