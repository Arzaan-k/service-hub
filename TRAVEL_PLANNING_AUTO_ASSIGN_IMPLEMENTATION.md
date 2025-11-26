# Travel Planning Auto-Assign Tasks Implementation

## Overview
This implementation adds automatic assignment of PM (Preventive Maintenance) jobs and container tasks to technician trips based on destination city and date range.

## What Was Implemented

### 1. Service Function: `generateTripTasksForDestination`
**File:** `server/services/travel-planning.ts`

This function automatically finds and assigns relevant container tasks to a technician trip:

#### Logic Flow:
1. **Fetches trip details** - Gets destination city, start date, and end date
2. **Queries containers in destination** - Finds containers by matching `depot` field (case-insensitive partial match)
3. **Checks for PM due/overdue**:
   - Queries last service date from:
     - Completed service requests (`service_requests` table)
     - Service history table (`service_history` table, if available)
   - Calculates if PM is due within trip date range (default: 6 months/180 days interval)
   - Marks containers as needing PM if:
     - No service history exists
     - PM due date falls within trip date range
     - PM is overdue (past due date)
4. **Finds containers with open alerts**:
   - Queries `alerts` table for unresolved alerts (`resolved_at IS NULL`)
   - Creates tasks with priority based on alert severity
5. **Finds containers with pending service requests**:
   - Queries `service_requests` with status: `pending`, `approved`, or `scheduled`
   - Creates inspection tasks linked to service requests
6. **Creates trip tasks** (idempotent):
   - Checks existing tasks to avoid duplicates
   - Only creates tasks for containers not already assigned to the trip
   - Links tasks to containers, customers, alerts, and service requests

#### Idempotency:
- Checks `existingContainerIds` set before creating any task
- Uses `trip_id + container_id` as unique identifier
- Safe to call multiple times - won't create duplicate tasks

### 2. API Endpoint
**POST** `/api/scheduling/travel/trips/:id/auto-assign-tasks`

**Authentication:** Required (Admin/Coordinator roles only)

**Request:**
```bash
POST /api/scheduling/travel/trips/trip-123/auto-assign-tasks
Headers: x-user-id: user-123
```

**Response:** 200 OK
```json
{
  "message": "Auto-assigned 15 tasks",
  "createdTasks": 15,
  "totalTasks": 15,
  "tasks": [
    {
      "id": "task-1",
      "tripId": "trip-123",
      "containerId": "container-456",
      "siteName": "ABC Corp",
      "taskType": "pm",
      "priority": "normal",
      "status": "pending",
      "notes": "PM due on 2025-12-15"
    },
    {
      "id": "task-2",
      "tripId": "trip-123",
      "containerId": "container-789",
      "siteName": "XYZ Ltd",
      "taskType": "alert",
      "priority": "urgent",
      "status": "pending",
      "alertId": "alert-123",
      "notes": "Open alert: Temperature anomaly"
    }
  ]
}
```

**Error Responses:**
- `404` - Trip not found
- `500` - Server error with details

## Key Features

### 1. Smart Container Matching
- Matches containers by `depot` field (case-insensitive)
- Also checks `excelMetadata` for location/depot information
- Supports partial city name matching (e.g., "Chennai" matches "Chennai Depot")

### 2. PM Due Date Calculation
- **Default PM Interval:** 180 days (6 months)
- **PM Detection:**
  - No service history → PM due
  - Last service + 180 days ≤ trip end date → PM due
  - Last service + 180 days < today → PM overdue

### 3. Task Priority Assignment
- **PM Tasks:** 
  - `normal` if due within trip range
  - `high` if overdue
- **Alert Tasks:**
  - `urgent` for critical alerts
  - `high` for high severity alerts
  - `normal` for medium/low alerts
- **Service Request Tasks:**
  - Uses service request priority

### 4. Task Type Classification
- `pm` - Preventive Maintenance
- `alert` - Alert resolution
- `inspection` - Service request inspection

### 5. Automatic Linking
- Links to `container_id`
- Links to `customer_id` (from container assignment)
- Links to `alert_id` (for alert tasks)
- Links to `service_request_id` (for service request tasks)

## Data Sources (Read-Only)

The function **only reads** from existing data and does not modify:
- ✅ `containers` table - For location matching
- ✅ `service_requests` table - For last service date and pending requests
- ✅ `service_history` table - For historical service dates (if available)
- ✅ `alerts` table - For open alerts
- ✅ `customers` table - For site/customer names

**No destructive operations** - All queries are SELECT statements.

## Usage Example

```typescript
// 1. Create a trip
const trip = await storage.createTechnicianTrip({
  technicianId: 'tech-123',
  origin: 'Mumbai',
  destinationCity: 'Chennai',
  startDate: new Date('2025-12-01'),
  endDate: new Date('2025-12-05'),
});

// 2. Auto-assign tasks
const { generateTripTasksForDestination } = await import('./services/travel-planning');
const tasks = await generateTripTasksForDestination(trip.id);

// 3. Tasks are now linked to the trip
const tripWithTasks = await storage.getTechnicianTrip(trip.id);
const allTasks = await storage.getTechnicianTripTasks(trip.id);
```

## Configuration

### PM Interval
The PM interval (default: 180 days) can be adjusted in `server/services/travel-planning.ts`:

```typescript
const PM_INTERVAL_DAYS = 180; // Change this value as needed
```

## Error Handling

- **Trip not found:** Returns error immediately
- **No containers found:** Returns empty array (not an error)
- **Service history unavailable:** Falls back to service requests only
- **Database errors:** Caught and logged, returns error response

## Testing

To test the auto-assignment:

1. **Create a trip:**
```bash
POST /api/scheduling/travel/trips
{
  "technicianId": "tech-123",
  "destinationCity": "Chennai",
  "startDate": "2025-12-01T00:00:00Z",
  "endDate": "2025-12-05T00:00:00Z"
}
```

2. **Auto-assign tasks:**
```bash
POST /api/scheduling/travel/trips/{tripId}/auto-assign-tasks
```

3. **Verify tasks:**
```bash
GET /api/scheduling/travel/trips/{tripId}
# Response includes tasks array
```

## Files Modified

1. **server/services/travel-planning.ts** - New service file with auto-assignment logic
2. **server/routes.ts** - Added POST route for auto-assign-tasks

## Notes

- ✅ **Idempotent:** Safe to call multiple times
- ✅ **Non-destructive:** Only reads from existing data
- ✅ **No migrations:** No database schema changes
- ✅ **Backward compatible:** Doesn't affect existing functionality
- ✅ **Read-only PM logic:** Only queries, never modifies PM tracking

## Future Enhancements

Potential improvements:
- Configurable PM interval per container type
- Support for multiple destination cities in one trip
- Automatic task scheduling within trip date range
- Integration with route optimization
- Email/WhatsApp notifications for assigned tasks

