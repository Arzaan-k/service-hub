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
  console.log('🚀 Starting Service Master import...\n');

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

    let imported = 0;
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

        // Extract container number
        const containerNumber = getValue(
          row,
          'Container No',
          'Container Number',
          'Container Number_1',
          'Container No_1',
          'container_no'
        );

        if (!containerNumber || containerNumber.toString().trim() === '') {
          skipped++;
          continue;
        }

        const containerNoStr = containerNumber.toString().trim();

        // Check if container exists
        const existingContainer = await db.execute(sql`
          SELECT id FROM containers WHERE container_id = ${containerNoStr} LIMIT 1
        `);

        if (!existingContainer.rows || existingContainer.rows.length === 0) {
          skipped++;
          continue;
        }

        // Generate unique job order number
        const jobOrderNumber = getValue(row, 'Job Order No.', 'Job Order No')
          || `JOB-${containerNoStr}-${Date.now()}-${i}`;

        // Extract all fields mapping to service_history schema
        const clientName = getValue(row, 'Client Name', 'Client Name_1', 'Client Name_2', 'Client Name_3') || 'Unknown';

        // Dates
        const complaintRegistrationTime = parseDate(getValue(row, 'Timestamp'));
        const assignmentTime = parseDate(getValue(row, 'Timestamp_1'));
        const complaintAttendedDate = parseDate(getValue(row, 'Complaint Attended Date'))
          || parseDate(getValue(row, 'Timestamp_5'))
          || new Date().toISOString();

        // Stage 1: Complaint Registration
        const complaintRegisteredBy = getValue(row, 'Email Address');
        const contactPersonName = getValue(row, 'Contact Person Name');
        const contactPersonNumber = getValue(row, 'Contact Person Number');
        const contactPersonDesignation = getValue(row, 'Contact Person Designation');
        const initialComplaint = getValue(row, 'What\'s the complaint?', 'What\'s the complaint?_1');
        const complaintRemarks = getValue(row, 'Remarks');
        const clientEmail = getValue(row, 'Client Email ID');
        const clientLocation = getValue(row, 'Client Location', 'Client Location_1', 'Client Location_2');
        const machineStatus = getValue(row, 'Machine Status');

        // Stage 2: Job Assignment
        const assignedBy = getValue(row, 'Email Address_1');
        const containerSize = getValue(row, 'Container Size', 'Contanier size');
        const machineMake = getValue(row, 'Machine Make');
        const workType = getValue(row, 'Work Type');
        const clientType = getValue(row, 'Client Type');
        const jobType = getValue(row, 'Job Type');
        const issuesFound = getValue(row, 'Issue(s) found');
        const remedialAction = getValue(row, 'Remedial Action');
        const listOfSparesRequired = getValue(row, 'List of Spares Required');
        const reasonCause = getValue(row, 'Reason / Cause');
        const formLink = getValue(row, 'Form Link');
        const reeferUnit = getValue(row, 'Reefer Unit');
        const reeferUnitModelName = getValue(row, 'Reefer Unit Model Name (Thinline / MP)');
        const reeferUnitSerialNo = getValue(row, 'Reefer Unit Serial No');
        const controllerConfigNumber = getValue(row, 'Controller Configuration Number');
        const controllerVersion = getValue(row, 'Controller Version');
        const equipmentCondition = getValue(row, 'Brand new / Used');
        const crystalSmartSerialNo = getValue(row, 'Crystal Smart Sr No.');
        const technicianName = getValue(row, 'Technician Name', 'Technician Name_1');

        // Stage 3: Indent/Parts Request
        const indentRequestTime = parseDate(getValue(row, 'Timestamp_2'));
        const indentRequestedBy = getValue(row, 'Email Address_2');
        const indentRequired = getValue(row, 'Indent Required ?') === 'Yes' ? true : false;
        const indentNo = getValue(row, 'Indent No', 'Indent No_1', 'Indent No_2');
        const indentDate = parseDate(getValue(row, 'Indent Date'));
        const indentType = getValue(row, 'Indent Type');
        const indentClientLocation = getValue(row, 'Client Location_1');
        const whereToUse = getValue(row, 'Where to Use');
        const billingType = getValue(row, 'Billing Type');

        // Stage 4: Material Arrangement
        const materialArrangementTime = parseDate(getValue(row, 'Timestamp_3'));
        const materialArrangedBy = getValue(row, 'Email Address_3');
        const sparesRequired = getValue(row, 'Spares Required ?', 'Spares Required ?_1') === 'Yes' ? true : false;
        const requiredMaterialArranged = getValue(row, 'Required Material Arranged ?') === 'Yes' ? true : false;
        const purchaseOrder = getValue(row, 'PO');
        const materialArrangedFrom = getValue(row, 'Material arranged from');

        // Stage 5: Material Dispatch
        const materialDispatchTime = parseDate(getValue(row, 'Timestamp_4'));
        const materialDispatchedBy = getValue(row, 'Email Address_4');
        const materialSentThrough = getValue(row, 'Required Material Sent Through');
        const courierName = getValue(row, 'Courier Name');
        const courierTrackingId = getValue(row, 'Courier Docket Number');
        const courierContactNumber = getValue(row, 'Courier Contact Number');

        // Stage 6: Service Execution
        const serviceFormSubmissionTime = parseDate(getValue(row, 'Timestamp_5'));
        const serviceType = getValue(row, 'Service Type');
        const complaintReceivedBy = getValue(row, 'Complaint Received By', 'Call Attended By');
        const serviceClientLocation = getValue(row, 'Client Location_2');
        const containerSizeService = getValue(row, 'Contanier size');
        const callAttendedType = getValue(row, 'Call Attended Type');
        const issueComplaintLogged = getValue(row, 'Issue/Complaint Logged');
        const reeferMakeModel = getValue(row, 'Reefer Make & Model', 'Container Make & Model');
        const operatingTemperature = getValue(row, 'Set / Operating Temperature');

        // Equipment Inspection (28 points)
        const containerCondition = getValue(row, 'Contanier Condition');
        const condenserCoil = getValue(row, 'Condenser Coil');
        const condenserCoilImage = getValue(row, 'Condenser Coil Image');
        const condenserMotor = getValue(row, 'CondenserMotor');
        const evaporatorCoil = getValue(row, 'Evaporator Coil');
        const evaporatorMotor = getValue(row, 'Evaporator Motor');
        const compressorOil = getValue(row, 'Compressor Oil', 'Compressor Oil2');
        const refrigerantGas = getValue(row, 'Refrigerant Gas', 'Refrigerant Gas2');
        const controllerDisplay = getValue(row, 'Controller Display', 'Controller Display2');
        const controllerKeypad = getValue(row, 'Controller keypad', 'Controller keypad2');
        const powerCable = getValue(row, 'Power cable', 'Power cable2');
        const machineMainBreaker = getValue(row, 'Machine main braker');
        const compressorContactor = getValue(row, 'Compressor contactor', 'Compressor contactor2');
        const evpCondContactor = getValue(row, 'EVP/COND contactor', 'EVP/COND contactor2');
        const customerMainMcb = getValue(row, 'Customer main MCB');
        const customerMainCable = getValue(row, 'Customer main cable');
        const flpSocketCondition = getValue(row, 'FLP scoket condition');
        const alarmListClear = getValue(row, 'Alarm lisit clear');
        const filterDrier = getValue(row, 'Filter drier', 'Filter drier2');
        const pressure = getValue(row, 'Pressure');
        const compressorCurrent = getValue(row, 'Comp current');
        const mainVoltage = getValue(row, 'Main Voltage');
        const pti = getValue(row, 'PTI');

        // Documentation
        const observations = getValue(row, 'Observations');
        const workDescription = getValue(row, 'Work Description/Technician Comments', 'Description of complaint');
        const requiredSpareParts = getValue(row, 'Required spare part(s)/Consumable(s)', 'Spares Required', 'List of Spares');
        const signJobOrderFront = getValue(row, 'Sign JOB ORDER (front)');
        const signJobOrderBack = getValue(row, 'Sign JOB ORDER (back)');
        const signJobOrder = getValue(row, 'Sign JOB ORDER');

        // Stage 7: Closure & Follow-up
        const tripNo = getValue(row, 'Trip No');
        const anyPendingJob = getValue(row, 'Any Pending Job?') === 'Yes' ? true : false;
        const nextServiceCallRequired = getValue(row, 'Next Service Call Required') === 'Yes' ? true : false;
        const nextServiceUrgency = getValue(row, 'Next Service - Urgency');
        const pendingJobDetails = getValue(row, 'List down the pending job');

        // Store complete row data as JSON
        const rawExcelData = JSON.stringify(row);

        // Insert into service_history table
        await db.execute(sql`
          INSERT INTO service_history (
            job_order_number,
            container_number,
            client_name,
            complaint_attended_date,
            complaint_registration_time,
            complaint_registered_by,
            contact_person_name,
            contact_person_number,
            contact_person_designation,
            initial_complaint,
            complaint_remarks,
            client_email,
            client_location,
            machine_status,
            assignment_time,
            assigned_by,
            container_size,
            machine_make,
            work_type,
            client_type,
            job_type,
            issues_found,
            remedial_action,
            list_of_spares_required,
            reason_cause,
            form_link,
            reefer_unit,
            reefer_unit_model_name,
            reefer_unit_serial_no,
            controller_config_number,
            controller_version,
            equipment_condition,
            crystal_smart_serial_no,
            technician_name,
            indent_request_time,
            indent_requested_by,
            indent_required,
            indent_no,
            indent_date,
            indent_type,
            indent_client_location,
            where_to_use,
            billing_type,
            material_arrangement_time,
            material_arranged_by,
            spares_required,
            required_material_arranged,
            purchase_order,
            material_arranged_from,
            material_dispatch_time,
            material_dispatched_by,
            material_sent_through,
            courier_name,
            courier_tracking_id,
            courier_contact_number,
            service_form_submission_time,
            service_type,
            complaint_received_by,
            service_client_location,
            container_size_service,
            call_attended_type,
            issue_complaint_logged,
            reefer_make_model,
            operating_temperature,
            container_condition,
            condenser_coil,
            condenser_coil_image,
            condenser_motor,
            evaporator_coil,
            evaporator_motor,
            compressor_oil,
            refrigerant_gas,
            controller_display,
            controller_keypad,
            power_cable,
            machine_main_breaker,
            compressor_contactor,
            evp_cond_contactor,
            customer_main_mcb,
            customer_main_cable,
            flp_socket_condition,
            alarm_list_clear,
            filter_drier,
            pressure,
            compressor_current,
            main_voltage,
            pti,
            observations,
            work_description,
            required_spare_parts,
            sign_job_order_front,
            sign_job_order_back,
            sign_job_order,
            trip_no,
            any_pending_job,
            next_service_call_required,
            next_service_urgency,
            pending_job_details,
            raw_excel_data,
            created_at,
            updated_at
          ) VALUES (
            ${jobOrderNumber},
            ${containerNoStr},
            ${clientName},
            ${complaintAttendedDate},
            ${complaintRegistrationTime},
            ${complaintRegisteredBy},
            ${contactPersonName},
            ${contactPersonNumber},
            ${contactPersonDesignation},
            ${initialComplaint},
            ${complaintRemarks},
            ${clientEmail},
            ${clientLocation},
            ${machineStatus},
            ${assignmentTime},
            ${assignedBy},
            ${containerSize},
            ${machineMake},
            ${workType},
            ${clientType},
            ${jobType},
            ${issuesFound},
            ${remedialAction},
            ${listOfSparesRequired},
            ${reasonCause},
            ${formLink},
            ${reeferUnit},
            ${reeferUnitModelName},
            ${reeferUnitSerialNo},
            ${controllerConfigNumber},
            ${controllerVersion},
            ${equipmentCondition},
            ${crystalSmartSerialNo},
            ${technicianName},
            ${indentRequestTime},
            ${indentRequestedBy},
            ${indentRequired},
            ${indentNo},
            ${indentDate},
            ${indentType},
            ${indentClientLocation},
            ${whereToUse},
            ${billingType},
            ${materialArrangementTime},
            ${materialArrangedBy},
            ${sparesRequired},
            ${requiredMaterialArranged},
            ${purchaseOrder},
            ${materialArrangedFrom},
            ${materialDispatchTime},
            ${materialDispatchedBy},
            ${materialSentThrough},
            ${courierName},
            ${courierTrackingId},
            ${courierContactNumber},
            ${serviceFormSubmissionTime},
            ${serviceType},
            ${complaintReceivedBy},
            ${serviceClientLocation},
            ${containerSizeService},
            ${callAttendedType},
            ${issueComplaintLogged},
            ${reeferMakeModel},
            ${operatingTemperature},
            ${containerCondition},
            ${condenserCoil},
            ${condenserCoilImage},
            ${condenserMotor},
            ${evaporatorCoil},
            ${evaporatorMotor},
            ${compressorOil},
            ${refrigerantGas},
            ${controllerDisplay},
            ${controllerKeypad},
            ${powerCable},
            ${machineMainBreaker},
            ${compressorContactor},
            ${evpCondContactor},
            ${customerMainMcb},
            ${customerMainCable},
            ${flpSocketCondition},
            ${alarmListClear},
            ${filterDrier},
            ${pressure},
            ${compressorCurrent},
            ${mainVoltage},
            ${pti},
            ${observations},
            ${workDescription},
            ${requiredSpareParts},
            ${signJobOrderFront},
            ${signJobOrderBack},
            ${signJobOrder},
            ${tripNo},
            ${anyPendingJob},
            ${nextServiceCallRequired},
            ${nextServiceUrgency},
            ${pendingJobDetails},
            ${rawExcelData}::jsonb,
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
    console.log(`📦 Total processed: ${imported + skipped + errors}`);
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
        container_number,
        COUNT(*) as service_count
      FROM service_history
      GROUP BY container_number
      ORDER BY service_count DESC
      LIMIT 10
    `);

    console.log('\n📈 Top 10 containers by service records:');
    containerStats.rows.forEach((row: any) => {
      console.log(`  ${row.container_number}: ${row.service_count} services`);
    });

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }

  process.exit(0);
}

importServiceMaster();
