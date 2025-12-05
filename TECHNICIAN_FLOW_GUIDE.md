# 📋 TECHNICIAN FLOW COMPLETE GUIDE

## 🎯 OVERVIEW

Your system has a comprehensive technician workflow that operates through:
1. **Web Dashboard** (Admin/Coordinator management)
2. **WhatsApp Interface** (Technician field operations)
3. **Travel Planning System** (Multi-location trip optimization)

---

## 👤 TECHNICIAN TYPES & ROLES

### 1. REGULAR TECHNICIAN (role: "technician")
- Full-time employee with user account
- WhatsApp-verified access
- Employee code, grade, designation
- Wage breakdown (hotel, food, travel allowances)
- PM cost, service request cost per task
- Tasks per day rate (for trip planning)

### 2. SENIOR TECHNICIAN (role: "senior_technician")
- Enhanced permissions
- Can view more system information
- Similar workflow as regular technician

### 3. THIRD-PARTY TECHNICIAN (role: "amc")
- External contractor/vendor
- No user account (contact-based)
- Single money allowance (flat rate)
- Limited system access

---

## 🔄 COMPLETE TECHNICIAN LIFECYCLE

## PHASE 1: ONBOARDING

### 1. Admin Creates Technician
**Location:** `/technicians` page → "Add New Technician"

**Required Information:**
- **Personal:** Name, Phone, Email, WhatsApp Number
- **Professional:** Experience Level, Specialization, Base Location
- **Wage Details:** Grade, Designation
- **Allowances:** Hotel, Food, Travel, Personal
- **Rates:** Service Request Cost, PM Cost, Tasks/Day

### 2. User Account Creation
- System creates user with role "technician"
- Secure password auto-generated
- Credentials sent via email
- Requires password reset on first login

### 3. WhatsApp Verification (Optional but recommended)
- Technician sends first message to WhatsApp Business number
- System identifies by phone number
- Session created in `whatsapp_sessions` table
- Ready for field operations

---

## PHASE 2: SERVICE ASSIGNMENT

### Method A: Manual Assignment (by Admin/Coordinator)

**Location:** `/service-requests` → Select service → "Assign Technician"

**Process:**
1. Admin views pending/approved service requests
2. Selects appropriate technician based on:
   - Location proximity
   - Skill match
   - Current workload
   - Availability status
3. Sets scheduled date/time
4. Assigns service
5. Notifications sent:
   - WhatsApp to technician (if verified)
   - Email to technician
   - WhatsApp to customer

### Method B: Auto-Assignment via Travel Planning

**Location:** `/scheduling` → "Auto Plan Trip"

**Process:**
1. System analyzes:
   - All pending/approved service requests
   - Technician locations and availability
   - Container locations
   - Priority levels
   - Travel costs and routes
2. AI generates optimal trip plan:
   - Multi-location route
   - Accommodation suggestions
   - Travel mode recommendations (flight/train)
   - Cost breakdown with technician wages
3. Coordinator reviews and confirms
4. All services in trip assigned to technician
5. Trip created with status "planned"

---

## PHASE 3: TECHNICIAN RECEIVES ASSIGNMENT

### Via WhatsApp:

**Notification received:**
```
🔔 New Service Assigned!

🔧 Service: SR-2024-001
📦 Container: CONT-12345
👤 Customer: ABC Industries
📍 Location: Mumbai, Maharashtra
⚠️ Priority: HIGH
📅 Scheduled: 15/12/2024, 10:00 AM

🔍 Issue: Temperature fluctuation

[View Schedule] [Main Menu]
```

Technician can:
- View full schedule
- See service details
- Upload location for tracking

### Via Web Dashboard:

1. Technician logs in at `/technician-my-profile`
2. Views assigned services and schedule
3. Sees trip details if part of multi-location trip

---

## PHASE 4: WHATSAPP SERVICE FLOW (FIELD OPERATIONS)

### Step 1: View Schedule

**Technician sends:** "Hi" or "Menu"

**System responds:**
```
🔧 Welcome to Service Hub!

✓ Verified: John Technician
Role: Technician
ID: TECH-001

[📅 View Schedule] [📍 Upload Location]
```

