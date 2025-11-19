# Production Migration Guide: Reefer Master Fields

## Issue Description
Container details showing "N/A" for all fields on deployed version (render.com) while localhost displays data correctly.

**Root Cause:** The production database is missing the reefer master field columns that were added in recent migrations.

## Solution
Run the reefer master fields migration on the production database.

---

## Option 1: Using Render Shell (Recommended)

### Step 1: Access Render Shell
1. Go to your Render dashboard: https://dashboard.render.com
2. Select your service-hub-ui service
3. Click on the "Shell" tab in the top navigation

### Step 2: Run Migration
In the Render shell, execute:

```bash
npm run db:migrate:reefer
```

If this script isn't available, run directly:

```bash
npx tsx server/tools/migrate-reefer-fields.ts
```

### Step 3: Verify Migration
Check the output for:
- ✅ All migrations completed successfully!
- List of 16+ reefer master columns found

---

## Option 2: Using Local Connection to Production Database

### Step 1: Get Production DATABASE_URL
1. Go to Render dashboard
2. Select your PostgreSQL database
3. Copy the "External Database URL"

### Step 2: Run Migration Locally Against Production
```bash
# Set production DATABASE_URL temporarily
$env:DATABASE_URL="your-production-database-url-here"

# Run migration
npx tsx server/tools/migrate-reefer-fields.ts

# Unset the environment variable
Remove-Item Env:DATABASE_URL
```

⚠️ **Warning:** Be careful when running migrations against production. Always backup first if possible.

---

## Option 3: Manual SQL Execution

If the above options don't work, you can run the SQL migrations manually:

### Step 1: Access PostgreSQL Console
1. In Render dashboard, go to your PostgreSQL database
2. Click "Connect" and choose "PSQL Command"
3. Copy and run the command in your local terminal (requires psql installed)

### Step 2: Run Migration SQL
Copy and paste the contents of these files in order:

1. `migrations/20251119_add_reefer_master_fields.sql`
2. `migrations/20251120_add_more_master_fields.sql`

### Step 3: Verify Columns
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'containers'
AND column_name IN (
  'product_type', 'size_type', 'group_name', 'gku_product_name',
  'category', 'depot', 'yom', 'grade', 'reefer_unit', 'reefer_model',
  'container_no', 'available_location', 'mfg_year', 'inventory_status'
)
ORDER BY column_name;
```

You should see 16+ rows returned.

---

## After Migration

### 1. Verify in Production
After running the migration, visit your deployed app and check a container details page. The fields should now display correctly instead of showing "N/A".

### 2. Add NPM Script (Optional)
Add this to `package.json` scripts section for future use:

```json
"db:migrate:reefer": "tsx server/tools/migrate-reefer-fields.ts"
```

### 3. Redeploy (if needed)
If the migration doesn't immediately fix the issue, trigger a redeploy:
```bash
git commit --allow-empty -m "Trigger redeploy after migration"
git push origin main
```

---

## Migration Files Included

The migration adds these columns to the `containers` table:

**From 20251119_add_reefer_master_fields.sql:**
- product_type
- size_type
- group_name
- gku_product_name
- category
- size
- depot
- yom (Year of Manufacture)
- grade
- reefer_unit
- reefer_model
- image_links
- master_sheet_data (JSONB)

**From 20251120_add_more_master_fields.sql:**
- sr_no
- container_no
- available_location
- mfg_year
- inventory_status
- current
- images_pti_survey
- purchase_date
- temperature
- domestication
- reefer_unit_model_name
- reefer_unit_serial_no
- controller_configuration_number
- controller_version
- city_of_purchase
- purchase_yard_details
- cro_number
- brand_new_used
- date_of_arrival_in_depot
- in_house_run_test_report
- condition
- curtains
- lights
- colour
- logo_sticker
- repair_remarks
- estimated_cost_for_repair
- crystal_smart_sr_no
- booking_order_number
- do_number
- dispatch_date
- no_of_days
- dispatch_location
- set_temperature_during_dispatch_live
- assets_belong_to
- blocked
- remark

---

## Troubleshooting

### Error: "relation 'containers' does not exist"
The containers table itself doesn't exist. Run the base migrations first.

### Error: "column already exists"
This is actually okay! The migration script handles this gracefully. The column is already present.

### Container details still showing "N/A"
1. Check if the migration actually ran successfully
2. Verify columns exist in production database
3. Check if there's actual data in those columns (run `SELECT container_no, product_type, grade FROM containers LIMIT 5;`)
4. If columns exist but are empty, you may need to import the container master data

---

## Need Help?
If you encounter issues:
1. Check the migration script output for specific errors
2. Verify the DATABASE_URL is pointing to the correct database
3. Ensure you have the necessary permissions to ALTER TABLE
4. Contact your database administrator if permissions are restricted
