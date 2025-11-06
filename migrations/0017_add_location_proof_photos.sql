-- Add location_proof_photos column to service_requests table
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "location_proof_photos" text[];--> statement-breakpoint

-- Add comment for documentation
COMMENT ON COLUMN "service_requests"."location_proof_photos" IS 'Photos sent by technicians as proof of arrival at container location';