**Choose date:**
```
📅 Select Date:

[⏮️ Previous Dates]
[📍 Today]
[⏭️ Future Dates]
```

**Today's schedule:**
```
📋 Today's Schedule - 03/12/2024

You have 3 service(s) scheduled:

🔧 SR-2024-001 - [scheduled]
├─ Container: CONT-12345
├─ Customer: ABC Industries
├─ Location: Mumbai
├─ Priority: High
├─ Scheduled: 10:00 AM
└─ Issue: Temperature fluctuation...

[View Details ▼]
```

### Step 2: Start Service

**View service details:**
```
📋 Service Request Details

🆔 Request ID: SR-2024-001
📦 Container: CONT-12345
👤 Customer: ABC Industries
📞 Contact: +91-9876543210
📍 Location: Plot 5, Andheri, Mumbai
⚠️ Priority: High
📅 Scheduled: 03/12/2024, 10:00 AM

🔍 Issue: Temperature fluctuation in reefer unit.
Customer reports temp rising to 12°C (should be -18°C)

📊 Status: SCHEDULED
⏱️ Est. Duration: 120 mins
🔧 Required Parts: Compressor relay

[▶️ Start Service] [🏠 Back]
```

**Click "Start Service":**
```
✅ Service Started Successfully!

⏱️ Timer is now running...
Started at: 10:05 AM

SR-2024-001 is now IN PROGRESS

To return to menu, send "Hi"
```

**System Actions:**
- Updates service status to "in_progress"
- Records `start_time` in database
- Adds to `activeServices` in WhatsApp session
- Sends notification to customer
- Timer starts tracking elapsed time

### Step 3: Multi-Service Tracking

**When technician sends "Hi" with active services:**
```
🔧 Welcome back, John!

Active Services: 2

⏱️ SR-2024-001
   Running for 1h 23m

⏱️ SR-2024-002
   Running for 35m

[📅 View Schedule] [📍 Upload Location]
[🛑 End Service]
```

### Step 4: Complete Service (Multi-Step Process)

#### Substep 4.1: Service Duration Summary
```
🛑 Ending Service: SR-2024-001

⏱️ Service Duration: 1h 23m
Started: 10:05 AM
Ending: 11:28 AM

📸 Please upload documentation:

Step 1: Before/After Photos

Please upload:
1️⃣ Before photos (if not uploaded)
2️⃣ After photos (required)

Upload photos now or
[⏭️ Skip Before Photos]
```

#### Substep 4.2: Upload Photos

Technician uploads images:
- System stores in `beforePhotos[]` or `afterPhotos[]` array
- Each upload confirmed:
```
✅ Before photo received.
Upload more or continue.

[✅ Done / Next Step]
```

#### Substep 4.3: Client Signature
```
Step 2: Client Signature/Documents

Please upload:
✍️ Document with client signature
📋 Service completion form

This is MANDATORY to complete service.
```

- Stored in `signedDocumentUrl` field
- Automatically moves to invoice check

#### Substep 4.4: Invoice Upload (Conditional)
```
Step 3: Invoice Upload (Conditional)

🧾 Did you purchase any spare parts
from a third-party vendor?

[✅ Yes, Upload Invoice]
[❌ No, Continue]
```

**If YES:** Upload invoice stored in `vendorInvoiceUrl`
**If NO:** Proceed to completion

#### Substep 4.5: Service Completion
```
✅ SERVICE COMPLETED SUCCESSFULLY!

📋 Summary:
Service: SR-2024-001
Duration: 1h 23m
Status: Completed

Documentation uploaded:
✅ Before Photos: 2 images
✅ After Photos: 3 images
✅ Client Signature: ✓
✅ Vendor Invoice: ✓

Thank you! Customer has been notified.

[🏠 Main Menu] [📅 View Schedule]
```

**System Actions:**
- Updates service status to "completed"
- Records `end_time` and `service_duration`
- Stores all uploaded documentation
- Removes from `activeServices` in session
- Sends completion notification to customer
- Updates technician statistics

