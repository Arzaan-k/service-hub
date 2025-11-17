-- Fix WhatsApp message type enum to include image and video types
-- This migration adds 'image', 'video', 'document', and 'audio' to the whatsapp_message_type enum

-- First, check if the values already exist
DO $$
BEGIN
    -- Add 'image' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'image'
        AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'whatsapp_message_type'
        )
    ) THEN
        ALTER TYPE whatsapp_message_type ADD VALUE 'image';
        RAISE NOTICE 'Added "image" to whatsapp_message_type enum';
    ELSE
        RAISE NOTICE '"image" already exists in whatsapp_message_type enum';
    END IF;

    -- Add 'video' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'video'
        AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'whatsapp_message_type'
        )
    ) THEN
        ALTER TYPE whatsapp_message_type ADD VALUE 'video';
        RAISE NOTICE 'Added "video" to whatsapp_message_type enum';
    ELSE
        RAISE NOTICE '"video" already exists in whatsapp_message_type enum';
    END IF;

    -- Add 'document' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'document'
        AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'whatsapp_message_type'
        )
    ) THEN
        ALTER TYPE whatsapp_message_type ADD VALUE 'document';
        RAISE NOTICE 'Added "document" to whatsapp_message_type enum';
    ELSE
        RAISE NOTICE '"document" already exists in whatsapp_message_type enum';
    END IF;

    -- Add 'audio' if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'audio'
        AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'whatsapp_message_type'
        )
    ) THEN
        ALTER TYPE whatsapp_message_type ADD VALUE 'audio';
        RAISE NOTICE 'Added "audio" to whatsapp_message_type enum';
    ELSE
        RAISE NOTICE '"audio" already exists in whatsapp_message_type enum';
    END IF;
END$$;

-- Verify the enum values
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'whatsapp_message_type')
ORDER BY enumsortorder;
