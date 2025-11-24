import XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function importServiceMasterData() {
    console.log('🚀 Starting Service Master data import...');

    const filePath = path.join(__dirname, 'Serivce Master.xlsx');

    if (!fs.existsSync(filePath)) {
        console.error('❌ File not found:', filePath);
        return;
    }

    try {
        // Read Excel file
        console.log('📖 Reading Excel file...');
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (rawData.length < 2) {
            console.error('❌ No data found in Excel file');
            return;
        }

        const headers = rawData[0];
        const dataRows = rawData.slice(1);

        console.log(`📊 Found ${dataRows.length} rows to process`);
        console.log(`📋 Headers: ${headers.length} columns`);

        // Map column indices
        const colMap = {
            jobOrderNo: headers.indexOf('Job Order No.'),
            timestamp: headers.indexOf('Timestamp'),
            clientName: headers.indexOf('Client Name'),
            containerNumber: headers.indexOf('Container Number'),
            containerNo: headers.indexOf('Container No'),
            complaint: headers.indexOf('What\'s the complaint?'),
            machineStatus: headers.indexOf('Machine Status'),
            workType: headers.indexOf('Work Type'),
            serviceType: headers.indexOf('Service Type'),
            technicianName: headers.indexOf('Technician Name'),
            issueFound: headers.indexOf('Issue(s) found'),
            remedialAction: headers.indexOf('Remedial Action'),
            sparesRequired: headers.indexOf('List of Spares Required'),
            workDescription: headers.indexOf('Work Description/Technician Comments'),
            complaintAttendedDate: headers.indexOf('Complaint Attended Date'),
            reeferMake: headers.indexOf('Reefer Make & Model'),
            containerSize: headers.indexOf('Container Size'),
            observations: headers.indexOf('Observations'),
        };

        console.log('📍 Column mapping:', colMap);

        let imported = 0;
        let skipped = 0;
        let errors = 0;

        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];

            try {
                // Get container number from either column
                const containerNumber = row[colMap.containerNumber] || row[colMap.containerNo];

                if (!containerNumber) {
                    skipped++;
                    continue;
                }

                const jobOrderNo = row[colMap.jobOrderNo];

                if (!jobOrderNo) {
                    skipped++;
                    continue;
                }

                // Find container by container_code (snake_case)
                const containerResult = await db.execute(
                    sql.raw(`SELECT id, container_code FROM containers WHERE container_code = '${containerNumber.toString().trim()}' LIMIT 1`)
                );

                if (!containerResult || containerResult.length === 0) {
                    console.log(`⚠️  Row ${i + 2}: Container not found: ${containerNumber}`);
                    skipped++;
                    continue;
                }

                const container: any = Array.isArray(containerResult) ? containerResult[0] : containerResult.rows[0];
                const containerId = container.id;

                // Parse timestamp
                let serviceDate = new Date();
                if (row[colMap.complaintAttendedDate]) {
                    const excelDate = row[colMap.complaintAttendedDate];
                    if (typeof excelDate === 'number') {
                        serviceDate = new Date((excelDate - 25569) * 86400 * 1000);
                    } else {
                        serviceDate = new Date(excelDate);
                    }
                }

                // Create service request
                const requestNumber = `SR-${jobOrderNo}`;
                const issueDescription = [
                    row[colMap.complaint],
                    row[colMap.issueFound],
                    row[colMap.observations]
                ].filter(Boolean).join('\n');

                const workPerformed = [
                    row[colMap.remedialAction],
                    row[colMap.workDescription]
                ].filter(Boolean).join('\n');

                // Check if service request already exists
                const existingRequest = await db.execute(
                    sql.raw(`SELECT id FROM service_requests WHERE request_number = '${requestNumber}' LIMIT 1`)
                );

                if (existingRequest && existingRequest.length > 0) {
                    skipped++;
                    continue;
                }

                // Get customer ID from container
                const customerResult = await db.execute(
                    sql.raw(`SELECT current_customer_id FROM containers WHERE id = '${containerId}'`)
                );

                const customerData: any = Array.isArray(customerResult) ? customerResult[0] : customerResult.rows[0];
                const customerId = customerData?.current_customer_id;

                // Insert service request
                await db.execute(
                    sql.raw(`
            INSERT INTO service_requests (
              request_number,
              job_order,
              container_id,
              customer_id,
              priority,
              status,
              issue_description,
              requested_at,
              created_at,
              created_by
            ) VALUES (
              '${requestNumber}',
              '${jobOrderNo}',
              '${containerId}',
              ${customerId ? `'${customerId}'` : 'NULL'},
              'medium',
              'completed',
              '${(issueDescription || 'Service performed').replace(/'/g, "''")}',
              '${serviceDate.toISOString()}',
              NOW(),
              'system-import'
            )
          `)
                );

                // Get the service request ID
                const serviceRequestResult = await db.execute(
                    sql.raw(`SELECT id FROM service_requests WHERE request_number = '${requestNumber}'`)
                );

                const serviceRequestData: any = Array.isArray(serviceRequestResult) ? serviceRequestResult[0] : serviceRequestResult.rows[0];
                const serviceRequestId = serviceRequestData.id;

                // Create service history entry
                await db.execute(
                    sql.raw(`
            INSERT INTO service_history (
              service_request_id,
              container_id,
              service_date,
              technician_name,
              service_type,
              work_performed,
              spares_used,
              status,
              created_at
            ) VALUES (
              '${serviceRequestId}',
              '${containerId}',
              '${serviceDate.toISOString()}',
              '${(row[colMap.technicianName] || 'Unknown').replace(/'/g, "''")}',
              '${(row[colMap.serviceType] || row[colMap.workType] || 'General Service').replace(/'/g, "''")}',
              '${(workPerformed || 'Service completed').replace(/'/g, "''")}',
              ${row[colMap.sparesRequired] ? `'${row[colMap.sparesRequired].replace(/'/g, "''")}'` : 'NULL'},
              'completed',
              NOW()
            )
          `)
                );

                console.log(`✅ Row ${i + 2}: Imported ${requestNumber} for container ${containerNumber}`);
                imported++;

            } catch (error) {
                console.error(`❌ Row ${i + 2}: Error -`, error);
                errors++;
            }
        }

        console.log('\n📊 Import Summary:');
        console.log(`✅ Successfully imported: ${imported}`);
        console.log(`⏭️  Skipped: ${skipped}`);
        console.log(`❌ Errors: ${errors}`);
        console.log(`📝 Total rows processed: ${dataRows.length}`);

    } catch (error) {
        console.error('❌ Fatal error during import:', error);
        throw error;
    }
}

// Run the import
importServiceMasterData()
    .then(() => {
        console.log('✅ Import completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Import failed:', error);
        process.exit(1);
    });
