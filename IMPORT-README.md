# Excel Data Import Script

## Overview

This script imports historical data from Excel files (converted to JSON) into the Service Hub database. It handles:

- Container Purchase Details (619 + 626 records)
- Service History (1,478 + 923 records)

## Prerequisites

1. **Environment Setup**
   - Ensure `.env.development` file exists with valid `DATABASE_URL`
   - Database must be accessible and properly configured

2. **Required Files**
   - `create_schema_updates.sql` - Database schema migrations
   - `data_Container_Purchase_Details1_xlsx_Sheet1.json` (619 records)
   - `data_Container_Purchase_Details2_xlsx_Sheet1.json` (626 records)
   - `data_Service_History_xlsx_Sheet1.json` (1,478 records)
   - `data_Service_History2_xlsx_Sheet1.json` (923 records)

3. **Dependencies**
   - All npm packages must be installed: `npm install`

## What the Script Does

### Step 1: SQL Migration
Runs `create_schema_updates.sql` to:
- Create `container_ownership_history` table
- Add new fields to `service_requests` table
- Create necessary indexes

### Step 2: Clean Existing Data
Removes previously imported data:
- Container ownership history records
- Service requests with job orders
- Containers with Excel metadata
- Related customers

### Step 3: Load JSON Files
Loads all 4 JSON files into memory and validates record counts.

### Step 4: Merge Purchase Data
- Joins Purchase Details 1 and 2 by `Quotation No` and `Order Received Number`
- Creates comprehensive records with both customer info and container details

### Step 5: Import Customers
- Extracts unique customers from Purchase Details
- Creates user accounts for each customer
- Creates customer records with billing and contact information
- Handles duplicate phone numbers and emails gracefully

### Step 6: Import Containers and Ownership
- Creates container records from merged purchase data
- Uses container numbers from Purchase Details 2 (`Container No/Vehicle No.`)
- Creates ownership history linking containers to customers
- Stores complete Excel data as JSON metadata

### Step 7: Import Service Requests
- Imports service history from both files
- Links service requests to containers by container number
- Links to customers by client name or container ownership
- Converts Excel date formats to proper timestamps
- Maps job order numbers from Excel to database

## Running the Script

```bash
# Using Node.js directly
node import-excel-data.js

# Or using npm script (add to package.json)
npm run import:excel
```

## Key Features

### Robust Error Handling
- Validates all data before insertion
- Gracefully handles missing or null values
- Reports errors without stopping the entire import

### Excel Date Conversion
- Converts Excel serial date numbers (e.g., 45461.665185185186) to JavaScript dates
- Handles both date fields and timestamp fields

### Smart Matching
- Matches Purchase Details 1 & 2 by quotation and order numbers
- Matches Service History to containers by container number
- Matches Service History to customers by client name
- Falls back to container ownership when customer match fails

### Data Preservation
- Stores complete original Excel data as JSONB in `excel_metadata` and `excel_data` fields
- Preserves all fields even if not mapped to specific columns

### Progress Reporting
- Shows detailed progress for each major step
- Reports counts every 50-100 records during import
- Provides comprehensive summary at completion

## Field Mappings

### Container Purchase Details
- **Customer Name** → `customers.company_name`
- **Container No/Vehicle No.** → `containers.container_id`
- **Quotation No** → Links PD1 and PD2
- **Order Received Number** → Links PD1 and PD2
- **Order Type** → `container_ownership_history.order_type`
- **Tenure** → `container_ownership_history.tenure` (JSON: years, months, days)
- **Basic Amount** → `container_ownership_history.basic_amount`
- **Security Deposit** → `container_ownership_history.security_deposit`

### Service History
- **Job Order No.** or **Job order No** → `service_requests.job_order`
- **Container Number** or **Container No** → Links to container
- **Client Name** → Links to customer
- **Work Type** → `service_requests.work_type`
- **Client Type** → `service_requests.client_type`
- **Job Type** → `service_requests.job_type`
- **Billing Type** → `service_requests.billing_type`
- **Call Status** → `service_requests.call_status`
- **Month** → `service_requests.month`
- **Year** → `service_requests.year`

## Expected Output

```
============================================================
  Excel Data Import Script
  Service Hub Database Migration
============================================================

=== STEP 1: Running SQL Migration ===
✓ Migration completed successfully

=== STEP 2: Cleaning Existing Data ===
✓ Cleaned container_ownership_history
✓ Cleaned service_requests (Excel imports only)
✓ Cleaned containers (Excel imports only)
✓ Cleaned customers (Excel imports only)
✓ All existing data cleaned

=== STEP 3: Loading JSON Files ===
✓ Loaded Purchase Details 1: 619 records
✓ Loaded Purchase Details 2: 626 records
✓ Loaded Service History 1: 1478 records
✓ Loaded Service History 2: 923 records

=== STEP 4: Merging Purchase Data ===
✓ Merged 626 records with container numbers
✓ 619 records without container numbers (PD1 only)
✓ Total merged records: 1245

=== STEP 5: Importing Customers ===
  Progress: 50 customers created...
  Progress: 100 customers created...
  ...
✓ Created 200 customers
✓ Skipped 0 records

=== STEP 6: Importing Containers and Ownership ===
  Progress: 50 containers, 50 ownership records...
  Progress: 100 containers, 100 ownership records...
  ...
✓ Created 626 containers
✓ Created 626 ownership history records
✓ Skipped 0 records

=== STEP 7: Importing Service Requests ===
  Progress: 100 service requests created...
  Progress: 200 service requests created...
  ...
✓ Created 2401 service requests
✓ Skipped 0 records

============================================================
  Import Summary
============================================================
✓ Total execution time: 45.32 seconds
✓ Customers imported: 200
✓ Containers imported: 626
✓ All data imported successfully!
============================================================
```

## Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` in `.env.development`
- Check database is running and accessible
- Ensure firewall allows connection

### Missing Files
- Verify all 4 JSON files exist in the project root
- Check `create_schema_updates.sql` exists
- Ensure file names match exactly

### Duplicate Key Errors
- The script handles duplicates gracefully
- Run clean step again if needed
- Check for pre-existing data with same identifiers

### Foreign Key Violations
- Ensure users table has at least one admin user
- Script creates system user if needed
- Check customer/container relationships

## Database Cleanup (Manual)

If you need to manually clean the imported data:

```sql
-- Delete in this order
DELETE FROM container_ownership_history;
DELETE FROM service_requests WHERE job_order IS NOT NULL;
DELETE FROM containers WHERE excel_metadata IS NOT NULL;
DELETE FROM customers WHERE email LIKE '%imported%';
```

## Post-Import Verification

Check imported data:

```sql
-- Count imported records
SELECT COUNT(*) FROM customers WHERE email LIKE '%imported%';
SELECT COUNT(*) FROM containers WHERE excel_metadata IS NOT NULL;
SELECT COUNT(*) FROM container_ownership_history;
SELECT COUNT(*) FROM service_requests WHERE job_order IS NOT NULL;

-- Sample imported data
SELECT * FROM customers LIMIT 5;
SELECT * FROM containers WHERE excel_metadata IS NOT NULL LIMIT 5;
SELECT * FROM service_requests WHERE job_order IS NOT NULL LIMIT 5;
```

## Notes

- Import is idempotent - safe to run multiple times
- Existing data is cleaned before import
- All original Excel data preserved in JSON fields
- Script takes approximately 30-60 seconds to complete
- Progress is logged in real-time

## Support

For issues or questions:
1. Check error messages for specific failures
2. Verify data in JSON files is properly formatted
3. Ensure database schema is up to date
4. Check database logs for constraint violations
