CREATE TYPE "public"."alert_severity" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."alert_source" AS ENUM('orbcomm', 'manual', 'predictive');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('open', 'acknowledged', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('error', 'warning', 'info', 'temperature', 'power', 'connectivity', 'door', 'system');--> statement-breakpoint
CREATE TYPE "public"."container_status" AS ENUM('active', 'in_service', 'maintenance', 'retired', 'in_transit', 'for_sale', 'sold');--> statement-breakpoint
CREATE TYPE "public"."container_type" AS ENUM('refrigerated', 'dry', 'special', 'iot_enabled', 'manual');--> statement-breakpoint
CREATE TYPE "public"."customer_status" AS ENUM('active', 'inactive', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."customer_tier" AS ENUM('premium', 'standard', 'basic');--> statement-breakpoint
CREATE TYPE "public"."feedback_rating" AS ENUM('1', '2', '3', '4', '5');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('pending', 'partially_paid', 'paid', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_terms" AS ENUM('prepaid', 'net15', 'net30');--> statement-breakpoint
CREATE TYPE "public"."resolution_method" AS ENUM('auto', 'service', 'diy', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."scheduled_service_status" AS ENUM('scheduled', 'in_progress', 'completed', 'rescheduled', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."service_priority" AS ENUM('urgent', 'high', 'normal', 'low');--> statement-breakpoint
CREATE TYPE "public"."service_status" AS ENUM('pending', 'approved', 'scheduled', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."technician_status" AS ENUM('available', 'on_duty', 'busy', 'off_duty');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'client', 'technician', 'coordinator', 'super_admin');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_message_status" AS ENUM('sent', 'delivered', 'read', 'failed');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_message_type" AS ENUM('text', 'template', 'interactive', 'media', 'flow');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_recipient_type" AS ENUM('customer', 'technician', 'admin');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_code" text NOT NULL,
	"container_id" varchar NOT NULL,
	"alert_type" "alert_type" DEFAULT 'error' NOT NULL,
	"severity" "alert_severity" DEFAULT 'medium' NOT NULL,
	"source" "alert_source" DEFAULT 'manual' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"ai_classification" jsonb,
	"error_code" text,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp,
	"acknowledged_by" varchar,
	"resolved_at" timestamp,
	"resolution_method" "resolution_method",
	"service_request_id" varchar,
	"resolution_steps" text[],
	"required_parts" text[],
	"estimated_service_time" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"changes" jsonb,
	"source" text NOT NULL,
	"ip_address" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "container_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"container_id" varchar NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"location" jsonb,
	"temperature" numeric(5, 2),
	"humidity" numeric(5, 2),
	"power_status" text NOT NULL,
	"door_status" text NOT NULL,
	"battery_level" numeric(5, 2),
	"signal_strength" integer,
	"error_codes" text NOT NULL,
	"raw_data" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "containers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"container_id" text NOT NULL,
	"type" "container_type" DEFAULT 'dry' NOT NULL,
	"manufacturer" text,
	"model" text,
	"capacity" text,
	"status" "container_status" DEFAULT 'active' NOT NULL,
	"has_iot" boolean DEFAULT false NOT NULL,
	"orbcomm_device_id" text,
	"current_location" jsonb,
	"assigned_client_id" varchar,
	"assignment_date" timestamp,
	"expected_return_date" timestamp,
	"manufacturing_date" timestamp,
	"purchase_date" timestamp,
	"last_sync_time" timestamp,
	"health_score" integer,
	"usage_cycles" integer,
	"excel_metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "containers_container_id_unique" UNIQUE("container_id")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"company_name" text NOT NULL,
	"contact_person" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"whatsapp_number" text NOT NULL,
	"customer_tier" "customer_tier" DEFAULT 'standard' NOT NULL,
	"payment_terms" "payment_terms" DEFAULT 'net30' NOT NULL,
	"billing_address" text NOT NULL,
	"shipping_address" text,
	"gstin" text,
	"account_manager_id" varchar,
	"status" "customer_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customers_email_unique" UNIQUE("email"),
	CONSTRAINT "customers_phone_unique" UNIQUE("phone"),
	CONSTRAINT "customers_whatsapp_number_unique" UNIQUE("whatsapp_number")
);
--> statement-breakpoint
CREATE TABLE "email_verifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_request_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"technician_id" varchar NOT NULL,
	"rating" "feedback_rating" NOT NULL,
	"feedback_text" text,
	"quick_feedback_tags" jsonb NOT NULL,
	"issue_resolved" boolean NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"follow_up_required" boolean DEFAULT false NOT NULL,
	"follow_up_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"part_number" text NOT NULL,
	"part_name" text NOT NULL,
	"category" text NOT NULL,
	"quantity_in_stock" integer NOT NULL,
	"reorder_level" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"location" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_part_number_unique" UNIQUE("part_number")
);
--> statement-breakpoint
CREATE TABLE "inventory_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" varchar NOT NULL,
	"type" text NOT NULL,
	"quantity" integer NOT NULL,
	"reason" text NOT NULL,
	"reference" text,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"service_request_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"issue_date" timestamp DEFAULT now() NOT NULL,
	"due_date" timestamp NOT NULL,
	"line_items" jsonb NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"tax_rate" numeric(5, 2) NOT NULL,
	"tax_amount" numeric(10, 2) NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"payment_status" "invoice_status" DEFAULT 'pending' NOT NULL,
	"amount_paid" numeric(10, 2) DEFAULT '0.00',
	"payment_date" timestamp,
	"payment_method" text,
	"payment_reference" text,
	"pdf_url" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "scheduled_services" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_request_id" varchar NOT NULL,
	"technician_id" varchar NOT NULL,
	"scheduled_date" timestamp NOT NULL,
	"sequence_number" integer NOT NULL,
	"estimated_start_time" timestamp NOT NULL,
	"estimated_end_time" timestamp NOT NULL,
	"estimated_travel_time" integer NOT NULL,
	"estimated_service_duration" integer NOT NULL,
	"route_order" integer NOT NULL,
	"total_distance" numeric(10, 2) NOT NULL,
	"optimization_score" numeric(5, 2) NOT NULL,
	"status" "scheduled_service_status" DEFAULT 'scheduled' NOT NULL,
	"actual_start_time" timestamp,
	"actual_end_time" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_number" text NOT NULL,
	"container_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"alert_id" varchar,
	"assigned_technician_id" varchar,
	"priority" "service_priority" DEFAULT 'normal' NOT NULL,
	"status" "service_status" DEFAULT 'pending' NOT NULL,
	"issue_description" text NOT NULL,
	"required_parts" text[],
	"estimated_duration" integer,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp,
	"scheduled_date" timestamp,
	"scheduled_time_window" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"service_duration" integer,
	"service_notes" text,
	"used_parts" text[],
	"total_cost" numeric(10, 2),
	"invoice_id" varchar,
	"customer_feedback_id" varchar,
	"before_photos" text[],
	"after_photos" text[],
	"client_approval_required" boolean,
	"client_approved_at" timestamp,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_requests_request_number_unique" UNIQUE("request_number")
);
--> statement-breakpoint
CREATE TABLE "technicians" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"tech_number" text NOT NULL,
	"experience_level" text NOT NULL,
	"skills" text[] NOT NULL,
	"home_location" jsonb,
	"service_areas" text[],
	"status" "technician_status" DEFAULT 'available' NOT NULL,
	"average_rating" integer,
	"total_jobs" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "technicians_tech_number_unique" UNIQUE("tech_number")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_number" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"role" "user_role" DEFAULT 'client' NOT NULL,
	"password" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"whatsapp_verified" boolean DEFAULT false NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_type" "whatsapp_recipient_type" NOT NULL,
	"recipient_id" varchar NOT NULL,
	"phone_number" text NOT NULL,
	"message_type" "whatsapp_message_type" NOT NULL,
	"template_name" text,
	"message_content" jsonb NOT NULL,
	"whatsapp_message_id" text NOT NULL,
	"status" "whatsapp_message_status" DEFAULT 'sent' NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp,
	"read_at" timestamp,
	"failed_reason" text,
	"conversation_id" varchar,
	"related_entity_type" text,
	"related_entity_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_messages_whatsapp_message_id_unique" UNIQUE("whatsapp_message_id")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_number" text NOT NULL,
	"user_id" varchar,
	"conversation_state" jsonb,
	"last_message_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_container_id_containers_id_fk" FOREIGN KEY ("container_id") REFERENCES "public"."containers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_service_request_id_service_requests_id_fk" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "container_metrics" ADD CONSTRAINT "container_metrics_container_id_containers_id_fk" FOREIGN KEY ("container_id") REFERENCES "public"."containers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "containers" ADD CONSTRAINT "containers_assigned_client_id_customers_id_fk" FOREIGN KEY ("assigned_client_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_account_manager_id_users_id_fk" FOREIGN KEY ("account_manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_service_request_id_service_requests_id_fk" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_item_id_inventory_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_service_request_id_service_requests_id_fk" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_services" ADD CONSTRAINT "scheduled_services_service_request_id_service_requests_id_fk" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_services" ADD CONSTRAINT "scheduled_services_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_container_id_containers_id_fk" FOREIGN KEY ("container_id") REFERENCES "public"."containers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_client_id_customers_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_assigned_technician_id_technicians_id_fk" FOREIGN KEY ("assigned_technician_id") REFERENCES "public"."technicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_customer_feedback_id_feedback_id_fk" FOREIGN KEY ("customer_feedback_id") REFERENCES "public"."feedback"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technicians" ADD CONSTRAINT "technicians_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_conversation_id_whatsapp_sessions_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."whatsapp_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_sessions" ADD CONSTRAINT "whatsapp_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;