# 🚨 URGENT: Run Database Migration First

## The Error You're Seeing

```
❌ Error creating service request. Please contact support.
```

### Root Cause:
The database is missing required columns and enum values that were added in the recent technician flow implementation.

---

## ✅ STEP 1: Run This SQL (MANDATORY)

Open your Neon database console and run this SQL:

```sql
-- Fix 1: Add missing enum values for WhatsApp message types
ALTER TYPE whatsapp_message_type ADD VALUE IF NOT EXISTS 'image';
ALTER TYPE whatsapp_message_type ADD VALUE IF NOT EXISTS 'video';
ALTER TYPE whatsapp_message_type ADD VALUE IF NOT EXISTS 'document';
ALTER TYPE whatsapp_message_type ADD VALUE IF NOT EXISTS 'audio';

-- Fix 2: Add missing columns to service_requests table
ALTER TABLE service_requests 
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
ADD COLUMN IF NOT EXISTS signed_document_url TEXT,
ADD COLUMN IF NOT EXISTS vendor_invoice_url TEXT,
ADD COLUMN IF NOT EXISTS technician_notes TEXT,
ADD COLUMN IF NOT EXISTS videos TEXT[];

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_service_requests_technician_status 
ON service_requests(assigned_technician_id, status);

CREATE INDEX IF NOT EXISTS idx_service_requests_start_time 
ON service_requests(start_time DESC);

CREATE INDEX IF NOT EXISTS idx_service_requests_end_time 
ON service_requests(end_time DESC);
```

---

## ✅ STEP 2: Restart Your Server

```bash
# Stop the server (Ctrl+C)
npm run dev
```

---

## ✅ STEP 3: Test

1. Send "Hi" to your WhatsApp bot
2. Select "Client Mode"
3. Click "Request Service"
4. Follow the flow
5. Upload a photo
6. Type "DONE"
7. ✅ Should work now!

---

## What This Fixes:

### Error 1: `invalid input value for enum whatsapp_message_type: "image"`
- **Cause:** Database enum didn't include "image" type
- **Fix:** Added image, video, document, audio to enum

### Error 2: `column "start_time" of relation "service_requests" does not exist`
- **Cause:** Migration wasn't run
- **Fix:** Added all missing columns

### Error 3: Service request creation fails
- **Cause:** Missing `videos` column
- **Fix:** Added videos TEXT[] column

---

## After Running Migration:

Your client service request flow will work with:
- ✅ Photo uploads (mandatory)
- ✅ Video uploads (optional)
- ✅ Error code with auto-video when NA
- ✅ Container ID reference image
- ✅ Service request creation

---

**DO NOT PROCEED WITHOUT RUNNING THE SQL FIRST!**

The code changes are ready, but they depend on the database schema being updated.
