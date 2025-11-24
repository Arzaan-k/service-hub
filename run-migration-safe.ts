/**
 * SAFE SERVICE HISTORY DATABASE MIGRATION RUNNER
 * Executes migration in smaller, safer chunks
 */

import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function runSafeMigration() {
  console.log('🚀 Starting Service History Schema Migration...\n');

  try {
    // Step 1: Create service_history table
    console.log('📋 Step 1: Creating service_history table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS service_history (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

        job_order_number TEXT NOT NULL UNIQUE,
        service_request_id TEXT,

        complaint_registration_time TIMESTAMP,
        complaint_registered_by TEXT,
        client_name TEXT NOT NULL,
        contact_person_name TEXT,
        contact_person_number TEXT,
        contact_person_designation TEXT,
        container_number TEXT NOT NULL,
        initial_complaint TEXT,
        complaint_remarks TEXT,
        client_email TEXT,
        client_location TEXT,
        machine_status TEXT,

        assignment_time TIMESTAMP,
        assigned_by TEXT,
        container_size TEXT,
        machine_make TEXT,
        work_type TEXT,
        client_type TEXT,
        job_type TEXT,
        issues_found TEXT,
        remedial_action TEXT,
        list_of_spares_required TEXT,
        reason_cause TEXT,
        form_link TEXT,
        reefer_unit TEXT,
        reefer_unit_model_name TEXT,
        reefer_unit_serial_no TEXT,
        controller_config_number TEXT,
        controller_version TEXT,
        equipment_condition TEXT,
        crystal_smart_serial_no TEXT,
        technician_name TEXT,

        indent_request_time TIMESTAMP,
        indent_requested_by TEXT,
        indent_required BOOLEAN,
        indent_no TEXT,
        indent_date TIMESTAMP,
        indent_type TEXT,
        indent_client_location TEXT,
        where_to_use TEXT,
        billing_type TEXT,

        material_arrangement_time TIMESTAMP,
        material_arranged_by TEXT,
        spares_required BOOLEAN,
        required_material_arranged BOOLEAN,
        purchase_order TEXT,
        material_arranged_from TEXT,

        material_dispatch_time TIMESTAMP,
        material_dispatched_by TEXT,
        material_sent_through TEXT,
        courier_name TEXT,
        courier_tracking_id TEXT,
        courier_contact_number TEXT,
        estimated_delivery_date TIMESTAMP,
        delivery_remarks TEXT,

        service_form_submission_time TIMESTAMP,
        complaint_attended_date TIMESTAMP NOT NULL,
        service_type TEXT,
        complaint_received_by TEXT,
        service_client_location TEXT,
        container_size_service TEXT,
        call_attended_type TEXT,
        issue_complaint_logged TEXT,
        reefer_make_model TEXT,
        operating_temperature TEXT,

        container_condition TEXT,
        condenser_coil TEXT,
        condenser_coil_image TEXT,
        condenser_motor TEXT,
        evaporator_coil TEXT,
        evaporator_motor TEXT,
        compressor_oil TEXT,
        refrigerant_gas TEXT,
        controller_display TEXT,
        controller_keypad TEXT,
        power_cable TEXT,
        machine_main_breaker TEXT,
        compressor_contactor TEXT,
        evp_cond_contactor TEXT,
        customer_main_mcb TEXT,
        customer_main_cable TEXT,
        flp_socket_condition TEXT,
        alarm_list_clear TEXT,
        filter_drier TEXT,
        pressure TEXT,
        compressor_current TEXT,
        main_voltage TEXT,
        pti TEXT,

        observations TEXT,
        work_description TEXT,
        required_spare_parts TEXT,
        sign_job_order_front TEXT,
        sign_job_order_back TEXT,
        sign_job_order TEXT,

        trip_no TEXT,
        any_pending_job BOOLEAN,
        next_service_call_required BOOLEAN,
        next_service_urgency TEXT,
        pending_job_details TEXT,

        raw_excel_data JSONB,
        data_imported_at TIMESTAMP DEFAULT NOW(),
        data_source TEXT DEFAULT 'excel_import',

        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    console.log('   ✅ service_history table created\n');

    // Step 2: Create indexes for service_history
    console.log('📋 Step 2: Creating indexes for service_history...');
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_service_history_job_order ON service_history(job_order_number)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_service_history_container ON service_history(container_number)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_service_history_client ON service_history(client_name)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_service_history_technician ON service_history(technician_name)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_service_history_service_date ON service_history(complaint_attended_date)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_service_history_indent ON service_history(indent_no)`);
    console.log('   ✅ Indexes created\n');

    // Step 3: Create indents table
    console.log('📋 Step 3: Creating indents table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS indents (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        indent_number TEXT NOT NULL UNIQUE,
        service_history_id TEXT,
        service_request_id TEXT,

        indent_date TIMESTAMP NOT NULL,
        indent_type TEXT,
        requested_by TEXT NOT NULL,

        parts_requested JSONB NOT NULL,
        where_to_use TEXT,
        billing_type TEXT,

        material_arranged BOOLEAN DEFAULT false,
        material_arranged_at TIMESTAMP,
        material_arranged_by TEXT,
        material_source TEXT,

        dispatched BOOLEAN DEFAULT false,
        dispatched_at TIMESTAMP,
        dispatch_method TEXT,
        tracking_number TEXT,

        parts_used JSONB,
        status TEXT NOT NULL DEFAULT 'requested',

        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_indents_number ON indents(indent_number)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_indents_status ON indents(status)`);
    console.log('   ✅ indents table created\n');

    // Step 4: Create standardization tables
    console.log('📋 Step 4: Creating standardization tables...');

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS manufacturer_standards (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        standard_name TEXT NOT NULL UNIQUE,
        variations TEXT[] NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS container_size_standards (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        standard_size TEXT NOT NULL UNIQUE,
        variations TEXT[] NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS location_standards (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        standard_location TEXT NOT NULL UNIQUE,
        variations TEXT[] NOT NULL,
        city TEXT,
        state TEXT,
        country TEXT DEFAULT 'India',
        coordinates JSONB,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    console.log('   ✅ Standardization tables created\n');

    // Step 5: Create service_statistics table
    console.log('📋 Step 5: Creating service_statistics table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS service_statistics (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

        technician_name TEXT,
        total_jobs INTEGER DEFAULT 0,
        completed_jobs INTEGER DEFAULT 0,
        average_job_duration INTEGER,

        container_number TEXT,
        total_service_visits INTEGER DEFAULT 0,
        last_service_date TIMESTAMP,
        next_service_due TIMESTAMP,

        client_name TEXT,
        total_services_received INTEGER DEFAULT 0,

        issue_category TEXT,
        issue_count INTEGER DEFAULT 0,

        period_start TIMESTAMP,
        period_end TIMESTAMP,

        calculated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_stats_technician ON service_statistics(technician_name)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_stats_container ON service_statistics(container_number)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_stats_client ON service_statistics(client_name)`);
    console.log('   ✅ service_statistics table created\n');

    // Step 6: Create inspection_checklist_template
    console.log('📋 Step 6: Creating inspection_checklist_template...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS inspection_checklist_template (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        category TEXT NOT NULL,
        field_name TEXT NOT NULL UNIQUE,
        display_label TEXT NOT NULL,
        field_type TEXT NOT NULL,
        options TEXT[],
        is_required BOOLEAN DEFAULT true,
        sort_order INTEGER NOT NULL,
        help_text TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    console.log('   ✅ inspection_checklist_template created\n');

    // Step 7: Insert standardization data
    console.log('📋 Step 7: Inserting standardization data...');

    await db.execute(sql`
      INSERT INTO manufacturer_standards (standard_name, variations) VALUES
        ('DAIKIN', ARRAY['DAIKIN', 'Daikin', 'DAikin', 'daikin']),
        ('CARRIER', ARRAY['CARRIER', 'Carrier', 'carrier']),
        ('THERMOKING', ARRAY['THERMOKING', 'Thermoking', 'ThermoKing', 'thermoking', 'THERMO KING'])
      ON CONFLICT (standard_name) DO NOTHING
    `);

    await db.execute(sql`
      INSERT INTO container_size_standards (standard_size, variations) VALUES
        ('40FT', ARRAY['40FT', '40 FT', '40-REEFER', '40FT STD RF']),
        ('40FT-HC', ARRAY['40FT HC', '40FT HC RF', '40 FT HC']),
        ('20FT', ARRAY['20FT', '20 FT', '20-REEFER', '20FT STD RF']),
        ('45FT-HC', ARRAY['45FT HC', '45FT', '45 FT'])
      ON CONFLICT (standard_size) DO NOTHING
    `);

    await db.execute(sql`
      INSERT INTO location_standards (standard_location, variations, city, state) VALUES
        ('Visakhapatnam', ARRAY['Vizag', 'VIZAG', 'vizag', 'Visakhapatnam'], 'Visakhapatnam', 'Andhra Pradesh'),
        ('Hyderabad', ARRAY['Hyd', 'HYD', 'hyderabad', 'Hyderabad'], 'Hyderabad', 'Telangana'),
        ('Chennai', ARRAY['Chennai', 'CHENNAI', 'chennai'], 'Chennai', 'Tamil Nadu'),
        ('Mumbai', ARRAY['Mumbai', 'MUMBAI', 'mumbai'], 'Mumbai', 'Maharashtra'),
        ('Delhi', ARRAY['Delhi', 'DELHI', 'delhi', 'New Delhi'], 'New Delhi', 'Delhi')
      ON CONFLICT (standard_location) DO NOTHING
    `);

    console.log('   ✅ Standardization data inserted\n');

    // Verification
    console.log('🔍 Verifying migration...\n');

    const tables = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN (
        'service_history',
        'indents',
        'manufacturer_standards',
        'container_size_standards',
        'location_standards',
        'service_statistics',
        'inspection_checklist_template'
      )
      ORDER BY table_name
    `);

    console.log(`✅ Created ${tables.rows.length} / 7 tables:`);
    tables.rows.forEach((row: any) => {
      console.log(`   ✓ ${row.table_name}`);
    });

    const manufacturerCount = await db.execute(sql`SELECT COUNT(*) as count FROM manufacturer_standards`);
    const sizeCount = await db.execute(sql`SELECT COUNT(*) as count FROM container_size_standards`);
    const locationCount = await db.execute(sql`SELECT COUNT(*) as count FROM location_standards`);

    console.log('\n📊 Standardization Data:');
    console.log(`   ✓ ${manufacturerCount.rows[0].count} manufacturers`);
    console.log(`   ✓ ${sizeCount.rows[0].count} container sizes`);
    console.log(`   ✓ ${locationCount.rows[0].count} locations`);

    console.log('\n' + '='.repeat(60));
    console.log('🎉 MIGRATION SUCCESSFUL!');
    console.log('='.repeat(60));
    console.log('\n📌 Next Step:');
    console.log('   npx tsx server/tools/import-service-master.ts\n');

  } catch (error) {
    console.error('\n❌ Migration Failed!');
    console.error('Error:', error);

    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        console.log('\n💡 Tables already exist - migration may have succeeded previously');
        console.log('   Run: SELECT COUNT(*) FROM service_history; to verify');
      }
    }

    throw error;
  }
}

// Run migration
runSafeMigration()
  .then(() => {
    console.log('✅ Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
