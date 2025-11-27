import XLSX from 'xlsx';
import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function syncServiceMaster() {
  console.log('=== SYNCING SERVICE MASTER DATA ===\n');

  // Read Excel
  const workbook = XLSX.readFile('Serivce Master.xlsx');
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const excelData = XLSX.utils.sheet_to_json(worksheet, { defval: null });
  console.log('Excel records loaded:', excelData.length);

  // Get all existing service history records
  const existingRecords = await db.execute(sql`
    SELECT job_order_number, work_type, technician_name, container_number 
    FROM service_history
  `);
  console.log('Existing DB records:', existingRecords.rows.length);

  // Create lookup map
  const dbRecordsMap = new Map();
  existingRecords.rows.forEach(r => {
    dbRecordsMap.set(r.job_order_number, r);
  });

  // STEP 1: Update missing work_type values
  console.log('\n=== STEP 1: UPDATING MISSING WORK_TYPE VALUES ===');
  let workTypeUpdated = 0;
  let technicianUpdated = 0;

  for (const excelRow of excelData) {
    const jobOrderNo = excelRow['Job Order No.'];
    if (!jobOrderNo) continue;

    const dbRecord = dbRecordsMap.get(jobOrderNo);
    if (!dbRecord) continue;

    const updates = [];
    const values = {};

    // Check work_type
    if (!dbRecord.work_type && excelRow['Work Type']) {
      updates.push('work_type');
      values.workType = excelRow['Work Type'];
    }

    // Check technician_name
    if (!dbRecord.technician_name && excelRow['Technician Name']) {
      updates.push('technician_name');
      values.technicianName = excelRow['Technician Name'];
    }

    if (updates.length > 0) {
      try {
        if (values.workType && values.technicianName) {
          await db.execute(sql`
            UPDATE service_history 
            SET work_type = ${values.workType}, 
                technician_name = ${values.technicianName},
                updated_at = NOW()
            WHERE job_order_number = ${jobOrderNo}
          `);
          workTypeUpdated++;
          technicianUpdated++;
        } else if (values.workType) {
          await db.execute(sql`
            UPDATE service_history 
            SET work_type = ${values.workType}, updated_at = NOW()
            WHERE job_order_number = ${jobOrderNo}
          `);
          workTypeUpdated++;
        } else if (values.technicianName) {
          await db.execute(sql`
            UPDATE service_history 
            SET technician_name = ${values.technicianName}, updated_at = NOW()
            WHERE job_order_number = ${jobOrderNo}
          `);
          technicianUpdated++;
        }
      } catch (e) {
        console.log('  Error updating', jobOrderNo, ':', e.message.substring(0, 50));
      }
    }
  }
  console.log('Work types updated:', workTypeUpdated);
  console.log('Technician names updated:', technicianUpdated);

  // STEP 2: Add missing service records from Excel
  console.log('\n=== STEP 2: ADDING MISSING SERVICE RECORDS ===');
  
  const existingJobOrders = new Set(dbRecordsMap.keys());
  const missingRecords = excelData.filter(r => r['Job Order No.'] && !existingJobOrders.has(r['Job Order No.']));
  console.log('Missing records to add:', missingRecords.length);

  let recordsAdded = 0;
  for (const row of missingRecords) {
    const jobOrderNo = row['Job Order No.'];
    const containerNumber = row['Container No'] || row['Container Number'] || row['Container No_1'] || row['Container Number_1'];
    const clientName = row['Client Name'] || row['Client Name_1'] || row['Client Name_3'] || 'Unknown';

    if (!containerNumber) {
      console.log('  Skip (no container):', jobOrderNo);
      continue;
    }

    try {
      // Parse date
      let complaintDate = null;
      const dateVal = row['Complaint Attended Date'] || row['Timestamp_5'];
      if (dateVal) {
        if (typeof dateVal === 'number') {
          const d = XLSX.SSF.parse_date_code(dateVal);
          complaintDate = new Date(d.y, d.m - 1, d.d);
        } else {
          complaintDate = new Date(dateVal);
        }
      }

      await db.execute(sql`
        INSERT INTO service_history (
          id, job_order_number, container_number, client_name, work_type, job_type,
          technician_name, issues_found, remedial_action, complaint_attended_date,
          service_type, call_attended_type, observations, work_description,
          raw_excel_data, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          ${jobOrderNo},
          ${containerNumber.toString().trim()},
          ${clientName},
          ${row['Work Type'] || null},
          ${row['Job Type'] || null},
          ${row['Technician Name'] || row['Technician Name_1'] || null},
          ${row['Issue(s) found'] || null},
          ${row['Remedial Action'] || null},
          ${complaintDate},
          ${row['Service Type'] || null},
          ${row['Call Attended Type'] || null},
          ${row['Observations'] || null},
          ${row['Work Description/Technician Comments'] || null},
          ${JSON.stringify(row)}::jsonb,
          NOW(),
          NOW()
        )
      `);
      recordsAdded++;
      if (recordsAdded % 50 === 0) {
        console.log('  Added', recordsAdded, 'records...');
      }
    } catch (e) {
      console.log('  Error adding', jobOrderNo, ':', e.message.substring(0, 80));
    }
  }
  console.log('Records added:', recordsAdded);

  // STEP 3: Add missing containers (UNIQUE only)
  console.log('\n=== STEP 3: ADDING MISSING CONTAINERS (UNIQUE ONLY) ===');

  // Get all existing containers
  const existingContainers = await db.execute(sql`
    SELECT UPPER(container_id) as container_id FROM containers
  `);
  const existingContainerSet = new Set(existingContainers.rows.map(c => c.container_id));
  console.log('Existing containers in DB:', existingContainerSet.size);

  // Get unique containers from service_history that don't exist
  const missingContainerQuery = await db.execute(sql`
    SELECT DISTINCT UPPER(TRIM(container_number)) as container_number
    FROM service_history
    WHERE container_number IS NOT NULL 
      AND container_number != ''
      AND LENGTH(TRIM(container_number)) BETWEEN 10 AND 12
      AND container_number !~ '[^A-Za-z0-9]'
  `);

  const containersToAdd = missingContainerQuery.rows.filter(c => 
    !existingContainerSet.has(c.container_number) &&
    c.container_number.match(/^[A-Z]{4}[0-9]{7}$/) // Standard container format
  );
  console.log('Valid containers to add:', containersToAdd.length);

  let containersAdded = 0;
  for (const c of containersToAdd) {
    try {
      await db.execute(sql`
        INSERT INTO containers (id, container_id, type, status, created_at, updated_at)
        VALUES (
          gen_random_uuid(),
          ${c.container_number},
          'reefer',
          'active',
          NOW(),
          NOW()
        )
        ON CONFLICT (container_id) DO NOTHING
      `);
      containersAdded++;
      console.log('  Added container:', c.container_number);
    } catch (e) {
      console.log('  Error adding container', c.container_number, ':', e.message.substring(0, 50));
    }
  }
  console.log('Containers added:', containersAdded);

  // FINAL VERIFICATION
  console.log('\n=== FINAL VERIFICATION ===');

  const finalStats = await db.execute(sql`
    SELECT 
      (SELECT COUNT(*) FROM service_history) as total_service_records,
      (SELECT COUNT(*) FROM service_history WHERE work_type IS NOT NULL) as with_work_type,
      (SELECT COUNT(*) FROM service_history WHERE work_type IS NULL) as without_work_type,
      (SELECT COUNT(*) FROM service_history WHERE UPPER(work_type) LIKE '%PREVENTIVE%') as pm_records,
      (SELECT COUNT(*) FROM containers) as total_containers
  `);

  const stats = finalStats.rows[0];
  console.log('\nService History Records:', stats.total_service_records);
  console.log('  - With work_type:', stats.with_work_type);
  console.log('  - Without work_type:', stats.without_work_type);
  console.log('  - PM Records:', stats.pm_records);
  console.log('Total Containers:', stats.total_containers);

  // Work type distribution
  console.log('\n=== WORK TYPE DISTRIBUTION ===');
  const workTypes = await db.execute(sql`
    SELECT work_type, COUNT(*) as count 
    FROM service_history 
    WHERE work_type IS NOT NULL
    GROUP BY work_type 
    ORDER BY count DESC
  `);
  workTypes.rows.forEach(w => console.log('  ', w.work_type, ':', w.count));

  // PM-Container linkage
  console.log('\n=== PM-CONTAINER LINKAGE ===');
  const pmLink = await db.execute(sql`
    SELECT 
      COUNT(*) as total_pm,
      COUNT(c.id) as linked_to_container
    FROM service_history sh
    LEFT JOIN containers c ON UPPER(c.container_id) = UPPER(TRIM(sh.container_number))
    WHERE UPPER(sh.work_type) LIKE '%PREVENTIVE%'
  `);
  console.log('Total PM Records:', pmLink.rows[0].total_pm);
  console.log('Linked to Containers:', pmLink.rows[0].linked_to_container);

  process.exit(0);
}

syncServiceMaster();

