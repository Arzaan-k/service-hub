-- Add new telemetry fields to containers table for enhanced Orbcomm integration
ALTER TABLE "containers" ADD COLUMN "last_update_timestamp" timestamp;
ALTER TABLE "containers" ADD COLUMN "location_lat" decimal(10, 8);
ALTER TABLE "containers" ADD COLUMN "location_lng" decimal(11, 8);
ALTER TABLE "containers" ADD COLUMN "last_telemetry" jsonb;
ALTER TABLE "containers" ADD COLUMN "last_synced_at" timestamp;

-- Add comment explaining the new fields
COMMENT ON COLUMN "containers"."last_update_timestamp" IS 'Timestamp from Orbcomm data (orbcomm_data.timestamp)';
COMMENT ON COLUMN "containers"."location_lat" IS 'Latitude from latest Orbcomm telemetry';
COMMENT ON COLUMN "containers"."location_lng" IS 'Longitude from latest Orbcomm telemetry';
COMMENT ON COLUMN "containers"."last_telemetry" IS 'Full raw JSON from Orbcomm message (stored as JSONB)';
COMMENT ON COLUMN "containers"."last_synced_at" IS 'Timestamp when this container was last synced with Orbcomm data';
