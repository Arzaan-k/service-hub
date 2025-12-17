# Service Summary Email System - Environment Variables

This document describes the environment variables used to configure the automated service summary email system (Daily & Weekly).

## Email Scheduling Configuration

Add these variables to your `.env` file to configure the service summary email workflow:

```env
# =============================================================================
# SERVICE SUMMARY EMAIL SCHEDULER CONFIGURATION
# =============================================================================

# Time to pre-fetch service history data (HH:MM format, 24-hour)
# Default: 05:55 (5 minutes before email send time)
# Purpose: Cache data to avoid repeated database queries during email generation
SERVICE_HISTORY_FETCH_TIME=05:55

# Time to send daily service summary email to expert technician (HH:MM format, 24-hour)
# Default: 06:00 (6:00 AM)
SERVICE_SUMMARY_EMAIL_TIME=06:00

# Time to escalate to CEO if no acknowledgment received (HH:MM format, 24-hour)
# Default: 12:00 (12:00 PM / Noon)
CEO_ESCALATION_TIME=12:00

# Expert technician email to receive daily service summary
# This person must acknowledge the summary before the escalation time
EXPERT_TECHNICIAN_EMAIL=chavandhiksha212@gmail.com

# CEO email for escalation notifications and weekly CAPA reports
# Will receive notification if expert technician doesn't acknowledge by deadline
CEO_EMAIL=chavandhiksha2003@gmail.com

# Frontend URL for acknowledgment links (used in email buttons)
# Should be your production domain
FRONTEND_URL=https://service-hub-uvfw.onrender.com

# =============================================================================
# WEEKLY CAPA REPORT CONFIGURATION (Reefer Service Operations)
# =============================================================================

# Time to send weekly CAPA report (HH:MM format, 24-hour)
# Default: 13:00 (1:00 PM IST)
WEEKLY_SUMMARY_TIME=13:00

# Day of week to send weekly report (0=Sunday, 1=Monday, ..., 5=Friday, 6=Saturday)
# Default: 5 (Friday)
WEEKLY_SUMMARY_DAY=5
```

## Implementation Flow

The system works as follows:

1. **5:55 AM (configurable)**: Pre-fetch and cache service history data
   - Fetches previous day's service requests
   - Caches customer and container information
   - Caches technician performance data
   - Avoids repeated database queries

2. **6:00 AM (configurable)**: Send service summary email
   - Uses cached data from prefetch
   - Sends to `EXPERT_TECHNICIAN_EMAIL`
   - Includes acknowledgment button/link
   - Records in `daily_summary_acknowledgment` table with status 'pending'

3. **Before 12:00 PM**: Expert technician acknowledges
   - Clicks acknowledgment link in email
   - Status updates to 'acknowledged'
   - CEO receives notification of acknowledgment

4. **12:00 PM (configurable)**: Escalation check
   - If status is still 'pending', CEO is notified
   - Expert technician receives reminder

## API Endpoints

The following API endpoints are available for scheduler management:

### Get Scheduler Status
```
GET /api/summary/scheduler/status
```
Returns current scheduler configuration and cache status.

### Trigger Prefetch (Admin Only)
```
POST /api/summary/scheduler/trigger-prefetch
```
Manually trigger service history prefetch.

### Trigger Email Send (Admin Only)
```
POST /api/summary/scheduler/trigger-email
```
Manually trigger the daily summary email.

### Trigger Escalation Check (Admin Only)
```
POST /api/summary/scheduler/trigger-escalation
```
Manually trigger the escalation check.

### Clear Cache (Admin Only)
```
POST /api/summary/scheduler/clear-cache
```
Clear the cached service history data.

## Database Table

The system uses the `daily_summary_acknowledgment` table:

```sql
CREATE TABLE IF NOT EXISTS daily_summary_acknowledgment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  summary JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  acknowledged_at TIMESTAMP NULL
);
```

## Benefits of This Implementation

1. **No Repeated Queries**: Service history is fetched once at 5:55 AM and cached
2. **Configurable Timing**: All times can be adjusted via environment variables
3. **Manual Testing**: Admin endpoints allow manual triggering for testing
4. **Escalation Workflow**: Automatic CEO notification if not acknowledged
5. **Detailed Summaries**: Includes technician performance and recent requests

