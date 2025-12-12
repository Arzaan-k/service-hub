# Database Migration Instructions - URGENT

## Problem
You're getting this error when trying to add a technician:
```
column technicians.password_setup_token does not exist
```

This is because the database migrations haven't been run yet.

## Solution - Run These Migrations

You need to run **TWO** migration files in order:

### Step 1: Run First Migration
This adds the password setup and document submission fields to the technicians table and creates the technician_documents table.

**Windows (PowerShell):**
```powershell
# Replace with your actual Neon database connection string
$env:DATABASE_URL="your_neon_connection_string"
psql $env:DATABASE_URL -f migrations/20251211_add_technician_documents.sql
```

**Or using direct connection:**
```powershell
psql "postgresql://username:password@host/database?sslmode=require" -f migrations/20251211_add_technician_documents.sql
```

### Step 2: Run Second Migration
This updates the technician_documents table to support binary file storage.

```powershell
psql "your_connection_string" -f migrations/20251211_update_technician_documents_bytea.sql
```

## Alternative: Run via Neon Dashboard

If you don't have `psql` installed:

1. Go to your Neon dashboard: https://console.neon.tech/
2. Select your project
3. Go to "SQL Editor"
4. Copy and paste the contents of `migrations/20251211_add_technician_documents.sql`
5. Click "Run"
6. Then copy and paste the contents of `migrations/20251211_update_technician_documents_bytea.sql`
7. Click "Run"

## Verify Migrations Worked

After running the migrations, check that the columns exist:

```sql
-- Check technicians table has new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'technicians' 
  AND column_name IN ('password_setup_token', 'password_setup_token_expiry', 'documents_submitted');

-- Check technician_documents table exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'technician_documents';
```

You should see:
- `password_setup_token` (varchar)
- `password_setup_token_expiry` (timestamp)
- `documents_submitted` (boolean)

And the `technician_documents` table should have columns including `file_data` (bytea) and `content_type`.

## After Migration

Once migrations are complete:
1. Restart your server: `npm run dev`
2. Try adding a technician again
3. The error should be gone!

## Files to Run (in order)
1. `migrations/20251211_add_technician_documents.sql`
2. `migrations/20251211_update_technician_documents_bytea.sql`
