require("dotenv").config();
const { Client } = require("pg");

const statements = [
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trip_status') THEN CREATE TYPE trip_status AS ENUM('planned','booked','in_progress','completed','cancelled'); END IF; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN CREATE TYPE booking_status AS ENUM('not_started','tickets_booked','hotel_booked','all_confirmed'); END IF; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trip_purpose') THEN CREATE TYPE trip_purpose AS ENUM('pm','breakdown','audit','mixed'); END IF; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trip_task_type') THEN CREATE TYPE trip_task_type AS ENUM('pm','alert','inspection'); END IF; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trip_task_status') THEN CREATE TYPE trip_task_status AS ENUM('pending','in_progress','completed','cancelled'); END IF; END $$`,
  `CREATE TABLE IF NOT EXISTS technician_trips (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    technician_id varchar NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
    origin text NOT NULL,
    destination_city text NOT NULL,
    start_date timestamp NOT NULL,
    end_date timestamp NOT NULL,
    daily_working_time_window text,
    purpose trip_purpose NOT NULL DEFAULT 'pm',
    notes text,
    trip_status trip_status NOT NULL DEFAULT 'planned',
    booking_status booking_status NOT NULL DEFAULT 'not_started',
    ticket_reference text,
    hotel_reference text,
    booking_attachments jsonb,
    created_by varchar REFERENCES users(id),
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL,
    CONSTRAINT technician_trips_dates_check CHECK (end_date >= start_date)
  )`,
  `CREATE TABLE IF NOT EXISTS technician_trip_costs (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id varchar NOT NULL UNIQUE REFERENCES technician_trips(id) ON DELETE CASCADE,
    travel_fare decimal(10,2) DEFAULT 0,
    stay_cost decimal(10,2) DEFAULT 0,
    daily_allowance decimal(10,2) DEFAULT 0,
    local_travel_cost decimal(10,2) DEFAULT 0,
    misc_cost decimal(10,2) DEFAULT 0,
    total_estimated_cost decimal(10,2) DEFAULT 0,
    currency text DEFAULT 'INR' NOT NULL,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS technician_trip_tasks (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id varchar NOT NULL REFERENCES technician_trips(id) ON DELETE CASCADE,
    container_id varchar REFERENCES containers(id) ON DELETE CASCADE,
    site_name text,
    customer_id varchar REFERENCES customers(id),
    task_type trip_task_type NOT NULL DEFAULT 'pm',
    priority text DEFAULT 'normal',
    scheduled_date timestamp,
    estimated_duration_hours integer,
    status trip_task_status NOT NULL DEFAULT 'pending',
    service_request_id varchar REFERENCES service_requests(id),
    alert_id varchar REFERENCES alerts(id),
    notes text,
    completed_at timestamp,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_technician_trips_technician_id ON technician_trips(technician_id)`,
  `CREATE INDEX IF NOT EXISTS idx_technician_trips_dates ON technician_trips(start_date, end_date)`,
  `CREATE INDEX IF NOT EXISTS idx_technician_trips_status ON technician_trips(trip_status)`,
  `CREATE INDEX IF NOT EXISTS idx_technician_trips_destination ON technician_trips(destination_city)`,
  `CREATE INDEX IF NOT EXISTS idx_trip_tasks_trip_id ON technician_trip_tasks(trip_id)`,
  `CREATE INDEX IF NOT EXISTS idx_trip_tasks_container_id ON technician_trip_tasks(container_id)`,
  `CREATE INDEX IF NOT EXISTS idx_trip_tasks_status ON technician_trip_tasks(status)`,
  `CREATE INDEX IF NOT EXISTS idx_trip_tasks_scheduled_date ON technician_trip_tasks(scheduled_date)`
];

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  for (const stmt of statements) {
    await client.query(stmt);
  }
  await client.end();
  console.log("Manual travel migration applied");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

