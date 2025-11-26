-- Travel auto planner support: multipliers, manual flags, uniqueness
BEGIN;

CREATE TABLE IF NOT EXISTS public.location_multipliers (
    city TEXT PRIMARY KEY,
    multiplier NUMERIC(6,3) NOT NULL DEFAULT 1.0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.technician_trip_costs
    ADD COLUMN IF NOT EXISTS travel_fare_is_manual BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS stay_cost_is_manual BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS daily_allowance_is_manual BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS local_travel_cost_is_manual BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS misc_cost_is_manual BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.technician_trip_tasks
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'auto',
    ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.technician_trip_tasks
    ADD CONSTRAINT technician_trip_tasks_trip_container_unique
        UNIQUE (trip_id, container_id);

COMMIT;

