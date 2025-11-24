import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';

async function importContainersJson() {
  console.log('🔄 Importing containers from containers.json...\n');

  try {
    // Read the JSON file
    const jsonData = JSON.parse(fs.readFileSync('./containers.json', 'utf-8'));
    console.log(`📦 Found ${jsonData.length} containers in JSON file\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const container of jsonData) {
      try {
        // Skip if no product_type (no reefer master data)
        if (!container.product_type) {
          skipped++;
          continue;
        }

        // Update the container with all reefer master fields
        await db.execute(sql`
          UPDATE containers
          SET
            product_type = ${container.product_type},
            size = ${container.size},
            size_type = ${container.size_type},
            group_name = ${container.group_name},
            gku_product_name = ${container.gku_product_name},
            category = ${container.category},
            depot = ${container.depot},
            available_location = ${container.available_location},
            mfg_year = ${container.mfg_year},
            inventory_status = ${container.inventory_status},
            current = ${container.current},
            grade = ${container.grade},
            reefer_unit = ${container.reefer_unit},
            reefer_model = ${container.reefer_model},
            reefer_unit_model_name = ${container.reefer_unit_model_name},
            reefer_unit_serial_no = ${container.reefer_unit_serial_no},
            temperature = ${container.temperature},
            controller_configuration_number = ${container.controller_configuration_number},
            controller_version = ${container.controller_version},
            city_of_purchase = ${container.city_of_purchase},
            purchase_yard_details = ${container.purchase_yard_details},
            dispatch_location = ${container.dispatch_location},
            dispatch_date = ${container.dispatch_date},
            cro_number = ${container.cro_number},
            brand_new_used = ${container.brand_new_used},
            in_house_run_test_report = ${container.in_house_run_test_report},
            condition = ${container.condition},
            curtains = ${container.curtains},
            lights = ${container.lights},
            colour = ${container.colour},
            logo_sticker = ${container.logo_sticker},
            repair_remarks = ${container.repair_remarks},
            estimated_cost_for_repair = ${container.estimated_cost_for_repair},
            images_pti_survey = ${container.images_pti_survey},
            master_sheet_data = ${JSON.stringify(container.master_sheet_data)},
            updated_at = NOW()
          WHERE container_id = ${container.container_id}
        `);

        updated++;

        if (updated % 50 === 0) {
          console.log(`✅ Processed ${updated} containers...`);
        }
      } catch (error) {
        console.error(`❌ Error updating container ${container.container_id}:`, error.message);
        errors++;
      }
    }

    console.log('\n=== IMPORT SUMMARY ===');
    console.log(`✅ Updated: ${updated}`);
    console.log(`⏭️  Skipped (no product_type): ${skipped}`);
    console.log(`❌ Errors: ${errors}`);

    // Verify import
    const verifyResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM containers
      WHERE product_type IS NOT NULL AND product_type != ''
    `);
    console.log(`\n✅ Total containers with product_type in database: ${verifyResult.rows[0].count}`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }

  process.exit(0);
}

importContainersJson();
