-- Migration: Update service request IDs to MMMXXX format (e.g., NOV081)
-- This migration converts old SR-{timestamp} format to new job order format

-- Step 1: Add column to preserve old request numbers for reference
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS old_request_number TEXT;

-- Step 2: Backup current request numbers
UPDATE service_requests 
SET old_request_number = request_number 
WHERE old_request_number IS NULL AND request_number IS NOT NULL;

-- Step 3: Create a function to generate new IDs based on creation date
-- This assigns sequential numbers within each month, ordered by created_at

DO $$
DECLARE
    rec RECORD;
    current_month TEXT := '';
    current_year INT := 0;
    seq_num INT := 0;
    new_id TEXT;
    month_names TEXT[] := ARRAY['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
BEGIN
    -- Process all service requests ordered by creation date
    FOR rec IN 
        SELECT id, created_at, request_number, job_order
        FROM service_requests 
        WHERE request_number LIKE 'SR-%' OR request_number LIKE 'SR-%'
        ORDER BY created_at ASC
    LOOP
        -- Get month abbreviation and year
        DECLARE
            month_abbr TEXT := month_names[EXTRACT(MONTH FROM rec.created_at)::INT];
            year_val INT := EXTRACT(YEAR FROM rec.created_at)::INT;
        BEGIN
            -- Reset sequence if month/year changed
            IF month_abbr != current_month OR year_val != current_year THEN
                current_month := month_abbr;
                current_year := year_val;
                
                -- Find the highest existing sequence for this month/year
                SELECT COALESCE(MAX(SUBSTRING(request_number FROM 4)::INT), 0) INTO seq_num
                FROM service_requests
                WHERE request_number LIKE month_abbr || '%'
                  AND EXTRACT(YEAR FROM created_at) = year_val
                  AND request_number !~ '^SR-';
            END IF;
            
            -- Increment sequence
            seq_num := seq_num + 1;
            
            -- Generate new ID (e.g., NOV001, NOV002)
            new_id := month_abbr || LPAD(seq_num::TEXT, 3, '0');
            
            -- Update the record
            UPDATE service_requests 
            SET request_number = new_id,
                job_order = COALESCE(job_order, new_id)
            WHERE id = rec.id;
            
            RAISE NOTICE 'Updated % -> %', rec.request_number, new_id;
        END;
    END LOOP;
END $$;

-- Step 4: Verify the migration
SELECT 
    request_number as new_id,
    old_request_number as old_id,
    job_order,
    created_at
FROM service_requests 
ORDER BY created_at DESC
LIMIT 20;
