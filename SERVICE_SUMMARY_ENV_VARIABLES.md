# Service Summary Email System - Environment Variables

This document describes the environment variables used to configure the automated service summary email system.

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

# CEO email for escalation notifications
# Will receive notification if expert technician doesn't acknowledge by deadline
CEO_EMAIL=ceo@yourcompany.com

# Frontend URL for acknowledgment links (used in email buttons)
# Should be your production domain
FRONTEND_URL=https://service-hub-uvfw.onrender.com
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

