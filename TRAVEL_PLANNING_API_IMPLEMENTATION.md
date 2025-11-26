# Technician Travel Planning API Implementation

## Overview
This document describes the REST API endpoints implemented for the Technician Travel Planning System within the Service Scheduling section.

## API Endpoints

All endpoints are namespaced under `/api/scheduling/travel` to avoid conflicts with existing scheduling routes.

### 1. Create Trip
**POST** `/api/scheduling/travel/trips`

Creates a new technician trip with basic information and initial cost breakdown.

**Authentication:** Required (Admin/Coordinator roles only)

**Request Body:**
```json
{
  "technicianId": "tech-123",
  "origin": "Mumbai",
  "destinationCity": "Chennai",
  "startDate": "2025-12-01T00:00:00Z",
  "endDate": "2025-12-05T00:00:00Z",
  "dailyWorkingTimeWindow": "10:00-18:00", // Optional
  "purpose": "pm", // pm, breakdown, audit, mixed
  "notes": "Optional notes",
  "travelFare": 5000, // Optional, manual input
  "stayCost": 4000, // Optional, auto-calculated if not provided
  "dailyAllowance": 1500, // Optional, auto-calculated if not provided
  "localTravelCost": 2000, // Optional, auto-calculated if not provided
  "miscCost": 500, // Optional
  "currency": "INR" // Optional, defaults to INR
}
```

**Response:** 201 Created
```json
{
  "id": "trip-123",
  "technicianId": "tech-123",
  "origin": "Mumbai",
  "destinationCity": "Chennai",
  "startDate": "2025-12-01T00:00:00Z",
  "endDate": "2025-12-05T00:00:00Z",
  "tripStatus": "planned",
  "bookingStatus": "not_started",
  "costs": {
    "travelFare": "5000.00",
    "stayCost": "4000.00",
    "dailyAllowance": "1500.00",
    "localTravelCost": "2000.00",
    "miscCost": "500.00",
    "totalEstimatedCost": "13000.00",
    "currency": "INR"
  }
}
```

**Auto-Calculations:**
- `stayCost`: If not provided, calculated as `numberOfNights × technician.hotelAllowance`
- `dailyAllowance`: If not provided, calculated as `numberOfDays × technician.foodAllowance`
- `localTravelCost`: If not provided, calculated as `numberOfDays × technician.localTravelAllowance`
- `totalEstimatedCost`: Always auto-calculated as sum of all cost components

---

### 2. List Trips
**GET** `/api/scheduling/travel/trips`

Lists trips with optional filters.

**Authentication:** Required

**Query Parameters:**
- `technicianId` (optional): Filter by technician
- `startDate` (optional): Filter trips starting from this date
- `endDate` (optional): Filter trips ending before this date
- `destinationCity` (optional): Filter by destination city (partial match)
- `tripStatus` (optional): Filter by status (planned, booked, in_progress, completed, cancelled)

**Example:**
```
GET /api/scheduling/travel/trips?technicianId=tech-123&tripStatus=planned
```

**Response:** 200 OK
```json
[
  {
    "id": "trip-123",
    "technicianId": "tech-123",
    "destinationCity": "Chennai",
    "startDate": "2025-12-01T00:00:00Z",
    "endDate": "2025-12-05T00:00:00Z",
    "tripStatus": "planned",
    "costs": { ... },
    "tasksCount": 5
  }
]
```

---

### 3. Get Trip Details
**GET** `/api/scheduling/travel/trips/:id`

Fetches full details of a trip including costs and tasks.

**Authentication:** Required

**Response:** 200 OK
```json
{
  "id": "trip-123",
  "technicianId": "tech-123",
  "origin": "Mumbai",
  "destinationCity": "Chennai",
  "startDate": "2025-12-01T00:00:00Z",
  "endDate": "2025-12-05T00:00:00Z",
  "tripStatus": "planned",
  "bookingStatus": "not_started",
  "costs": {
    "travelFare": "5000.00",
    "stayCost": "4000.00",
    "totalEstimatedCost": "13000.00"
  },
  "tasks": [
    {
      "id": "task-1",
      "containerId": "container-123",
      "taskType": "pm",
      "status": "pending",
      "container": {
        "id": "container-123",
        "containerCode": "CONT-001"
      },
      "customer": {
        "id": "customer-456",
        "companyName": "ABC Corp"
      }
    }
  ]
}
```

**Response:** 404 Not Found if trip doesn't exist

---

### 4. Update Trip
**PATCH** `/api/scheduling/travel/trips/:id`

Updates trip fields, including statuses.

**Authentication:** Required (Admin/Coordinator roles only)

**Request Body:** (all fields optional)
```json
{
  "origin": "Delhi",
  "destinationCity": "Bangalore",
  "startDate": "2025-12-10T00:00:00Z",
  "endDate": "2025-12-15T00:00:00Z",
  "dailyWorkingTimeWindow": "09:00-17:00",
  "purpose": "breakdown",
  "notes": "Updated notes",
  "tripStatus": "booked",
  "bookingStatus": "tickets_booked",
  "ticketReference": "PNR123456",
  "hotelReference": "HOTEL789",
  "bookingAttachments": { "ticket": "url", "hotel": "url" }
}
```

**Response:** 200 OK with updated trip object

**Validation:**
- If both `startDate` and `endDate` are provided, `endDate` must be after `startDate`

