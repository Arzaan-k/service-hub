import 'dotenv/config';
import XLSX from 'xlsx';
import { db } from './server/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

interface ServiceMasterRow {
  [key: string]: any;
}

async function importServiceMaster() {
  console.log('🚀 Starting comprehensive Service Master import...\n');

  const excelPath = path.join(process.cwd(), 'Serivce Master.xlsx');

  if (!fs.existsSync(excelPath)) {
    console.error(`❌ File not found: ${excelPath}`);
    process.exit(1);
  }

  try {
    // Read Excel file
    console.log('📖 Reading Excel file...');
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: ServiceMasterRow[] = XLSX.utils.sheet_to_json(worksheet, { defval: null });

    console.log(`✅ Found ${data.length} rows in sheet "${sheetName}"\n`);

    if (data.length === 0) {
      console.error('❌ No data found in Excel file');
      process.exit(1);
    }

    // Show all column names
    const columns = Object.keys(data[0]);
    console.log(`📊 Columns found (${columns.length} total):`);
    columns.forEach((col, i) => console.log(`  ${i + 1}. ${col}`));
    console.log('');

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      try {
        // Helper function to safely get cell value
        const getValue = (row: any, ...possibleKeys: string[]) => {
          for (const key of possibleKeys) {
            if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
              return row[key];
            }
          }
          return null;
        };

        // Helper to parse numbers
        const parseNumber = (val: any) => {
          if (val === null || val === undefined || val === '') return null;
          const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
          return isNaN(num) ? null : num;
        };

        // Helper to parse dates
        const parseDate = (val: any) => {
          if (!val) return null;
          try {
            // If it's an Excel date number
            if (typeof val === 'number') {
              const date = XLSX.SSF.parse_date_code(val);
              return new Date(date.y, date.m - 1, date.d).toISOString();
            }
            // If it's a string
            const parsed = new Date(val);
            return isNaN(parsed.getTime()) ? null : parsed.toISOString();
          } catch (e) {
            return null;
          }
        };

        // Extract container number - primary key
        const containerNo = getValue(
          row,
          'Container No',
          'Container No.',
          'container_no',
          'CONTAINER NO',
          'Container Number'
        );

        if (!containerNo || containerNo.toString().trim() === '') {
          console.log(`⏭️  Row ${i + 1}: Skipping - no container number`);
          skipped++;
          continue;
        }

        const containerNoStr = containerNo.toString().trim();

        // Extract all service-related fields
        const srNo = parseNumber(getValue(row, 'Sr. No.', 'Sr. No', 'sr_no', 'Serial Number'));
        const serviceDate = parseDate(getValue(row, 'Service Date', 'service_date', 'Date', 'SERVICE DATE'));
        const serviceType = getValue(row, 'Service Type', 'service_type', 'Type', 'SERVICE TYPE');
        const technicianName = getValue(row, 'Technician Name', 'technician_name', 'Technician', 'TECHNICIAN');
        const technicianId = getValue(row, 'Technician ID', 'technician_id', 'Tech ID');
        const serviceLocation = getValue(row, 'Service Location', 'service_location', 'Location', 'LOCATION');
        const depot = getValue(row, 'Depot', 'depot', 'DEPOT');
        const issueReported = getValue(row, 'Issue Reported', 'issue_reported', 'Issue', 'ISSUE');
        const workPerformed = getValue(row, 'Work Performed', 'work_performed', 'Work', 'WORK');
        const partsReplaced = getValue(row, 'Parts Replaced', 'parts_replaced', 'Parts', 'PARTS');
        const partsCost = parseNumber(getValue(row, 'Parts Cost', 'parts_cost', 'Cost', 'COST'));
        const laborCost = parseNumber(getValue(row, 'Labor Cost', 'labor_cost', 'Labor', 'LABOR'));
        const totalCost = parseNumber(getValue(row, 'Total Cost', 'total_cost', 'Total', 'TOTAL'));
        const serviceStatus = getValue(row, 'Service Status', 'service_status', 'Status', 'STATUS');
        const priority = getValue(row, 'Priority', 'priority', 'PRIORITY');
        const startTime = getValue(row, 'Start Time', 'start_time', 'START TIME');
        const endTime = getValue(row, 'End Time', 'end_time', 'END TIME');
        const duration = parseNumber(getValue(row, 'Duration (hours)', 'Duration', 'duration', 'DURATION'));
        const customerName = getValue(row, 'Customer Name', 'customer_name', 'Customer', 'CUSTOMER');
        const customerContact = getValue(row, 'Customer Contact', 'customer_contact', 'Contact', 'CONTACT');
        const remarks = getValue(row, 'Remarks', 'remarks', 'REMARKS', 'Notes', 'NOTES');
        const nextServiceDue = parseDate(getValue(row, 'Next Service Due', 'next_service_due', 'Next Service', 'NEXT SERVICE'));
        const warrantyStatus = getValue(row, 'Warranty Status', 'warranty_status', 'Warranty', 'WARRANTY');
        const approvedBy = getValue(row, 'Approved By', 'approved_by', 'Approver', 'APPROVER');
        const invoiceNumber = getValue(row, 'Invoice Number', 'invoice_number', 'Invoice No', 'INVOICE');
        const paymentStatus = getValue(row, 'Payment Status', 'payment_status', 'Payment', 'PAYMENT');
        const rating = parseNumber(getValue(row, 'Rating', 'rating', 'RATING'));
        const feedback = getValue(row, 'Feedback', 'feedback', 'FEEDBACK');

        // Additional fields that might exist
        const serviceCategory = getValue(row, 'Service Category', 'service_category', 'Category');
        const scheduledDate = parseDate(getValue(row, 'Scheduled Date', 'scheduled_date'));
        const completedDate = parseDate(getValue(row, 'Completed Date', 'completed_date', 'Completion Date'));
        const temperatureBefore = parseNumber(getValue(row, 'Temperature Before', 'temperature_before', 'Temp Before'));
        const temperatureAfter = parseNumber(getValue(row, 'Temperature After', 'temperature_after', 'Temp After'));
        const mileage = parseNumber(getValue(row, 'Mileage', 'mileage', 'MILEAGE'));
        const fuelLevel = getValue(row, 'Fuel Level', 'fuel_level', 'Fuel');
        const odometerReading = parseNumber(getValue(row, 'Odometer Reading', 'odometer_reading', 'Odometer'));

        // Store complete row data as JSON for reference
        const serviceData = JSON.stringify(row);

        // Check if container exists
        const existingContainer = await db.execute(sql`
          SELECT id FROM containers WHERE container_id = ${containerNoStr} LIMIT 1
        `);

        if (!existingContainer.rows || existingContainer.rows.length === 0) {
          console.log(`⚠️  Row ${i + 1}: Container ${containerNoStr} not found in database, skipping`);
          skipped++;
          continue;
        }

        // Generate unique job order number
        const jobOrderNo = `JOB-${containerNoStr}-${Date.now()}`;

        // Insert into service_history table
        await db.execute(sql`
          INSERT INTO service_history (
            job_order_number,
            container_number,
            client_name,
            complaint_attended_date,
            service_date,
            service_type,
            technician_name,
            technician_id,
            service_location,
            depot,
            issue_reported,
            work_performed,
            parts_replaced,
            parts_cost,
            labor_cost,
            total_cost,
            service_status,
            priority,
            start_time,
            end_time,
            duration_hours,
            customer_name,
            customer_contact,
            remarks,
            next_service_due,
            warranty_status,
            approved_by,
            invoice_number,
            payment_status,
            rating,
            feedback,
            service_category,
            scheduled_date,
            completed_date,
            temperature_before,
            temperature_after,
            mileage,
            fuel_level,
            odometer_reading,
            service_data,
            created_at,
            updated_at
          ) VALUES (
            ${containerNoStr},
            ${serviceDate},
            ${serviceType},
            ${technicianName},
            ${technicianId},
            ${serviceLocation},
            ${depot},
            ${issueReported},
            ${workPerformed},
            ${partsReplaced},
            ${partsCost},
            ${laborCost},
            ${totalCost},
            ${serviceStatus},
            ${priority},
            ${startTime},
            ${endTime},
            ${duration},
            ${customerName},
            ${customerContact},
            ${remarks},
            ${nextServiceDue},
            ${warrantyStatus},
            ${approvedBy},
            ${invoiceNumber},
            ${paymentStatus},
            ${rating},
            ${feedback},
            ${serviceCategory},
            ${scheduledDate},
            ${completedDate},
            ${temperatureBefore},
            ${temperatureAfter},
            ${mileage},
            ${fuelLevel},
            ${odometerReading},
            ${serviceData}::jsonb,
            NOW(),
            NOW()
          )
        `);

        imported++;
        if (imported % 50 === 0) {
          console.log(`✅ Imported ${imported} service records...`);
        }

      } catch (error: any) {
        console.error(`❌ Error processing row ${i + 1}:`, error.message);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Service records imported: ${imported}`);
    console.log(`⏭️  Rows skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📦 Total processed: ${imported + skipped}`);
    console.log('='.repeat(60));

    // Verify data in database
    console.log('\n🔍 Verifying import...');
    const verifyResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM service_history
    `);
    console.log(`✅ Total service records in database: ${verifyResult.rows[0].count}`);

    // Show records per container
    const containerStats = await db.execute(sql`
      SELECT
        container_id,
        COUNT(*) as service_count
      FROM service_history
      GROUP BY container_id
      ORDER BY service_count DESC
      LIMIT 10
    `);

    console.log('\n📈 Top 10 containers by service records:');
    containerStats.rows.forEach((row: any) => {
      console.log(`  ${row.container_id}: ${row.service_count} services`);
    });

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }

  process.exit(0);
}

importServiceMaster();
