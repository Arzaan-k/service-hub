-- Rename enum value 'for_sale' -> 'stock' if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'container_status'
      AND e.enumlabel = 'for_sale'
  ) THEN
    ALTER TYPE "public"."container_status" RENAME VALUE 'for_sale' TO 'stock';
  END IF;
END $$;

-- Update any lingering rows that might still be using text casting or mismatched values
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'container_status'
      AND e.enumlabel = 'stock'
  ) THEN
    UPDATE "public"."containers" SET "status" = 'stock'::container_status
    WHERE ("status"::text = 'for_sale');
  END IF;
END $$;
