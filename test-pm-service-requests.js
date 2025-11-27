import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function test() {
  try {
    console.log('Testing PM data from service_requests...\n');

    // Get PM records from service_requests where machine_status = 'Preventive Maintenance'
    const pmRecords = await db.execute(sql`
      SELECT 
        container_id,
        MAX(complaint_registration_time) as last_pm_date,
        COUNT(*) as pm_count
      FROM service_requests
      WHERE LOWER(machine_status) LIKE '%preventive%'
        AND container_id IS NOT NULL
      GROUP BY container_id
      LIMIT 10
    `);
    
    console.log('PM Records found:', pmRecords.rows.length);
    console.log('Sample PM records:', JSON.stringify(pmRecords.rows.slice(0,3), null, 2));

    // Get all active containers
    const containers = await db.execute(sql`
      SELECT 
        c.id,
        c.container_id,
        c.status,
        c.depot,
        c.grade,
        cust.company_name as customer_name
      FROM containers c
      LEFT JOIN customers cust ON c.assigned_client_id = cust.id
      WHERE c.status = 'active'
      LIMIT 10
    `);
    
    console.log('\nActive containers:', containers.rows.length);
    console.log('Sample containers:', JSON.stringify(containers.rows.slice(0,3), null, 2));

    // Create a map of container_id -> PM data
    const pmMap = new Map();
    for (const row of pmRecords.rows) {
      if (row.container_id) {
        pmMap.set(row.container_id, {
          last_pm_date: row.last_pm_date,
          pm_count: parseInt(row.pm_count) || 0
        });
      }
    }
    
    console.log('\nPM Map size:', pmMap.size);
    console.log('PM Map keys (container IDs):', [...pmMap.keys()].slice(0, 5));

    // Check if any container IDs match
    let matchCount = 0;
    for (const container of containers.rows) {
      if (pmMap.has(container.id)) {
        matchCount++;
        console.log('Match found:', container.id, '->', container.container_id);
      }
    }
    console.log('\nMatches found:', matchCount);

  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

test();

