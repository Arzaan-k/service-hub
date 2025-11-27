CREATE TYPE pm_status_enum AS ENUM ('UP_TO_DATE', 'DUE_SOON', 'OVERDUE');

ALTER TABLE containers ADD COLUMN last_pm_date TIMESTAMP;

ALTER TABLE containers ADD COLUMN next_pm_due_date TIMESTAMP;

ALTER TABLE containers ADD COLUMN pm_frequency_days INTEGER DEFAULT 90;

ALTER TABLE containers ADD COLUMN pm_status pm_status_enum DEFAULT 'UP_TO_DATE';