**Customer receives:**
```
🎉 Service Completed!

Service: SR-2024-001
Container: CONT-12345
Duration: 1h 23m

Technician John has completed the
service. All documentation uploaded.

Thank you for choosing Service Hub!
```

### Step 5: Location Sharing

**Anytime during workflow:**
- Technician clicks "Upload Location" button
- OR sends live location via WhatsApp

**System:**
- Receives location coordinates (lat/lng)
- Reverse geocodes to get address
- Updates technician record:
  - `latitude`
  - `longitude`
  - `locationAddress`
- Visible to admin on dashboard for tracking

---

## PHASE 5: TRAVEL PLANNING SYSTEM (MULTI-LOCATION TRIPS)

### When to Use:
- Multiple service requests in different cities
- Need to optimize routes and costs
- Plan accommodation and travel

**Location:** `/scheduling` → "Auto Plan Trip"

### Process:

#### 1. AI Analysis

**Input:**
- All pending/approved service requests
- Container locations (city-based)
- Technician base locations
- Technician skills and availability
- Technician wage data (allowances, costs)
- Priority levels

**AI Output:**
- Optimal technician selection
- Multi-city route plan
- Service grouping by location
- Travel recommendations:
  - Mode (flight/train)
  - Estimated cost
  - Duration
- Accommodation needs
- Total cost breakdown:
  - Technician wages
  - Travel costs
  - Hotel costs
  - Service costs

#### 2. Trip Structure

**Table: technician_trips**
- id, technician_id
- trip_purpose ("pm" | "breakdown" | "mixed")
- status ("planned" | "booked" | "in_progress" | "completed")
- start_date, end_date
- base_location, destinations[] (cities)
- total_distance_km
- estimated_cost, actual_cost

**Table: trip_tasks**
- id, trip_id, service_request_id
- task_type ("pm" | "alert" | "inspection")
- location (city)
- estimated_duration
- sequence_order (route order)
- status ("pending" | "in_progress" | "completed")

**Table: trip_travel_segments**
- id, trip_id
- from_location, to_location
- travel_mode ("flight" | "train" | "bus" | "car")
- departure_time, arrival_time
- estimated_cost
- booking_reference, booking_status

**Table: trip_accommodations**
- id, trip_id, city
- check_in, check_out
- hotel_name
- estimated_cost, booking_status

#### 3. Coordinator Review & Booking

**Location:** `/scheduling` → View trip details

**Actions:**
- Review AI-generated plan
- Modify if needed
- Book flights/trains → Update booking_reference
- Book hotels → Update hotel details
- Confirm trip → Status: "booked"
- Technician receives consolidated trip notification

#### 4. Trip Execution

- Technician uses WhatsApp flow for EACH service in trip
- Each service completion tracked separately
- Trip status updates as tasks complete:
  - "in_progress" when first service starts
  - "completed" when all services done

#### 5. Trip Finance Tracking

**Location:** `/scheduling` → Trip → "Generate Finance PDF"

**PDF includes:**
- Trip overview (dates, destinations)
- Technician wage breakdown:
  - Base allowances (hotel, food, travel)
  - Service costs (per task)
  - Total technician cost
- Travel expenses (flights/trains, local transport)
- Accommodation costs
- Task completion summary
- Total trip cost

---

## PHASE 6: ADMIN DASHBOARD TRACKING

### Real-time Visibility:

**Location:** `/technicians`
- View all technicians
- See assigned services count (real-time)
- Location tracking (last updated location)
- Status (available, on_duty, busy, off_duty)
- Performance metrics

**Location:** `/dashboard`
- Technician Schedule widget
  - Today's scheduled services per technician
  - Active services (in_progress) with timer
  - Quick view of workload
- Live updates via WebSocket

**Location:** `/service-requests`
- Filter by technician
- View service timeline
- See all documentation (photos, signatures)
- Track completion status

**Location:** `/scheduling`
- All planned trips
- Trip progress tracking
- Financial overview
- Task completion status

### WebSocket Events:
- `service_request_assigned` → UI updates assignment
- `service_request_updated` → Status changes reflect
- `technician_updated` → Location updates appear
- Real-time dashboard synchronization

---

