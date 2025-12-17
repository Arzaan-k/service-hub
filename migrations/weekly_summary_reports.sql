-- Weekly Summary Reports table for CAPA Reefer Reports
-- This table tracks weekly summary reports sent to CEO and Senior Technician
-- Used for idempotency to prevent duplicate reports for the same week

CREATE TABLE IF NOT EXISTS weekly_summary_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  week_identifier TEXT NOT NULL UNIQUE, -- e.g., "2025-W51" for idempotency
  summary JSONB NOT NULL,
  detailed_report TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT NOW() NOT NULL,
  sent_to JSONB NOT NULL, -- Array of recipient emails
  status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'failed'
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Index for faster lookups by week identifier
CREATE INDEX IF NOT EXISTS idx_weekly_summary_week_identifier ON weekly_summary_reports(week_identifier);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_weekly_summary_dates ON weekly_summary_reports(week_start_date, week_end_date);

-- Comment on table
COMMENT ON TABLE weekly_summary_reports IS 'Tracks weekly CAPA reports sent to CEO and Senior Technician for idempotency';
COMMENT ON COLUMN weekly_summary_reports.week_identifier IS 'ISO week identifier (e.g., 2025-W51) used to prevent duplicate reports';
COMMENT ON COLUMN weekly_summary_reports.detailed_report IS 'Full paragraph-format report text for CEO';
COMMENT ON COLUMN weekly_summary_reports.sent_to IS 'JSON array of recipient email addresses';

