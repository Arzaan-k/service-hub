import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function check() {
  try {
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('=== TABLES IN DATABASE ===');
    tables.rows.forEach(r => console.log('-', r.table_name));
    
    const serviceHistory = await db.execute(sql`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'service_history' 
      ORDER BY ordinal_position
    `);
    
    if (serviceHistory.rows.length > 0) {
      console.log('\n=== SERVICE_HISTORY COLUMNS ===');
      serviceHistory.rows.forEach(r => 
        console.log('-', r.column_name, '(', r.data_type, r.is_nullable === 'NO' ? 'NOT NULL' : '', ')')
      );
      
      // Count existing records
      const count = await db.execute(sql`SELECT COUNT(*) as count FROM service_history`);
      console.log('\n=== EXISTING SERVICE_HISTORY RECORDS ===');
      console.log('Total records:', count.rows[0].count);
    } else {
      console.log('\n*** service_history table does not exist ***');
    }
    
    // Check containers table
    const containers = await db.execute(sql`SELECT COUNT(*) as count FROM containers`);
    console.log('\n=== CONTAINERS ===');
    console.log('Total containers:', containers.rows[0].count);
    
    // Check technicians table
    const technicians = await db.execute(sql`SELECT COUNT(*) as count FROM technicians`);
    console.log('\n=== TECHNICIANS ===');
    console.log('Total technicians:', technicians.rows[0].count);
    
    // List technician columns
    const techCols = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'technicians' 
      ORDER BY ordinal_position
    `);
    console.log('Technician columns:');
    techCols.rows.forEach(c => console.log('  -', c.column_name, '(', c.data_type, ')'));
    
    // List technicians with their actual column
    const techList = await db.execute(sql`SELECT * FROM technicians LIMIT 5`);
    console.log('\nSample technicians:');
    techList.rows.forEach(t => console.log('  -', JSON.stringify(t)));
    
    // Check service_history stats
    console.log('\n=== SERVICE_HISTORY STATS ===');
    
    const workTypes = await db.execute(sql`
      SELECT work_type, COUNT(*) as count 
      FROM service_history 
      GROUP BY work_type 
      ORDER BY count DESC
    `);
    console.log('\nRecords by Work Type:');
    workTypes.rows.forEach(w => console.log('  -', w.work_type || 'NULL', ':', w.count));
    
    const pmRecords = await db.execute(sql`
      SELECT job_order_number, container_number, work_type, technician_name, complaint_attended_date
      FROM service_history 
      WHERE UPPER(work_type) LIKE '%PREVENTIVE%' OR UPPER(work_type) LIKE '%PM%'
      LIMIT 10
    `);
    console.log('\nSample PM Records in DB:');
    pmRecords.rows.forEach(r => console.log('  -', r.job_order_number, '|', r.container_number, '|', r.work_type, '|', r.technician_name));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  process.exit(0);
}

check();

