-- Migration: Add Technician Travel Planning System
-- Date: 2025-11-25
-- Description: Creates tables for managing multi-day technician trips, costs, and auto-assigned PM tasks

-- Create enums for trip status and booking status
CREATE TYPE IF NOT EXISTS "trip_status" AS ENUM('planned', 'booked', 'in_progress', 'completed', 'cancelled');
CREATE TYPE IF NOT EXISTS "booking_status" AS ENUM('not_started', 'tickets_booked', 'hotel_booked', 'all_confirmed');
CREATE TYPE IF NOT EXISTS "trip_purpose" AS ENUM('pm', 'breakdown', 'audit', 'mixed');
CREATE TYPE IF NOT EXISTS "trip_task_type" AS ENUM('pm', 'alert', 'inspection');
CREATE TYPE IF NOT EXISTS "trip_task_status" AS ENUM('pending', 'in_progress', 'completed', 'cancelled');

-- Main technician_trips table
CREATE TABLE IF NOT EXISTS "technician_trips" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "technician_id" varchar NOT NULL REFERENCES "technicians"("id") ON DELETE CASCADE,
  "origin" text NOT NULL, -- Origin city/location (auto from technician base or configurable)
  "destination_city" text NOT NULL, -- Destination city/region (e.g., Chennai)
  "start_date" timestamp NOT NULL,
  "end_date" timestamp NOT NULL,
  "daily_working_time_window" text, -- Optional: e.g., "10:00-18:00"
  "purpose" "trip_purpose" NOT NULL DEFAULT 'pm',
  "notes" text, -- Free text instructions/notes
  "trip_status" "trip_status" NOT NULL DEFAULT 'planned',
  "booking_status" "booking_status" NOT NULL DEFAULT 'not_started',
  "ticket_reference" text, -- PNR, booking ID, links for tickets
  "hotel_reference" text, -- Hotel booking ID, links
  "booking_attachments" jsonb, -- Store file uploads/references as JSON
  "created_by" varchar REFERENCES "users"("id"), -- Admin/Scheduler who created the trip
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "technician_trips_dates_check" CHECK ("end_date" >= "start_date")
);

-- Trip costs table (one-to-one with trip)
CREATE TABLE IF NOT EXISTS "technician_trip_costs" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trip_id" varchar NOT NULL UNIQUE REFERENCES "technician_trips"("id") ON DELETE CASCADE,
  "travel_fare" decimal(10, 2) DEFAULT 0, -- Manual input: flight/train/bus amount
  "stay_cost" decimal(10, 2) DEFAULT 0, -- Auto: number of nights × hotel rate
  "daily_allowance" decimal(10, 2) DEFAULT 0, -- Auto: number of days × DA rate (from technician grade)
  "local_travel_cost" decimal(10, 2) DEFAULT 0, -- Auto: number of days × fixed local travel rate
  "misc_cost" decimal(10, 2) DEFAULT 0, -- Manual: miscellaneous costs
  "total_estimated_cost" decimal(10, 2) DEFAULT 0, -- Auto-calculated sum
  "currency" text DEFAULT 'INR' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Trip tasks table (auto-assigned PM jobs/containers for the trip)
CREATE TABLE IF NOT EXISTS "technician_trip_tasks" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trip_id" varchar NOT NULL REFERENCES "technician_trips"("id") ON DELETE CASCADE,
  "container_id" varchar REFERENCES "containers"("id") ON DELETE CASCADE,
  "site_name" text, -- Customer/site name
  "customer_id" varchar REFERENCES "customers"("id"),
  "task_type" "trip_task_type" NOT NULL DEFAULT 'pm',
  "priority" text DEFAULT 'normal', -- urgent, high, normal, low (reuse service_priority enum values)
  "scheduled_date" timestamp, -- Specific date within trip range for this task
  "estimated_duration_hours" integer, -- Estimated hours to complete
  "status" "trip_task_status" NOT NULL DEFAULT 'pending',
  "service_request_id" varchar REFERENCES "service_requests"("id"), -- Link to service request if created
  "alert_id" varchar REFERENCES "alerts"("id"), -- Link to alert if task is for alert resolution
  "notes" text, -- Task-specific notes
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_technician_trips_technician_id" ON "technician_trips"("technician_id");
CREATE INDEX IF NOT EXISTS "idx_technician_trips_dates" ON "technician_trips"("start_date", "end_date");
CREATE INDEX IF NOT EXISTS "idx_technician_trips_status" ON "technician_trips"("trip_status");
CREATE INDEX IF NOT EXISTS "idx_technician_trips_destination" ON "technician_trips"("destination_city");
CREATE INDEX IF NOT EXISTS "idx_trip_tasks_trip_id" ON "technician_trip_tasks"("trip_id");
CREATE INDEX IF NOT EXISTS "idx_trip_tasks_container_id" ON "technician_trip_tasks"("container_id");
CREATE INDEX IF NOT EXISTS "idx_trip_tasks_status" ON "technician_trip_tasks"("status");
CREATE INDEX IF NOT EXISTS "idx_trip_tasks_scheduled_date" ON "technician_trip_tasks"("scheduled_date");

-- Add comments for documentation
COMMENT ON TABLE "technician_trips" IS 'Multi-day technician trips for service scheduling and travel planning';
COMMENT ON TABLE "technician_trip_costs" IS 'Cost breakdown and estimation for technician trips';
COMMENT ON TABLE "technician_trip_tasks" IS 'Auto-assigned PM jobs and containers for technician trips';

COMMENT ON COLUMN "technician_trips"."origin" IS 'Origin city/location (auto from technician base_location or configurable)';
COMMENT ON COLUMN "technician_trips"."destination_city" IS 'Destination city/region where technician will work';
COMMENT ON COLUMN "technician_trips"."daily_working_time_window" IS 'Optional daily working hours (e.g., "10:00-18:00")';
COMMENT ON COLUMN "technician_trips"."ticket_reference" IS 'Travel ticket references (PNR, booking ID, links)';
COMMENT ON COLUMN "technician_trips"."hotel_reference" IS 'Hotel booking references (booking ID, links)';
COMMENT ON COLUMN "technician_trip_costs"."stay_cost" IS 'Auto-calculated: number of nights × hotel rate';
COMMENT ON COLUMN "technician_trip_costs"."daily_allowance" IS 'Auto-calculated: number of days × DA rate from technician grade';
COMMENT ON COLUMN "technician_trip_costs"."local_travel_cost" IS 'Auto-calculated: number of days × fixed local travel rate';
COMMENT ON COLUMN "technician_trip_costs"."total_estimated_cost" IS 'Auto-calculated sum of all cost components';
COMMENT ON COLUMN "technician_trip_tasks"."task_type" IS 'Type of task: PM (Preventive Maintenance), Alert resolution, or Inspection';
COMMENT ON COLUMN "technician_trip_tasks"."service_request_id" IS 'Link to service request if task creates/uses a service request';

