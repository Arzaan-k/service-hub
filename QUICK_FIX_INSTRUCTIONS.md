# Quick Fix for WhatsApp Errors

## Problem
You're seeing two errors:
1. `invalid input value for enum whatsapp_message_type: "image"`
2. `column "start_time" of relation "service_requests" does not exist`

## Solution

### Option 1: Run PowerShell Script (Easiest)
```powershell
cd c:\Users\msi user\Desktop\SERVICE\service-hub-ui
.\run-fix-migration.ps1
```

### Option 2: Run SQL Directly in Database Console

1. Open your Neon database console at https://console.neon.tech
2. Navigate to your project
3. Click "SQL Editor"
4. Copy and paste this SQL:

```sql
-- Fix 1: Add missing enum values
ALTER TYPE whatsapp_message_type ADD VALUE IF NOT EXISTS 'image';
ALTER TYPE whatsapp_message_type ADD VALUE IF NOT EXISTS 'video';
ALTER TYPE whatsapp_message_type ADD VALUE IF NOT EXISTS 'document';
ALTER TYPE whatsapp_message_type ADD VALUE IF NOT EXISTS 'audio';

-- Fix 2: Add missing columns
ALTER TABLE service_requests 
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
ADD COLUMN IF NOT EXISTS signed_document_url TEXT,
ADD COLUMN IF NOT EXISTS vendor_invoice_url TEXT,
ADD COLUMN IF NOT EXISTS technician_notes TEXT;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_service_requests_technician_status 
ON service_requests(assigned_technician_id, status);

CREATE INDEX IF NOT EXISTS idx_service_requests_start_time 
ON service_requests(start_time DESC);

CREATE INDEX IF NOT EXISTS idx_service_requests_end_time 
ON service_requests(end_time DESC);
```

5. Click "Run" or press Ctrl+Enter

### Option 3: Use psql Command Line
```bash
# Replace with your actual DATABASE_URL from .env
psql "your-database-url-here" -f fix-whatsapp-errors.sql
```

## After Running Migration

1. **Restart your server:**
   ```bash
   # Stop the current server (Ctrl+C)
   npm run dev
   ```

2. **Test the flow again:**
   - Send a photo in WhatsApp
   - Type "DONE"
   - Service request should be created successfully

## Verification

After running the migration, you can verify it worked by running this SQL:

```sql
-- Check enum values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'whatsapp_message_type'::regtype
ORDER BY enumsortorder;

-- Check new columns
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'service_requests'
AND column_name IN ('start_time', 'end_time', 'duration_minutes');
```

You should see:
- Enum values: text, template, interactive, media, flow, **image**, **video**, **document**, **audio**
- Columns: start_time (timestamp), end_time (timestamp), duration_minutes (integer)

## What Was Fixed

### 1. WhatsApp Message Type Enum
**Before:** Only had `text`, `template`, `interactive`, `media`, `flow`
**After:** Added `image`, `video`, `document`, `audio`

**Why:** WhatsApp API sends `type: "image"` for photos, but the database enum didn't include it.

### 2. Service Requests Columns
**Added:**
- `start_time` - When technician starts service
- `end_time` - When technician completes service
- `duration_minutes` - Calculated duration
- `signed_document_url` - Client signature
- `vendor_invoice_url` - Third-party invoice
- `technician_notes` - Additional notes

**Why:** These columns are required for the technician WhatsApp flow to store service completion data.

## Files Modified

1. `shared/schema.ts` - Updated enum definition
2. `fix-whatsapp-errors.sql` - Migration SQL
3. `run-fix-migration.ps1` - PowerShell script to run migration

## No Code Changes Needed

The WhatsApp flow code is already correct. It was just waiting for the database schema to be updated.

---

**Status:** Ready to run migration
**Impact:** Fixes both errors, enables photo uploads and service request creation
**Downtime:** None (migration is non-breaking)