## PHASE 7: REPORTING & ANALYTICS

### Technician Performance Metrics:

**Location:** `/technicians` → Click technician → Profile

**Tracks:**
- Total jobs completed
- Average service duration
- Average rating (from customer feedback)
- Service completion rate
- Documentation compliance
- Active trip participation

### Service History:

**Location:** `/service-history`

**View:**
- All completed services
- Filter by technician
- Service duration analysis
- Parts usage tracking
- Cost analysis

### Trip Reports:

**Location:** `/scheduling`

**Generate:**
- Trip completion report
- Cost vs estimate analysis
- Technician productivity
- Route optimization insights

---

## 📊 DATABASE FLOW SUMMARY

### TABLE: users
- id, phoneNumber, name, email, role
- Links to: `technicians.userId`

### TABLE: technicians
- id, userId, employeeCode, experienceLevel
- status, grade, designation
- **Wage fields:** hotelAllowance, foodAllowance, serviceRequestCost, pmCost, tasksPerDay
- **Location:** latitude, longitude, locationAddress
- Links to: `service_requests.assignedTechnicianId`

### TABLE: service_requests
- id, requestNumber, containerId, clientId
- assignedTechnicianId (FK to technicians)
- status, priority, scheduledDate
- **Time tracking:** startTime, endTime, serviceDuration
- **Documentation:** beforePhotos[], afterPhotos[], signedDocumentUrl, vendorInvoiceUrl
- Links to: containers, customers, alerts

### TABLE: whatsapp_sessions
- id, userId, phoneNumber, conversationState
- **State tracks:**
  - step (current flow step)
  - activeServices[] (services with timers)
  - currentServiceId (for completion flow)
  - serviceStartTime (for duration calc)
- Session management for WhatsApp flows

### TABLE: technician_trips
- id, technicianId, trip_purpose, status
- start_date, end_date, destinations[]
- **Cost tracking:** estimated_cost, actual_cost

### TABLE: trip_tasks
- id, trip_id, service_request_id
- Links service to trip
- Tracks task completion in trip context

---

## 🎯 KEY FEATURES SUMMARY

### ✅ Dual Interface:
- Web dashboard for admin/management
- WhatsApp for field technicians (no app needed)

### ✅ Smart Assignment:
- Manual assignment by coordinator
- AI-powered auto-assignment
- Multi-location trip optimization

### ✅ Real-time Tracking:
- Service status updates
- Location tracking
- Active service timers
- WebSocket synchronization

### ✅ Complete Documentation:
- Before/after photos
- Client signatures
- Vendor invoices
- All stored in database

### ✅ Financial Tracking:
- Technician wage breakdown
- Trip cost estimation
- Expense reimbursement
- Per-task costing

### ✅ Multi-service Management:
- Technicians can handle multiple services
- Session-based tracking
- Individual timers per service
- Proper completion workflow

### ✅ Customer Communication:
- Auto-notifications on service start
- Completion confirmations
- WhatsApp integration

---

## 🔗 RELATED FILES

**Backend:**
- [server/services/whatsapp-technician-flows.ts](server/services/whatsapp-technician-flows.ts) - Main WhatsApp flow handlers
- [server/services/whatsapp-technician-core.ts](server/services/whatsapp-technician-core.ts) - Core utility functions
- [server/services/travel-planning.ts](server/services/travel-planning.ts) - AI trip planning
- [server/routes.ts](server/routes.ts) - API endpoints

**Frontend:**
- [client/src/pages/technicians.tsx](client/src/pages/technicians.tsx) - Technician management
- [client/src/pages/scheduling.tsx](client/src/pages/scheduling.tsx) - Trip planning
- [client/src/pages/service-requests.tsx](client/src/pages/service-requests.tsx) - Service assignment
- [client/src/pages/technician-my-profile.tsx](client/src/pages/technician-my-profile.tsx) - Technician portal

**Schema:**
- [shared/schema.ts](shared/schema.ts) - Database schema definitions

**Documentation:**
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - API reference
- [CURRENT_SYSTEM_PRD.md](CURRENT_SYSTEM_PRD.md) - System architecture
