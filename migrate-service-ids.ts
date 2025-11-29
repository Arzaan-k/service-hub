/**
 * Migration Script: Update service request IDs to MMMXXX format
 * 
 * This script converts old SR-{timestamp} format to new job order format (e.g., NOV081)
 * 
 * Usage: npx tsx migrate-service-ids.ts
 */

import { config } from 'dotenv';
config();

import { neon } from '@neondatabase/serverless';

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

async function migrateServiceIds() {
  const sql = neon(process.env.DATABASE_URL!);
  
  console.log('🔄 Starting service request ID migration...\n');
  
  try {
    // Step 1: Add old_request_number column if not exists
    console.log('📋 Step 1: Adding backup column...');
    await sql`
      ALTER TABLE service_requests 
      ADD COLUMN IF NOT EXISTS old_request_number TEXT
    `;
    console.log('✅ Backup column ready\n');
    
    // Step 2: Get all service requests with old format
    console.log('📋 Step 2: Fetching service requests with old format...');
    const oldRequests = await sql`
      SELECT id, request_number, job_order, created_at
      FROM service_requests
      WHERE request_number LIKE 'SR-%'
         OR request_number LIKE 'SR-%'
      ORDER BY created_at ASC
    `;
    
    console.log(`📊 Found ${oldRequests.length} service requests to migrate\n`);
    
    if (oldRequests.length === 0) {
      console.log('✅ No service requests need migration. All done!');
      return;
    }
    
    // Step 3: Process each request
    console.log('📋 Step 3: Migrating service request IDs...\n');
    
    // Track sequence numbers per month/year
    const sequenceMap = new Map<string, number>();
    
    // First, get existing max sequences for each month/year
    const existingMaxSeqs = await sql`
      SELECT 
        SUBSTRING(request_number FROM 1 FOR 3) as month_abbr,
        EXTRACT(YEAR FROM created_at)::INT as year_val,
        MAX(SUBSTRING(request_number FROM 4)::INT) as max_seq
      FROM service_requests
      WHERE request_number ~ '^[A-Z]{3}[0-9]{3}$'
      GROUP BY month_abbr, year_val
    `;
    
    for (const row of existingMaxSeqs) {
      const key = `${row.month_abbr}-${row.year_val}`;
      sequenceMap.set(key, row.max_seq || 0);
    }
    
    let migrated = 0;
    let errors = 0;
    
    for (const req of oldRequests) {
      try {
        const createdAt = new Date(req.created_at);
        const monthAbbr = MONTH_NAMES[createdAt.getMonth()];
        const year = createdAt.getFullYear();
        const key = `${monthAbbr}-${year}`;
        
        // Get next sequence number
        const currentSeq = sequenceMap.get(key) || 0;
        const nextSeq = currentSeq + 1;
        sequenceMap.set(key, nextSeq);
        
        // Generate new ID (e.g., NOV001)
        const newId = `${monthAbbr}${nextSeq.toString().padStart(3, '0')}`;
        
        // Update the record
        await sql`
          UPDATE service_requests
          SET 
            old_request_number = COALESCE(old_request_number, request_number),
            request_number = ${newId},
            job_order = COALESCE(job_order, ${newId})
          WHERE id = ${req.id}
        `;
        
        console.log(`  ✅ ${req.request_number} → ${newId}`);
        migrated++;
        
      } catch (err) {
        console.error(`  ❌ Error migrating ${req.id}: ${err}`);
        errors++;
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Migrated: ${migrated}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log('='.repeat(50));
    
    // Step 4: Show sample of migrated records
    console.log('\n📋 Sample of migrated records:');
    const sample = await sql`
      SELECT request_number, old_request_number, job_order, created_at
      FROM service_requests
      WHERE old_request_number IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    console.table(sample.map(r => ({
      'New ID': r.request_number,
      'Old ID': r.old_request_number,
      'Job Order': r.job_order,
      'Created': new Date(r.created_at).toLocaleDateString()
    })));
    
    console.log('\n✅ Migration complete!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateServiceIds();
