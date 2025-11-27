import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function test() {
  try {
    // Check service_requests table for PM records
    const pmRecords = await db.execute(sql`
      SELECT 
        container_id,
        machine_status,
        complaint_registration_time,
        status
      FROM service_requests
      WHERE LOWER(machine_status) LIKE '%preventive%'
      LIMIT 10
    `);
    
    console.log('PM Records in service_requests:', pmRecords.rows.length);
    console.log('Sample:', JSON.stringify(pmRecords.rows.slice(0,5), null, 2));
    
    // Get column names
    const cols = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'service_requests' 
      ORDER BY ordinal_position
    `);
    console.log('\nservice_requests columns:', cols.rows.map(r => r.column_name).join(', '));
    
    // Count total PM records
    const count = await db.execute(sql`
      SELECT COUNT(*) as count FROM service_requests
      WHERE LOWER(machine_status) LIKE '%preventive%'
    `);
    console.log('\nTotal PM records:', count.rows[0].count);
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

test();

