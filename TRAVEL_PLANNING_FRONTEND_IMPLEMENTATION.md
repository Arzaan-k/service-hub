# Technician Travel Planning Frontend Implementation

## Overview
This document describes the frontend implementation of the Technician Travel Planning feature within the Scheduling page.

## What Was Implemented

### 1. Tab Navigation
**File:** `client/src/pages/scheduling.tsx`

- Added `Tabs` component from shadcn UI
- Two tabs: "Daily Schedule" (existing) and "Technician Travel" (new)
- Daily Schedule tab shows 100% identical UI to previous implementation
- Tab switching preserves all existing functionality

### 2. Technician Travel Tab
**Features:**
- **Trips Table:** Displays all trips with columns:
  - Technician (with user icon)
  - Destination (with map pin icon)
  - Dates (with calendar icon)
  - Trip Status (color-coded badges)
  - Booking Status (with emoji indicators)
  - Total Cost (formatted in INR)
  - Actions (View button)
- **Empty State:** Shows message when no trips exist
- **Create Button:** "+ Plan Technician Trip" button (Admin/Coordinator only)

### 3. Plan Trip Dialog
**File:** `client/src/components/scheduling/plan-trip-dialog.tsx`

**Form Fields:**
- Technician (dropdown, auto-populated from `/api/technicians`)
- Origin (auto-filled from technician's base location)
- Destination City
- Start Date & End Date (date pickers with validation)
- Purpose (select: PM, Breakdown, Audit, Mixed)
- Notes (textarea)

**Cost Inputs:**
- Travel Fare (manual input)
- Stay Cost per Night (auto-calculates total based on nights)
- Daily Allowance per Day (auto-calculates total based on days)
- Local Travel per Day (auto-calculates total based on days)
- Miscellaneous Cost (manual input)

**Auto-Calculations:**
- **Stay Cost:** `nights × stayCostPerNight` (displayed live)
- **Daily Allowance:** `days × daPerDay` (displayed live)
- **Local Travel:** `days × localTravelPerDay` (displayed live)
- **Total Estimated Cost:** Sum of all costs (displayed prominently)

**Workflow:**
1. User fills form
2. On submit, calls `POST /api/scheduling/travel/trips`
3. Automatically calls `POST /api/scheduling/travel/trips/:id/auto-assign-tasks`
4. Shows success toast
5. Refreshes trips list

### 4. Trip Detail Sheet
**File:** `client/src/components/scheduling/trip-detail-sheet.tsx`

**Sections:**

#### Trip Information Card
- Technician name
- Origin & Destination
- Date range
- Trip Status badge
- Booking Status badge
- Purpose badge
- Notes (if available)

#### Cost Breakdown Card
- Travel Fare
- Stay Cost
- Daily Allowance
- Local Travel Cost
- Miscellaneous Cost
- **Total Estimated Cost** (highlighted)

#### Assigned Tasks Card
- Table showing:
  - Container (clickable link to container detail page)
  - Site/Customer name
  - Task Type (PM/Alert/Inspection with icons)
  - Scheduled Date
  - Status (with color-coded badges)
  - Actions (status dropdown for authorized users)

**Features:**
- **Container Links:** Clicking container code navigates to container detail page
- **Alert Links:** Tasks with alerts show alert icon button
- **Status Updates:** Admin/Coordinator can update task status via dropdown
- **Auto-Assign Button:** If no tasks exist, shows button to auto-assign tasks
- **Empty State:** Shows message when no tasks are assigned

### 5. Task Status Management
- **Status Options:** Pending, In Progress, Completed, Cancelled
- **Update Endpoint:** `PATCH /api/scheduling/travel/trips/:tripId/tasks/:taskId`
- **Auto-completion:** Sets `completedAt` timestamp when status is set to "completed"

## UI/UX Features

### Styling
- Uses existing Tailwind classes and component styles
- Matches existing Scheduling card design
- Consistent color scheme and spacing
- Responsive design (works on mobile and desktop)

### User Experience
- **Live Cost Calculation:** Costs update in real-time as user types
- **Auto-fill:** Origin auto-fills from technician's base location
- **Validation:** Date validation ensures end date >= start date
- **Loading States:** Shows spinners during data fetching
- **Error Handling:** Toast notifications for success/error
- **Navigation:** Seamless navigation to containers and alerts

### Permissions
- **View:** All authenticated users can view trips
- **Create/Edit:** Only Admin and Coordinator roles
- **Task Updates:** Only Admin and Coordinator can update task status

## Component Structure

```
client/src/
├── pages/
│   └── scheduling.tsx (main page with tabs)
└── components/
    └── scheduling/
        ├── plan-trip-dialog.tsx (create trip form)
        └── trip-detail-sheet.tsx (trip detail view)
```

## API Integration

### Endpoints Used
1. `GET /api/technicians` - Fetch technicians for dropdown
2. `GET /api/scheduling/travel/trips` - List trips
3. `GET /api/scheduling/travel/trips/:id` - Get trip details
4. `POST /api/scheduling/travel/trips` - Create trip
5. `POST /api/scheduling/travel/trips/:id/auto-assign-tasks` - Auto-assign tasks
6. `PATCH /api/scheduling/travel/trips/:tripId/tasks/:taskId` - Update task status

## Key Features

### 1. Cost Auto-Calculation
- Real-time calculation as user inputs values
- Shows breakdown (nights/days) for each cost component
- Displays total prominently

### 2. Auto-Assignment Integration
- Automatically calls auto-assign after trip creation
- Can manually trigger from trip detail view
- Shows task count in trips list

### 3. Navigation Integration
- Container links navigate to `/containers/:id`
- Alert links navigate to `/alerts` page
- Sheet closes when navigating away

### 4. Data Enrichment
- Trips include technician information
- Tasks include container and customer information
- All data is properly linked and clickable

## Files Created/Modified

### Created
1. `client/src/components/scheduling/plan-trip-dialog.tsx` - Trip creation form
2. `client/src/components/scheduling/trip-detail-sheet.tsx` - Trip detail view

### Modified
1. `client/src/pages/scheduling.tsx` - Added tabs and Technician Travel section
2. `server/routes.ts` - Added task update endpoint

## Testing Checklist

- [ ] Create a new trip with all fields
- [ ] Verify cost auto-calculation works
- [ ] Verify auto-assignment creates tasks
- [ ] View trip details
- [ ] Update task status
- [ ] Navigate to container from task
- [ ] Switch between Daily Schedule and Technician Travel tabs
- [ ] Verify existing Daily Schedule functionality is unchanged

## Notes

- All existing Scheduling functionality remains 100% intact
- New components are self-contained in the Scheduling module
- No global layout, navbar, or sidebar changes
- Follows existing design patterns and component structure
- Fully responsive and accessible

