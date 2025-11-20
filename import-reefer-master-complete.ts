import 'dotenv/config';
import XLSX from 'xlsx';
import { db } from './server/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

interface ReeferMasterRow {
  [key: string]: any;
}

async function importReeferMaster() {
  console.log('🚀 Starting comprehensive Reefer Container Master import...\n');

  const excelPath = path.join(process.cwd(), 'Reefer Container master.xlsx');

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
    const data: ReeferMasterRow[] = XLSX.utils.sheet_to_json(worksheet, { defval: null });

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
        // Extract container number (try different possible column names)
        const containerNo =
          row['Container No'] ||
          row['Container No.'] ||
          row['container_no'] ||
          row['CONTAINER NO'] ||
          row['Container Number'] ||
          null;

        if (!containerNo || containerNo.toString().trim() === '') {
          console.log(`⏭️  Row ${i + 1}: Skipping - no container number`);
          skipped++;
          continue;
        }

        const containerNoStr = containerNo.toString().trim();

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

        // Extract all fields from Excel with multiple possible column name variations
        const productType = getValue(row, 'Product Type', 'PRODUCT TYPE', 'product_type', 'Type');
        const size = parseNumber(getValue(row, 'SIZE', 'Size', 'size', 'Container Size'));
        const sizeType = getValue(row, 'Size/Type', 'Size Type', 'SIZE/TYPE', 'size_type', 'Container Type');
        const groupName = getValue(row, 'GROUP NAME', 'Group Name', 'group_name', 'Group');
        const gkuProductName = getValue(row, 'GKU - PRODUCT NAME', 'GKU PRODUCT NAME', 'gku_product_name', 'Product Name');
        const category = getValue(row, 'Category(Condition and usage state)', 'Category', 'category', 'CATEGORY');
        const depot = getValue(row, 'Depot', 'DEPOT', 'depot', 'Location');
        const availableLocation = getValue(row, 'Available Location', 'AVAILABLE LOCATION', 'available_location');
        const mfgYear = parseNumber(getValue(row, 'Mfg Year', 'MFG YEAR', 'mfg_year', 'Year of Manufacture', 'YOM'));
        const inventoryStatus = getValue(row, 'Inventory Status', 'INVENTORY STATUS', 'inventory_status', 'Status');
        const current = getValue(row, 'Current', 'CURRENT', 'current');
        const grade = getValue(row, 'Grade', 'GRADE', 'grade', 'Quality');
        const reeferUnit = getValue(row, 'Reefer Unit', 'REEFER UNIT', 'reefer_unit', 'Unit');
        const reeferModel = getValue(row, 'Reefer Unit Model Name (Thinline / MP)', 'Reefer Model', 'reefer_model', 'Model');
        const reeferUnitSerialNo = getValue(row, 'Reefer Unit Serial No', 'REEFER UNIT SERIAL NO', 'reefer_unit_serial_no', 'Serial No');
        const temperature = parseNumber(getValue(row, 'Temperature', 'TEMPERATURE', 'temperature', 'Temp'));
        const controllerConfigNumber = getValue(row, 'Controller Configuration Number', 'controller_configuration_number');
        const controllerVersion = getValue(row, 'Controller Version', 'controller_version');
        const cityOfPurchase = getValue(row, 'City of Purchase', 'city_of_purchase', 'Purchase City');
        const purchaseYardDetails = getValue(row, 'Purchase Yard Details', 'purchase_yard_details');
        const purchaseDate = parseDate(getValue(row, 'Purchase Date', 'purchase_date', 'Date of Purchase'));
        const dispatchLocation = getValue(row, 'Dispatch Location', 'dispatch_location');
        const dispatchDate = parseDate(getValue(row, 'Dispatch Date', 'dispatch_date'));
        const croNumber = getValue(row, 'CRO Number', 'cro_number', 'CRO No');
        const brandNewUsed = getValue(row, 'Brand new / Used', 'brand_new_used', 'Condition');
        const inHouseRunTest = getValue(row, 'In House Run Test Report', 'in_house_run_test_report');
        const condition = getValue(row, 'Condition (CW / Ready / Repair)', 'condition', 'Condition');
        const curtains = getValue(row, 'Curtains', 'curtains', 'CURTAINS');
        const lights = getValue(row, 'Lights', 'lights', 'LIGHTS');
        const colour = getValue(row, 'Colour', 'colour', 'Color', 'color');
        const logoSticker = getValue(row, 'Logo/Sticker', 'logo_sticker', 'Logo');
        const repairRemarks = getValue(row, 'Repair Remarks', 'repair_remarks', 'Remarks');
        const estimatedCost = parseNumber(getValue(row, 'Estimated Cost for Repair', 'estimated_cost_for_repair'));
        const imageLinks = getValue(row, 'Images /PTI/Survey', 'images_pti_survey', 'Image Links');
        const crystalSmartSrNo = getValue(row, 'Crystal Smart Sr No.', 'crystal_smart_sr_no');
        const bookingOrderNumber = getValue(row, 'Booking Order Number', 'booking_order_number');
        const doNumber = getValue(row, 'DO Number', 'do_number', 'DO No');
        const noOfDays = parseNumber(getValue(row, 'No of days', 'no_of_days', 'Days'));
        const setTempDespatch = getValue(row, 'Set Temperature during Despatch live', 'Set Temperature during Despatch / Live', 'set_temperature_during_despatch_live');
        const assetsBelongTo = getValue(row, 'Assets Belong To', 'Assets Belong to', 'assets_belong_to', 'Owner');
        const blocked = getValue(row, 'Blocked', 'blocked', 'BLOCKED');
        const remark = getValue(row, 'Remark', 'remark', 'REMARK', 'Remarks');
        const domestication = getValue(row, 'Domestication', 'domestication');
        const dateOfArrival = parseDate(getValue(row, 'Date of Arrival in Depot', 'Date of arrival in depot', 'date_of_arrival_in_depot'));
        const srNo = parseNumber(getValue(row, 'Sr. No.', 'Sr. No', 'sr_no', 'Serial Number'));

        // Store complete row data as JSON for reference
        const masterSheetData = JSON.stringify(row);

        // Check if container exists
        const existingContainer = await db.execute(sql`
          SELECT id FROM containers WHERE container_id = ${containerNoStr} LIMIT 1
        `);

        const exists = existingContainer.rows && existingContainer.rows.length > 0;

        if (exists) {
          // Update existing container
          await db.execute(sql`
            UPDATE containers
            SET
              product_type = ${productType},
              size = ${size},
              size_type = ${sizeType},
              group_name = ${groupName},
              gku_product_name = ${gkuProductName},
              category = ${category},
              depot = ${depot},
              available_location = ${availableLocation},
              mfg_year = ${mfgYear},
              inventory_status = ${inventoryStatus},
              current = ${current},
              grade = ${grade},
              reefer_unit = ${reeferUnit},
              reefer_model = ${reeferModel},
              reefer_unit_serial_no = ${reeferUnitSerialNo},
              temperature = ${temperature},
              controller_configuration_number = ${controllerConfigNumber},
              controller_version = ${controllerVersion},
              city_of_purchase = ${cityOfPurchase},
              purchase_yard_details = ${purchaseYardDetails},
              purchase_date = ${purchaseDate},
              dispatch_location = ${dispatchLocation},
              dispatch_date = ${dispatchDate},
              cro_number = ${croNumber},
              brand_new_used = ${brandNewUsed},
              in_house_run_test_report = ${inHouseRunTest},
              condition = ${condition},
              curtains = ${curtains},
              lights = ${lights},
              colour = ${colour},
              logo_sticker = ${logoSticker},
              repair_remarks = ${repairRemarks},
              estimated_cost_for_repair = ${estimatedCost},
              images_pti_survey = ${imageLinks},
              master_sheet_data = ${masterSheetData}::jsonb,
              crystal_smart_sr_no = ${crystalSmartSrNo},
              booking_order_number = ${bookingOrderNumber},
              do_number = ${doNumber},
              no_of_days = ${noOfDays},
              set_temperature_during_despatch_live = ${setTempDespatch},
              blocked = ${blocked},
              remark = ${remark},
              domestication = ${domestication},
              date_of_arrival_in_depot = ${dateOfArrival},
              container_no = ${containerNoStr},
              sr_no = ${srNo},
              updated_at = NOW()
            WHERE container_id = ${containerNoStr}
          `);
          updated++;
          if (updated % 50 === 0) {
            console.log(`✅ Updated ${updated} containers...`);
          }
        } else {
          // Insert new container
          await db.execute(sql`
            INSERT INTO containers (
              container_id,
              product_type, size, size_type, group_name, gku_product_name,
              category, depot, available_location, mfg_year, inventory_status,
              current, grade, reefer_unit, reefer_model, reefer_unit_serial_no,
              temperature, controller_configuration_number, controller_version,
              city_of_purchase, purchase_yard_details, purchase_date,
              dispatch_location, dispatch_date, cro_number, brand_new_used,
              in_house_run_test_report, condition, curtains, lights, colour,
              logo_sticker, repair_remarks, estimated_cost_for_repair,
              images_pti_survey, master_sheet_data, crystal_smart_sr_no,
              booking_order_number, do_number, no_of_days,
              set_temperature_during_despatch_live,
              blocked, remark, domestication, date_of_arrival_in_depot,
              container_no, sr_no, created_at, updated_at
            ) VALUES (
              ${containerNoStr},
              ${productType}, ${size}, ${sizeType}, ${groupName}, ${gkuProductName},
              ${category}, ${depot}, ${availableLocation}, ${mfgYear}, ${inventoryStatus},
              ${current}, ${grade}, ${reeferUnit}, ${reeferModel}, ${reeferUnitSerialNo},
              ${temperature}, ${controllerConfigNumber}, ${controllerVersion},
              ${cityOfPurchase}, ${purchaseYardDetails}, ${purchaseDate},
              ${dispatchLocation}, ${dispatchDate}, ${croNumber}, ${brandNewUsed},
              ${inHouseRunTest}, ${condition}, ${curtains}, ${lights}, ${colour},
              ${logoSticker}, ${repairRemarks}, ${estimatedCost},
              ${imageLinks}, ${masterSheetData}::jsonb, ${crystalSmartSrNo},
              ${bookingOrderNumber}, ${doNumber}, ${noOfDays},
              ${setTempDespatch},
              ${blocked}, ${remark}, ${domestication}, ${dateOfArrival},
              ${containerNoStr}, ${srNo}, NOW(), NOW()
            )
          `);
          imported++;
          if (imported % 50 === 0) {
            console.log(`✅ Imported ${imported} new containers...`);
          }
        }

      } catch (error: any) {
        console.error(`❌ Error processing row ${i + 1}:`, error.message);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ New containers imported: ${imported}`);
    console.log(`🔄 Existing containers updated: ${updated}`);
    console.log(`⏭️  Rows skipped (no container number): ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📦 Total processed: ${imported + updated + skipped}`);
    console.log('='.repeat(60));

    // Verify data in database
    console.log('\n🔍 Verifying import...');
    const verifyResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM containers
      WHERE product_type IS NOT NULL
    `);
    console.log(`✅ Total containers with reefer data in database: ${verifyResult.rows[0].count}`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }

  process.exit(0);
}

importReeferMaster();