## Example Configuration for Different Timezones

### IST (India Standard Time)
```env
SERVICE_HISTORY_FETCH_TIME=05:55
SERVICE_SUMMARY_EMAIL_TIME=06:00
CEO_ESCALATION_TIME=12:00
```

### EST (US Eastern)
```env
SERVICE_HISTORY_FETCH_TIME=07:55
SERVICE_SUMMARY_EMAIL_TIME=08:00
CEO_ESCALATION_TIME=14:00
```

### For Testing (every few minutes)
```env
# WARNING: Only for testing - DO NOT use in production
SERVICE_HISTORY_FETCH_TIME=14:55
SERVICE_SUMMARY_EMAIL_TIME=15:00
CEO_ESCALATION_TIME=15:05
```

---

## Weekly CAPA Report (Reefer Service Operations)

The weekly CAPA report is a comprehensive summary sent to the CEO and Senior Technician every Friday at 1:00 PM IST (configurable).

### Features

1. **Detailed Paragraph Format**: The report is written in a professional paragraph format suitable for executive review
2. **Full Week Data**: Aggregates all service requests from Monday to Friday of the current week
3. **Idempotent**: Uses `weekly_summary_reports` table to prevent duplicate emails for the same week
4. **Real-time Data**: Fetches actual data from the database at the time of sending
5. **Technician Performance**: Includes completion rates and task assignments per technician
6. **Delayed Alerts**: Highlights overdue service requests requiring attention

### Report Contents

The weekly CAPA report includes:

- **Executive Summary**: High-level overview of the week's operations
- **Key Performance Metrics**: Total requests, completion rate, on-time delivery rate
- **Technician Performance Table**: Individual technician statistics
- **Delayed Requests Alert**: List of overdue service requests
- **Completed Work Summary**: Successfully resolved requests
- **Recommendations**: Action items based on performance data

### Environment Variables

```env
# Time to send weekly summary (HH:MM format, 24-hour)
# Default: 13:00 (1:00 PM)
WEEKLY_SUMMARY_TIME=13:00

# Day of week (0=Sunday, 5=Friday)
# Default: 5 (Friday)
WEEKLY_SUMMARY_DAY=5

# Recipients (shared with daily summary)
EXPERT_TECHNICIAN_EMAIL=chavandhiksha212@gmail.com
CEO_EMAIL=chavandhiksha2003@gmail.com
```

### API Endpoints

```
GET /api/summary/weekly/status
```
Returns current weekly scheduler configuration.

```
POST /api/summary/weekly/trigger
```
Manually trigger the weekly summary email (Admin only). Useful for testing.

### Database Table

The system uses the `weekly_summary_reports` table:

```sql
CREATE TABLE IF NOT EXISTS weekly_summary_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  week_identifier TEXT NOT NULL UNIQUE, -- e.g., "2025-W51"
  summary JSONB NOT NULL,
  detailed_report TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT NOW() NOT NULL,
  sent_to JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

### Idempotency

The `week_identifier` column (e.g., "2025-W51") ensures that only one report is sent per week. If the scheduler runs multiple times on the same Friday, subsequent runs will be skipped.

### Example Weekly Report Email

The email includes:

1. **Header**: Week period and generation timestamp
2. **Executive Summary Box**: Paragraph summarizing operations
3. **Metrics Grid**: Visual cards showing key numbers
4. **Detailed Table**: Breakdown of all metrics
5. **Delayed Requests Alert**: Orange warning box if any delays
6. **Technician Table**: Performance by technician
7. **Recommendations**: Green box with actionable items

### Testing the Weekly Report

To test the weekly report without waiting for Friday:

1. Change the day temporarily:
   ```env
   WEEKLY_SUMMARY_DAY=2  # Tuesday
   WEEKLY_SUMMARY_TIME=14:30
   ```

2. Or use the API endpoint:
   ```bash
   curl -X POST http://localhost:5000/api/summary/weekly/trigger
   ```

**Note**: The idempotency check uses the week identifier. To re-test for the same week, you'll need to delete the record from `weekly_summary_reports` table.

