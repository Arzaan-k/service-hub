-- Add currentLocation field to containers table if it doesn't exist
DO $$
BEGIN
    -- Check if current_location column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'containers' AND column_name = 'current_location'
    ) THEN
        ALTER TABLE "containers" ADD COLUMN "current_location" jsonb;
        RAISE NOTICE 'Added current_location column to containers table';
    ELSE
        RAISE NOTICE 'current_location column already exists';
    END IF;
END $$;
