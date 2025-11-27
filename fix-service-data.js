import XLSX from 'xlsx';
import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function fixServiceData() {
  console.log('=== FIXING SERVICE DATA ===\n');

  // Read Excel
  const workbook = XLSX.readFile('Serivce Master.xlsx');
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const excelData = XLSX.utils.sheet_to_json(worksheet, { defval: null });
  console.log('Excel records loaded:', excelData.length);

  // 1. FIX NULL WORK_TYPE RECORDS
  console.log('\n=== STEP 1: FIXING NULL WORK_TYPE RECORDS ===');
  
  const nullWorkTypeRecords = await db.execute(sql`
    SELECT job_order_number FROM service_history WHERE work_type IS NULL
  `);
  console.log('Records with NULL work_type:', nullWorkTypeRecords.rows.length);

  let workTypeUpdated = 0;
  for (const dbRecord of nullWorkTypeRecords.rows) {
    const excelMatch = excelData.find(e => e['Job Order No.'] === dbRecord.job_order_number);
    if (excelMatch && excelMatch['Work Type']) {
      await db.execute(sql`
        UPDATE service_history 
        SET work_type = ${excelMatch['Work Type']}, updated_at = NOW()
        WHERE job_order_number = ${dbRecord.job_order_number}
      `);
      workTypeUpdated++;
    }
  }
  console.log('Work types updated:', workTypeUpdated);

  // 2. ADD MISSING CONTAINERS FROM PM RECORDS
  console.log('\n=== STEP 2: ADDING MISSING CONTAINERS FROM PM RECORDS ===');
  
  const missingContainers = await db.execute(sql`
    SELECT DISTINCT sh.container_number, sh.client_name, sh.container_size, sh.machine_make
    FROM service_history sh
    LEFT JOIN containers c ON UPPER(c.container_id) = UPPER(sh.container_number)
    WHERE c.id IS NULL AND sh.container_number IS NOT NULL AND sh.container_number != ''
    AND LENGTH(sh.container_number) <= 15
  `);
  console.log('Missing containers to add:', missingContainers.rows.length);

  let containersAdded = 0;
  for (const mc of missingContainers.rows) {
    if (!mc.container_number || mc.container_number.includes(',')) continue; // Skip multi-container entries
    
    try {
      // Generate a UUID for the container
      const result = await db.execute(sql`
        INSERT INTO containers (id, container_id, size, manufacturer, status, created_at, updated_at)
        VALUES (
          gen_random_uuid(),
          ${mc.container_number.trim().toUpperCase()},
          ${mc.container_size || '40ft'},
          ${mc.machine_make || 'DAIKIN'},
          'active',
          NOW(),
          NOW()
        )
        ON CONFLICT (container_id) DO NOTHING
        RETURNING id
      `);
      if (result.rows.length > 0) {
        containersAdded++;
        console.log('  Added:', mc.container_number);
      }
    } catch (e) {
      console.log('  Skip (error):', mc.container_number, '-', e.message.substring(0, 50));
    }
  }
  console.log('Containers added:', containersAdded);

  // 3. VERIFY PM-CONTAINER LINKAGE AGAIN
  console.log('\n=== STEP 3: VERIFYING PM-CONTAINER LINKAGE ===');
  
  const finalPMLink = await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      COUNT(c.id) as linked,
      COUNT(*) - COUNT(c.id) as unlinked
    FROM service_history sh
    LEFT JOIN containers c ON UPPER(c.container_id) = UPPER(sh.container_number)
    WHERE UPPER(sh.work_type) LIKE '%PREVENTIVE%'
  `);
  
  console.log('PM Records Total:', finalPMLink.rows[0].total);
  console.log('PM Linked to Containers:', finalPMLink.rows[0].linked);
  console.log('PM NOT Linked:', finalPMLink.rows[0].unlinked);

  // 4. FINAL WORK_TYPE DISTRIBUTION
  console.log('\n=== FINAL WORK_TYPE DISTRIBUTION ===');
  const finalWorkTypes = await db.execute(sql`
    SELECT work_type, COUNT(*) as count 
    FROM service_history 
    GROUP BY work_type 
    ORDER BY count DESC
  `);
  finalWorkTypes.rows.forEach(w => console.log('  ', w.work_type || 'NULL', ':', w.count));

  // 5. SHOW PM RECORDS SUMMARY
  console.log('\n=== PM RECORDS SUMMARY ===');
  const pmSummary = await db.execute(sql`
    SELECT 
      sh.container_number,
      sh.job_order_number,
      sh.technician_name,
      sh.client_name,
      sh.complaint_attended_date,
      c.id IS NOT NULL as has_container_link
    FROM service_history sh
    LEFT JOIN containers c ON UPPER(c.container_id) = UPPER(sh.container_number)
    WHERE UPPER(sh.work_type) LIKE '%PREVENTIVE%'
    ORDER BY sh.job_order_number
    LIMIT 30
  `);
  
  console.log('\nSample PM Records (with container link status):');
  console.log('Job Order | Container | Technician | Client | Linked');
  console.log('-'.repeat(90));
  pmSummary.rows.forEach(r => {
    const linked = r.has_container_link ? '✓' : '✗';
    console.log(`${linked} ${r.job_order_number} | ${r.container_number} | ${r.technician_name || 'N/A'} | ${r.client_name}`);
  });

  process.exit(0);
}

fixServiceData();

