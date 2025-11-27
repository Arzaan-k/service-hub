import XLSX from 'xlsx';
import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function verifyPMContainerLink() {
  console.log('=== PM-CONTAINER RELATIONSHIP VERIFICATION ===\n');

  // Read Excel
  const workbook = XLSX.readFile('Serivce Master.xlsx');
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const excelData = XLSX.utils.sheet_to_json(worksheet, { defval: null });

  // Get PM records from Excel
  const excelPMRecords = excelData.filter(r => 
    (r['Work Type'] || '').toUpperCase().includes('PREVENTIVE')
  );
  console.log('PM Records in Excel:', excelPMRecords.length);

  // Get PM records from DB
  const dbPMRecords = await db.execute(sql`
    SELECT job_order_number, container_number, work_type, technician_name, complaint_attended_date, client_name
    FROM service_history 
    WHERE UPPER(work_type) LIKE '%PREVENTIVE%'
    ORDER BY job_order_number
  `);
  console.log('PM Records in DB:', dbPMRecords.rows.length);

  // Check for missing PM records
  console.log('\n=== CHECKING FOR MISSING PM RECORDS ===');
  const dbJobOrders = new Set(dbPMRecords.rows.map(r => r.job_order_number));
  const missingPM = excelPMRecords.filter(r => !dbJobOrders.has(r['Job Order No.']));
  console.log('Missing PM records in DB:', missingPM.length);
  if (missingPM.length > 0) {
    console.log('Missing PM Job Orders:');
    missingPM.forEach(r => console.log('  -', r['Job Order No.'], '|', r['Container No'] || r['Container Number']));
  }

  // Check container linkage
  console.log('\n=== PM RECORDS WITH CONTAINER LINKAGE ===');
  const pmWithContainers = await db.execute(sql`
    SELECT 
      sh.job_order_number,
      sh.container_number,
      sh.work_type,
      sh.technician_name,
      sh.client_name,
      sh.complaint_attended_date,
      c.id as container_id
    FROM service_history sh
    LEFT JOIN containers c ON UPPER(c.container_id) = UPPER(sh.container_number)
    WHERE UPPER(sh.work_type) LIKE '%PREVENTIVE%'
    ORDER BY sh.job_order_number
    LIMIT 20
  `);
  
  let linkedCount = 0;
  let unlinkedCount = 0;
  console.log('\nJob Order | Container | DB Container ID | Client');
  console.log('-'.repeat(80));
  pmWithContainers.rows.forEach(r => {
    const linked = r.container_id ? '✓' : '✗';
    if (r.container_id) linkedCount++;
    else unlinkedCount++;
    console.log(`${linked} ${r.job_order_number} | ${r.container_number} | ${r.container_id || 'NOT FOUND'} | ${r.client_name}`);
  });

  // Summary
  const fullPMContainerLink = await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      COUNT(c.id) as linked,
      COUNT(*) - COUNT(c.id) as unlinked
    FROM service_history sh
    LEFT JOIN containers c ON UPPER(c.container_id) = UPPER(sh.container_number)
    WHERE UPPER(sh.work_type) LIKE '%PREVENTIVE%'
  `);
  
  console.log('\n=== PM-CONTAINER LINKAGE SUMMARY ===');
  console.log('Total PM Records:', fullPMContainerLink.rows[0].total);
  console.log('Linked to Containers:', fullPMContainerLink.rows[0].linked);
  console.log('NOT Linked (container not in DB):', fullPMContainerLink.rows[0].unlinked);

  // Show which containers have PM records
  console.log('\n=== CONTAINERS WITH MOST PM SERVICES ===');
  const containerPMCount = await db.execute(sql`
    SELECT 
      sh.container_number,
      c.container_id as db_container_id,
      COUNT(*) as pm_count,
      STRING_AGG(sh.job_order_number, ', ') as job_orders
    FROM service_history sh
    LEFT JOIN containers c ON UPPER(c.container_id) = UPPER(sh.container_number)
    WHERE UPPER(sh.work_type) LIKE '%PREVENTIVE%'
    GROUP BY sh.container_number, c.container_id
    ORDER BY pm_count DESC
    LIMIT 15
  `);
  
  containerPMCount.rows.forEach(r => {
    const status = r.db_container_id ? '✓' : '✗';
    console.log(`${status} ${r.container_number}: ${r.pm_count} PM services (${r.job_orders})`);
  });

  // Check for NULL work_type records that might be PM
  console.log('\n=== CHECKING NULL WORK_TYPE RECORDS ===');
  const nullWorkType = await db.execute(sql`
    SELECT COUNT(*) as count FROM service_history WHERE work_type IS NULL
  `);
  console.log('Records with NULL work_type:', nullWorkType.rows[0].count);

  // Try to match NULL work_type records with Excel to fill in
  console.log('\n=== RECORDS NEEDING WORK_TYPE UPDATE ===');
  const needsUpdate = await db.execute(sql`
    SELECT job_order_number, container_number, client_name
    FROM service_history 
    WHERE work_type IS NULL
    LIMIT 10
  `);
  
  for (const dbRecord of needsUpdate.rows) {
    const excelMatch = excelData.find(e => e['Job Order No.'] === dbRecord.job_order_number);
    if (excelMatch && excelMatch['Work Type']) {
      console.log(`  ${dbRecord.job_order_number}: Should be "${excelMatch['Work Type']}"`);
    }
  }

  process.exit(0);
}

verifyPMContainerLink();

