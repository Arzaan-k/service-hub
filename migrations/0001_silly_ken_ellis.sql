CREATE TYPE "public"."booking_status" AS ENUM('not_started', 'tickets_booked', 'hotel_booked', 'all_confirmed');--> statement-breakpoint
CREATE TYPE "public"."courier_shipment_status" AS ENUM('pending', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'cancelled', 'returned');--> statement-breakpoint
CREATE TYPE "public"."pm_status_enum" AS ENUM('UP_TO_DATE', 'DUE_SOON', 'OVERDUE');--> statement-breakpoint
CREATE TYPE "public"."trip_purpose" AS ENUM('pm', 'breakdown', 'audit', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('planned', 'confirmed', 'booked', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."trip_task_status" AS ENUM('pending', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."trip_task_type" AS ENUM('pm', 'alert', 'inspection');--> statement-breakpoint
ALTER TYPE "public"."alert_source" ADD VALUE 'simulation';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'senior_technician';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'amc';--> statement-breakpoint
ALTER TYPE "public"."whatsapp_message_status" ADD VALUE 'received';--> statement-breakpoint
ALTER TYPE "public"."whatsapp_message_type" ADD VALUE 'image';--> statement-breakpoint
ALTER TYPE "public"."whatsapp_message_type" ADD VALUE 'video';--> statement-breakpoint
ALTER TYPE "public"."whatsapp_message_type" ADD VALUE 'document';--> statement-breakpoint
ALTER TYPE "public"."whatsapp_message_type" ADD VALUE 'audio';--> statement-breakpoint
CREATE TABLE "container_ownership_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"container_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"order_type" text NOT NULL,
	"quotation_no" text,
	"order_received_number" text,
	"internal_sales_order_no" text,
	"purchase_order_number" text,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"tenure" jsonb,
	"basic_amount" numeric(10, 2),
	"security_deposit" numeric(10, 2),
	"is_current" boolean DEFAULT true NOT NULL,
	"purchase_details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courier_shipments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_request_id" varchar NOT NULL,
	"awb_number" text NOT NULL,
	"courier_name" text NOT NULL,
	"courier_code" text,
	"shipment_description" text,
	"origin" text,
	"destination" text,
	"estimated_delivery_date" timestamp,
	"actual_delivery_date" timestamp,
	"status" "courier_shipment_status" DEFAULT 'pending' NOT NULL,
	"current_location" text,
	"tracking_history" jsonb,
	"last_tracked_at" timestamp,
	"raw_api_response" jsonb,
	"added_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "courier_shipments_awb_number_unique" UNIQUE("awb_number")
);
--> statement-breakpoint
CREATE TABLE "daily_summary_acknowledgment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"summary" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"acknowledged_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "inventory_indent_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"indent_id" varchar NOT NULL,
	"item_id" varchar NOT NULL,
	"part_name" text NOT NULL,
	"part_number" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2),
	"total_price" numeric(10, 2),
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_indents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"indent_number" text NOT NULL,
	"service_request_id" varchar,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"total_amount" numeric(10, 2),
	"remarks" text,
	"requested_by" varchar NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_indents_indent_number_unique" UNIQUE("indent_number")
);
--> statement-breakpoint
CREATE TABLE "location_multipliers" (
	"city" text PRIMARY KEY NOT NULL,
	"multiplier" numeric(6, 3) DEFAULT '1.000' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manual_chunks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manual_id" varchar NOT NULL,
	"chunk_text" text NOT NULL,
	"chunk_embedding_id" text,
	"embedding" vector(384),
	"page_num" integer,
	"start_offset" integer,
	"end_offset" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manuals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"source_url" text,
	"uploaded_by" varchar,
	"uploaded_on" timestamp DEFAULT now() NOT NULL,
	"version" text,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_by" varchar,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "rag_queries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"unit_id" varchar,
	"query_text" text NOT NULL,
	"response_text" text NOT NULL,
	"sources" jsonb,
	"confidence" text NOT NULL,
	"suggested_parts" jsonb,
	"context" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_report_pdfs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_request_id" varchar NOT NULL,
	"report_stage" varchar NOT NULL,
	"file_url" text,
	"pdf_data" "bytea",
	"file_size" integer,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"emailed_at" timestamp,
	"email_recipients" text[],
	"status" varchar DEFAULT 'generated'
);
--> statement-breakpoint
CREATE TABLE "service_request_recordings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_request_id" varchar NOT NULL,
	"remark_id" varchar,
	"uploaded_by" varchar,
	"uploaded_by_name" text NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"original_file_size" integer,
	"duration_seconds" integer,
	"mime_type" text,
	"is_compressed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_request_remarks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_request_id" varchar NOT NULL,
	"user_id" varchar,
	"user_name" text NOT NULL,
	"user_role" text NOT NULL,
	"remark_text" text NOT NULL,
	"is_system_generated" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technician_trip_costs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" varchar NOT NULL,
	"travel_fare" numeric(10, 2) DEFAULT '0.00',
	"travel_fare_is_manual" boolean DEFAULT false NOT NULL,
	"stay_cost" numeric(10, 2) DEFAULT '0.00',
	"stay_cost_is_manual" boolean DEFAULT false NOT NULL,
	"daily_allowance" numeric(10, 2) DEFAULT '0.00',
	"daily_allowance_is_manual" boolean DEFAULT false NOT NULL,
	"local_travel_cost" numeric(10, 2) DEFAULT '0.00',
	"local_travel_cost_is_manual" boolean DEFAULT false NOT NULL,
	"misc_cost" numeric(10, 2) DEFAULT '0.00',
	"misc_cost_is_manual" boolean DEFAULT false NOT NULL,
	"total_estimated_cost" numeric(10, 2) DEFAULT '0.00',
	"currency" text DEFAULT 'INR' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "technician_trip_costs_trip_id_unique" UNIQUE("trip_id")
);
--> statement-breakpoint
CREATE TABLE "technician_trip_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" varchar NOT NULL,
	"container_id" varchar NOT NULL,
	"site_name" text,
	"customer_id" varchar,
	"task_type" "trip_task_type" DEFAULT 'pm' NOT NULL,
	"priority" text DEFAULT 'normal',
	"scheduled_date" timestamp,
	"estimated_duration_hours" integer,
	"status" "trip_task_status" DEFAULT 'pending' NOT NULL,
	"service_request_id" varchar,
	"alert_id" varchar,
	"notes" text,
	"completed_at" timestamp,
	"source" text DEFAULT 'auto' NOT NULL,
	"is_manual" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technician_trips" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technician_id" varchar NOT NULL,
	"origin" text NOT NULL,
	"destination_city" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"daily_working_time_window" text,
	"purpose" "trip_purpose" DEFAULT 'pm' NOT NULL,
	"notes" text,
	"trip_status" "trip_status" DEFAULT 'planned' NOT NULL,
	"booking_status" "booking_status" DEFAULT 'not_started' NOT NULL,
	"ticket_reference" text,
	"hotel_reference" text,
	"booking_attachments" jsonb,
	"miscellaneous_amount" numeric(10, 2) DEFAULT '0.00',
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" DROP CONSTRAINT "alerts_service_request_id_service_requests_id_fk";
--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_service_request_id_service_requests_id_fk";
--> statement-breakpoint
ALTER TABLE "service_requests" DROP CONSTRAINT "service_requests_invoice_id_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "service_requests" DROP CONSTRAINT "service_requests_customer_feedback_id_feedback_id_fk";
--> statement-breakpoint
ALTER TABLE "containers" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "containers" ALTER COLUMN "status" SET DEFAULT 'active'::text;--> statement-breakpoint
DROP TYPE "public"."container_status";--> statement-breakpoint
CREATE TYPE "public"."container_status" AS ENUM('active', 'in_service', 'maintenance', 'retired', 'in_transit', 'stock', 'sold');--> statement-breakpoint
ALTER TABLE "containers" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."container_status";--> statement-breakpoint
ALTER TABLE "containers" ALTER COLUMN "status" SET DATA TYPE "public"."container_status" USING "status"::"public"."container_status";--> statement-breakpoint
ALTER TABLE "containers" ADD COLUMN "last_update_timestamp" timestamp;--> statement-breakpoint
ALTER TABLE "containers" ADD COLUMN "location_lat" numeric(10, 8);--> statement-breakpoint
ALTER TABLE "containers" ADD COLUMN "location_lng" numeric(11, 8);--> statement-breakpoint
ALTER TABLE "containers" ADD COLUMN "last_telemetry" jsonb;--> statement-breakpoint
ALTER TABLE "containers" ADD COLUMN "last_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "containers" ADD COLUMN "product_type" text;--> statement-breakpoint
ALTER TABLE "containers" ADD COLUMN "size_type" text;--> statement-breakpoint
ALTER TABLE "containers" ADD COLUMN "group_name" text;--> statement-breakpoint
ALTER TABLE "containers" ADD COLUMN "gku_product_name" text;--> statement-breakpoint
ALTER TABLE "containers" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "containers" ADD COLUMN "size" integer;--> statement-breakpoint
ALTER TABLE "containers" ADD COLUMN "depot" text;--> statement-breakpoint
ALTER TABLE "containers" ADD COLUMN "yom" integer;--> statement-breakpoint
ALTER TABLE "containers" ADD COLUMN "grade" text;--> statement-breakpoint
ALTER TABLE "containers" ADD COLUMN "reefer_unit" text;--> statement-breakpoint
ALTER TABLE "containers" ADD COLUMN "reefer_model" text;--> statement-breakpoint
ALTER TABLE "containers" ADD COLUMN "image_links" text;--> statement-breakpoint
ALTER TABLE "containers" ADD COLUMN "master_sheet_data" jsonb;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "job_order" text;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "location_proof_photos" text[];--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "videos" text[];--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "client_uploaded_photos" text[];--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "client_uploaded_videos" text[];--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "start_time" timestamp;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "end_time" timestamp;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "duration_minutes" integer;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "signed_document_url" text;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "vendor_invoice_url" text;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "technician_notes" text;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "work_type" text;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "client_type" text;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "job_type" text;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "billing_type" text;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "call_status" text;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "month" text;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "year" integer;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "excel_data" jsonb;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "inventory_order_id" text;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "inventory_order_number" text;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "inventory_order_created_at" timestamp;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "coordinator_remarks" text;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "remarks_added_by" varchar;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "remarks_added_at" timestamp;--> statement-breakpoint
ALTER TABLE "technicians" ADD COLUMN "grade" text;--> statement-breakpoint
ALTER TABLE "technicians" ADD COLUMN "designation" text;--> statement-breakpoint
ALTER TABLE "technicians" ADD COLUMN "hotel_allowance" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "technicians" ADD COLUMN "local_travel_allowance" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "technicians" ADD COLUMN "food_allowance" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "technicians" ADD COLUMN "personal_allowance" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "technicians" ADD COLUMN "service_request_cost" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "technicians" ADD COLUMN "pm_cost" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "technicians" ADD COLUMN "tasks_per_day" integer DEFAULT 3;--> statement-breakpoint
ALTER TABLE "technicians" ADD COLUMN "latitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "technicians" ADD COLUMN "longitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "technicians" ADD COLUMN "location_address" text;--> statement-breakpoint
ALTER TABLE "technicians" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "requires_password_reset" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_reminder_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "container_ownership_history" ADD CONSTRAINT "container_ownership_history_container_id_containers_id_fk" FOREIGN KEY ("container_id") REFERENCES "public"."containers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "container_ownership_history" ADD CONSTRAINT "container_ownership_history_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_shipments" ADD CONSTRAINT "courier_shipments_service_request_id_service_requests_id_fk" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_shipments" ADD CONSTRAINT "courier_shipments_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_indent_items" ADD CONSTRAINT "inventory_indent_items_indent_id_inventory_indents_id_fk" FOREIGN KEY ("indent_id") REFERENCES "public"."inventory_indents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_indent_items" ADD CONSTRAINT "inventory_indent_items_item_id_inventory_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_indents" ADD CONSTRAINT "inventory_indents_service_request_id_service_requests_id_fk" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_indents" ADD CONSTRAINT "inventory_indents_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_indents" ADD CONSTRAINT "inventory_indents_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_chunks" ADD CONSTRAINT "manual_chunks_manual_id_manuals_id_fk" FOREIGN KEY ("manual_id") REFERENCES "public"."manuals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manuals" ADD CONSTRAINT "manuals_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_queries" ADD CONSTRAINT "rag_queries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_queries" ADD CONSTRAINT "rag_queries_unit_id_containers_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."containers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_report_pdfs" ADD CONSTRAINT "service_report_pdfs_service_request_id_service_requests_id_fk" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_recordings" ADD CONSTRAINT "service_request_recordings_service_request_id_service_requests_id_fk" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_recordings" ADD CONSTRAINT "service_request_recordings_remark_id_service_request_remarks_id_fk" FOREIGN KEY ("remark_id") REFERENCES "public"."service_request_remarks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_recordings" ADD CONSTRAINT "service_request_recordings_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_remarks" ADD CONSTRAINT "service_request_remarks_service_request_id_service_requests_id_fk" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_remarks" ADD CONSTRAINT "service_request_remarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_trip_costs" ADD CONSTRAINT "technician_trip_costs_trip_id_technician_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."technician_trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_trip_tasks" ADD CONSTRAINT "technician_trip_tasks_trip_id_technician_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."technician_trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_trip_tasks" ADD CONSTRAINT "technician_trip_tasks_container_id_containers_id_fk" FOREIGN KEY ("container_id") REFERENCES "public"."containers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_trip_tasks" ADD CONSTRAINT "technician_trip_tasks_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_trip_tasks" ADD CONSTRAINT "technician_trip_tasks_service_request_id_service_requests_id_fk" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_trip_tasks" ADD CONSTRAINT "technician_trip_tasks_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_trips" ADD CONSTRAINT "technician_trips_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_trips" ADD CONSTRAINT "technician_trips_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_job_order_unique" UNIQUE("job_order");