---

### 5. Delete Trip (Soft Delete)
**DELETE** `/api/scheduling/travel/trips/:id`

Soft deletes a trip by setting status to "cancelled". Does not hard delete from database.

**Authentication:** Required (Admin/Coordinator roles only)

**Response:** 200 OK
```json
{
  "message": "Trip cancelled successfully"
}
```

**Response:** 404 Not Found if trip doesn't exist

---

### 6. Update Trip Costs
**PATCH** `/api/scheduling/travel/trips/:id/cost`

Updates cost components and automatically recalculates `totalEstimatedCost`.

**Authentication:** Required (Admin/Coordinator roles only)

**Request Body:** (all fields optional)
```json
{
  "travelFare": 6000,
  "stayCost": 5000,
  "dailyAllowance": 2000,
  "localTravelCost": 2500,
  "miscCost": 1000,
  "currency": "INR"
}
```

**Response:** 200 OK
```json
{
  "id": "cost-123",
  "tripId": "trip-123",
  "travelFare": "6000.00",
  "stayCost": "5000.00",
  "dailyAllowance": "2000.00",
  "localTravelCost": "2500.00",
  "miscCost": "1000.00",
  "totalEstimatedCost": "16500.00", // Auto-calculated
  "currency": "INR"
}
```

**Note:** `totalEstimatedCost` is automatically recalculated as the sum of all cost components whenever costs are updated.

---

## Error Handling

All endpoints follow consistent error handling:

**400 Bad Request:**
```json
{
  "error": "Missing required fields: technicianId, origin, destinationCity, startDate, endDate"
}
```

**401 Unauthorized:**
```json
{
  "error": "Authentication required"
}
```

**403 Forbidden:**
```json
{
  "error": "Forbidden"
}
```

**404 Not Found:**
```json
{
  "error": "Trip not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to create technician trip",
  "details": "Error message details"
}
```

---

## Authentication & Authorization

- All endpoints require authentication via `x-user-id` header
- Create, Update, Delete, and Cost Update endpoints require Admin or Coordinator role
- List and Get endpoints are available to all authenticated users

**Example Request:**
```bash
curl -X POST http://localhost:5000/api/scheduling/travel/trips \
  -H "x-user-id: user-123" \
  -H "Content-Type: application/json" \
  -d '{
    "technicianId": "tech-123",
    "origin": "Mumbai",
    "destinationCity": "Chennai",
    "startDate": "2025-12-01T00:00:00Z",
    "endDate": "2025-12-05T00:00:00Z"
  }'
```

---

## Storage Methods

The following storage methods were added to `server/storage.ts`:

- `createTechnicianTrip(trip: any): Promise<TechnicianTrip>`
- `getTechnicianTrip(id: string): Promise<TechnicianTrip | undefined>`
- `getTechnicianTrips(filters?: {...}): Promise<TechnicianTrip[]>`
- `updateTechnicianTrip(id: string, trip: any): Promise<TechnicianTrip>`
- `deleteTechnicianTrip(id: string): Promise<void>` (soft delete)
- `getTechnicianTripCosts(tripId: string): Promise<TechnicianTripCost | undefined>`
- `updateTechnicianTripCosts(tripId: string, costs: any): Promise<TechnicianTripCost>`
- `getTechnicianTripTasks(tripId: string): Promise<TechnicianTripTask[]>`
- `createTechnicianTripTask(task: any): Promise<TechnicianTripTask>`
- `updateTechnicianTripTask(id: string, task: any): Promise<TechnicianTripTask>`

---

## Testing

Unit tests are available in `server/tests/travel-planning.test.ts`.

**Run tests:**
```bash
tsx server/tests/travel-planning.test.ts
```

**Note:** Tests require a database connection. Set `DATABASE_URL` in your `.env` file.

---

## Database Schema

The implementation uses the following tables (created in migration `20251125_add_technician_travel_planning.sql`):

1. **technician_trips** - Main trip information
2. **technician_trip_costs** - Cost breakdown (one-to-one with trip)
3. **technician_trip_tasks** - Auto-assigned PM jobs/containers

See `migrations/20251125_add_technician_travel_planning.sql` for full schema details.

---

## Next Steps

1. **Run the migration:**
   ```sql
   -- Execute migrations/20251125_add_technician_travel_planning.sql in your database
   ```

2. **Test the endpoints:**
   - Use the provided test file or test manually with curl/Postman
   - Verify authentication and authorization
   - Test cost auto-calculation

3. **Future enhancements:**
   - Auto-assignment of PM jobs based on destination city and date range
   - Integration with WhatsApp Hub for sending travel plans
   - Email notifications for trip updates
   - Trip task management endpoints

---

## Files Modified/Created

1. **server/storage.ts** - Added travel planning storage methods
2. **server/routes.ts** - Added travel planning API routes
3. **server/tests/travel-planning.test.ts** - Unit tests
4. **server/tests/test-utils.ts** - Test utilities
5. **shared/schema.ts** - Already updated with travel planning tables (from previous step)

---

## Notes

- All endpoints are additive and do not modify existing scheduling functionality
- Soft delete is used for trip cancellation (status set to "cancelled")
- Cost calculation is automatic and always recalculates `totalEstimatedCost`
- All date validations ensure `endDate >= startDate`
- Foreign key relationships ensure data integrity

