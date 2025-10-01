# Product Requirements Document (PRD)
## Container Service Management System

**Version:** 1.0  
**Date:** September 30, 2025  
**Document Owner:** Product Management  
**Status:** Draft

---

## Executive Summary

The Container Service Management System is an AI-enabled, automation-first platform designed to revolutionize container fleet management, predictive maintenance, and service delivery. The system manages a fleet of 250 containers (90 IoT-enabled, 160 manual tracking), providing end-to-end visibility, automated error detection, intelligent service scheduling, and seamless customer communication through WhatsApp Business API integration.

**Key Value Propositions:**
- 90% reduction in service response time through automation
- Real-time container health monitoring with predictive alerts
- AI-powered service scheduling optimization
- Zero-touch customer communication via WhatsApp
- Complete service lifecycle management from alert to payment

---

## Table of Contents

1. Product Overview
2. User Personas
3. System Architecture
4. Functional Requirements
5. Technical Requirements
6. Integration Requirements
7. AI/ML Components
8. User Flows
9. Data Model
10. Security & Compliance
11. Performance Requirements
12. Implementation Roadmap

---

## 1. Product Overview

### 1.1 Product Vision
Create an intelligent, self-managing container service ecosystem that minimizes human intervention while maximizing service quality, customer satisfaction, and operational efficiency.

### 1.2 Business Objectives
- Reduce service TAT (Turn-Around Time) by 80%
- Achieve 95% first-time fix rate
- Automate 90% of service request workflows
- Improve customer satisfaction score to 4.5+/5
- Reduce operational costs by 40%
- Enable real-time visibility across entire service lifecycle

### 1.3 Scope

**In Scope:**
- Container tracking and monitoring (IoT + Manual)
- Automated alert detection and classification
- Client portal with real-time dashboards
- WhatsApp-based customer communication
- Intelligent service scheduling
- Technician management and tracking
- Automated invoicing and payment tracking
- Inventory management integration
- Real-time analytics and reporting

**Out of Scope (Phase 1):**
- Mobile native applications
- Voice-based interactions
- Third-party marketplace integrations
- Multi-language support (English only in Phase 1)

---

## 2. User Personas

### 2.1 Admin/Operations Manager
**Goals:**
- Monitor entire fleet health in real-time
- Oversee service operations
- Track business metrics and KPIs
- Manage technician assignments

**Pain Points:**
- Manual coordination overhead
- Delayed error identification
- Inefficient resource allocation

### 2.2 Client/Customer
**Goals:**
- Monitor owned/leased containers
- Receive timely service updates
- Quick problem resolution
- Transparent billing

**Pain Points:**
- Lack of visibility into container status
- Delayed service response
- Communication gaps

### 2.3 Field Technician
**Goals:**
- Receive clear work assignments
- Access container history and documentation
- Update service status easily
- Minimize travel time

**Pain Points:**
- Poor route planning
- Missing spare parts
- Unclear job requirements

### 2.4 Service Coordinator
**Goals:**
- Log manual service requests
- Track service completion
- Coordinate with clients and technicians

**Pain Points:**
- Manual data entry
- Communication bottlenecks

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                           │
├─────────────────────────────────────────────────────────────┤
│  Admin Dashboard    │  Client Portal    │  WhatsApp Interface│
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway Layer                        │
│              (Authentication, Rate Limiting)                 │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Business Logic Layer                       │
├──────────────┬───────────────┬──────────────┬───────────────┤
│ Container    │ Service       │ Scheduling   │ Communication │
│ Management   │ Management    │ Engine       │ Engine        │
└──────────────┴───────────────┴──────────────┴───────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    AI/ML Services Layer                      │
├──────────────┬───────────────┬──────────────┬───────────────┤
│ Alert        │ Route         │ Predictive   │ Cost          │
│ Classifier   │ Optimizer     │ Maintenance  │ Estimator     │
└──────────────┴───────────────┴──────────────┴───────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Integration Layer                         │
├──────────────┬───────────────┬──────────────┬───────────────┤
│ Orbcomm API  │ WhatsApp      │ Payment      │ Inventory     │
│              │ Business API  │ Gateway      │ System        │
└──────────────┴───────────────┴──────────────┴───────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
├──────────────┬───────────────┬──────────────┬───────────────┤
│ PostgreSQL   │ Redis Cache   │ S3 Storage   │ Time-Series   │
│ (Primary DB) │               │ (Media)      │ DB (Metrics)  │
└──────────────┴───────────────┴──────────────┴───────────────┘
```

### 3.2 Technology Stack Recommendations

**Frontend:**
- React.js with TypeScript for web dashboards
- TailwindCSS for styling
- Recharts/D3.js for data visualization
- Socket.io for real-time updates

**Backend:**
- Node.js with Express.js / Python with FastAPI
- REST + GraphQL APIs
- WebSocket for real-time communication

**Database:**
- PostgreSQL (primary relational data)
- TimescaleDB/InfluxDB (IoT metrics and time-series data)
- Redis (caching and session management)
- Amazon S3/MinIO (media storage)

**AI/ML:**
- TensorFlow/PyTorch for ML models
- scikit-learn for optimization algorithms
- OpenAI API for natural language processing

**Integration:**
- WhatsApp Business API (Official)
- Twilio for backup messaging
- Orbcomm IoT API

**Infrastructure:**
- AWS/Google Cloud Platform
- Docker + Kubernetes for containerization
- CI/CD: GitHub Actions/GitLab CI

---

## 4. Functional Requirements

### 4.1 Container Management Module

#### 4.1.1 Container Registry
**Priority:** P0 (Critical)

**Requirements:**
- **FR-CM-001:** System shall maintain a comprehensive registry of all 250 containers
- **FR-CM-002:** Each container record shall include:
  - Unique Container ID
  - Type/Model
  - Manufacturing date
  - Purchase/Acquisition date
  - Current status (Active, In-Service, Maintenance, Retired)
  - Current location (GPS coordinates for IoT-enabled)
  - Current customer assignment
  - Orbcomm device ID (if applicable)
  - Capacity/Specifications
  - Maintenance history
  - Usage statistics

- **FR-CM-003:** System shall categorize containers as:
  - IoT-Enabled (90 containers with Orbcomm)
  - Non-IoT (160 containers with manual tracking)

#### 4.1.2 Real-Time Container Monitoring
**Priority:** P0 (Critical)

**Requirements:**
- **FR-CM-004:** System shall integrate with Orbcomm API to fetch real-time data every 5 minutes for 90 IoT-enabled containers
- **FR-CM-005:** Data points to be tracked:
  - GPS location
  - Temperature (if applicable)
  - Door open/close status
  - Power status
  - Error codes
  - Operational metrics
  - Last communication timestamp

- **FR-CM-006:** System shall display container location on interactive map with clustering for multiple containers in same area
- **FR-CM-007:** System shall maintain 24-month historical data for all containers
- **FR-CM-008:** System shall provide timeline view of container lifecycle events

#### 4.1.3 Container Assignment & Tracking
**Priority:** P0 (Critical)

**Requirements:**
- **FR-CM-009:** System shall track customer assignments with:
  - Assignment date
  - Expected return date
  - Actual return date
  - Usage charges
  - Billing cycle

- **FR-CM-010:** System shall calculate and display:
  - Total usage cycles per container
  - Average usage duration
  - Revenue generated per container
  - Utilization rate
  - Downtime analysis

### 4.2 Alert & Error Management Module

#### 4.2.1 Automated Alert Detection
**Priority:** P0 (Critical)

**Requirements:**
- **FR-AE-001:** System shall automatically detect errors from Orbcomm devices in real-time
- **FR-AE-002:** System shall classify alerts into severity levels:
  - **Critical:** Immediate service required (system failure, safety hazard)
  - **High:** Service required within 24 hours (functionality impaired)
  - **Medium:** Service required within 72 hours (performance degraded)
  - **Low:** Maintenance recommended (preventive)

- **FR-AE-003:** Alert classification shall be powered by AI/ML model trained on historical data
- **FR-AE-004:** System shall maintain alert knowledge base with:
  - Error code
  - Description
  - Severity
  - Resolution steps
  - Required spare parts
  - Estimated service time
  - Resolution success rate

#### 4.2.2 Alert Resolution Workflow
**Priority:** P0 (Critical)

**Requirements:**
- **FR-AE-005:** For Low/Medium severity alerts:
  - System shall automatically send resolution steps to client via WhatsApp
  - Include troubleshooting guide with images/videos
  - Provide DIY resolution option
  - Track if client successfully resolved issue

- **FR-AE-006:** For High/Critical severity alerts:
  - System shall automatically trigger service request creation
  - Send formatted message to client with service request details
  - Include WhatsApp interactive buttons: "Approve Service" / "Schedule Later"

- **FR-AE-007:** System shall send alert notifications to:
  - Admin dashboard (all alerts)
  - Client WhatsApp (alerts for their containers only)
  - Assigned account manager (High/Critical alerts)

#### 4.2.3 Manual Alert Entry
**Priority:** P1 (High)

**Requirements:**
- **FR-AE-008:** Service coordinator shall be able to manually create alerts for non-IoT containers via dashboard
- **FR-AE-009:** Manual alert form shall include:
  - Container ID (dropdown with search)
  - Issue description (text + voice note option)
  - Severity selection
  - Client-reported symptoms
  - Media uploads (photos/videos)
  - Urgency indicator

- **FR-AE-010:** Manual alerts shall follow same workflow as automated alerts

### 4.3 Client Portal & Dashboard

#### 4.3.1 Client Authentication
**Priority:** P0 (Critical)

**Requirements:**
- **FR-CP-001:** Clients shall authenticate via:
  - Email/Password
  - WhatsApp OTP verification
  - SSO (Google/Microsoft)

- **FR-CP-002:** Multi-factor authentication (MFA) shall be optional but recommended
- **FR-CP-003:** Role-based access control:
  - Owner: Full access to assigned containers
  - Viewer: Read-only access
  - Manager: Can request services and view billing

#### 4.3.2 Client Dashboard Features
**Priority:** P0 (Critical)

**Requirements:**
- **FR-CP-004:** Dashboard shall display:
  - **Overview Widget:**
    - Total containers assigned
    - Active alerts count
    - Pending service requests
    - Outstanding invoices

  - **Container List View:**
    - Container ID with status indicator
    - Current location (map icon clickable)
    - Last update timestamp
    - Active alerts badge
    - Quick actions (View Details, Request Service)

  - **Container Detail View:**
    - Real-time metrics (for IoT containers)
    - Complete service history
    - Alert history with resolutions
    - Usage statistics
    - Document repository

  - **Alert Center:**
    - Active alerts with severity indicators
    - Alert timeline
    - Resolution status
    - Downloadable reports

  - **Service Requests:**
    - Open/Scheduled/In-Progress/Completed requests
    - Assigned technician details
    - ETA and live tracking
    - Status updates

  - **Billing & Payments:**
    - Invoice history
    - Payment status
    - Download invoices (PDF)
    - Payment link integration

- **FR-CP-005:** All dashboard data shall update in real-time using WebSocket connections
- **FR-CP-006:** Dashboard shall be mobile-responsive

#### 4.3.3 Notifications
**Priority:** P0 (Critical)

**Requirements:**
- **FR-CP-007:** Client shall receive notifications via:
  - In-app notifications (dashboard)
  - WhatsApp messages
  - Email (optional)

- **FR-CP-008:** Notification preferences shall be configurable per client

### 4.4 Service Management Module

#### 4.4.1 Service Request Creation
**Priority:** P0 (Critical)

**Requirements:**
- **FR-SM-001:** Service requests shall be created:
  - Automatically from High/Critical alerts
  - Manually by service coordinator
  - By client through dashboard/WhatsApp
  - From scheduled preventive maintenance

- **FR-SM-002:** Each service request shall include:
  - Unique Service Request ID
  - Container ID
  - Client details
  - Issue description
  - Severity/Priority
  - Required spare parts (AI-predicted)
  - Estimated service time
  - Preferred service window (from client)
  - Status (Pending, Approved, Scheduled, In-Progress, Completed, Cancelled)

#### 4.4.2 Automated Invoicing
**Priority:** P0 (Critical)

**Requirements:**
- **FR-SM-003:** System shall automatically generate invoice based on:
  - Customer type/tier (Premium, Standard, Basic)
  - Service complexity
  - Required spare parts
  - Technician charges
  - Travel charges (if applicable)
  - Additional charges (after-hours, emergency)

- **FR-SM-004:** Invoice generation rules:
  - **Premium Customers:**
    - Invoice after service completion
    - 30-day payment terms
    - Consolidated monthly billing option
  
  - **Standard Customers:**
    - Invoice before service (prepaid)
    - 15-day payment terms
  
  - **Basic Customers:**
    - Immediate payment required
    - Service initiated after payment confirmation

- **FR-SM-005:** Invoice shall be sent via:
  - WhatsApp (PDF + payment link)
  - Email
  - Dashboard download

- **FR-SM-006:** Invoice shall include:
  - Itemized breakdown
  - Tax calculations
  - Payment due date
  - Payment methods accepted
  - Terms and conditions

#### 4.4.3 Payment Tracking
**Priority:** P1 (High)

**Requirements:**
- **FR-SM-007:** System shall integrate with payment gateway (Razorpay/Stripe)
- **FR-SM-008:** Payment status shall be tracked:
  - Pending
  - Partially Paid
  - Paid
  - Overdue

- **FR-SM-009:** Automated payment reminders:
  - 3 days before due date
  - On due date
  - 2 days after due date (with late fee warning)
  - 7 days after due date (service suspension notice)

### 4.5 Intelligent Scheduling Engine

#### 4.5.1 AI-Powered Service Scheduling
**Priority:** P0 (Critical)

**Requirements:**
- **FR-SE-001:** Scheduling engine shall run daily at configurable time (default: 6 PM) to plan next day assignments
- **FR-SE-002:** Engine shall analyze service requests from past 12/24 hours (configurable)
- **FR-SE-003:** Optimization factors:
  - **Geographic Clustering:** Group service locations by proximity
  - **Technician Location:** Consider technician home/current location
  - **Service Priority:** Critical > High > Medium > Low
  - **Service Duration:** Estimated time per service
  - **Spare Parts Availability:** Only assign if parts are in stock
  - **Technician Skills:** Match service complexity with technician expertise
  - **Travel Time:** Minimize total travel time using route optimization
  - **Working Hours:** Respect technician shift timings (8-hour workday)
  - **Customer Preferences:** Preferred time windows
  - **SLA Compliance:** Ensure deadlines are met

- **FR-SE-004:** Algorithm approach:
  - Use combination of:
    - K-means clustering for geographic grouping
    - Vehicle Routing Problem (VRP) optimization
    - Constraint satisfaction for business rules
    - Machine learning for duration prediction

- **FR-SE-005:** Output shall include:
  - Technician-wise daily schedule
  - Route map with sequence
  - Total travel distance/time
  - Expected completion time
  - Alternative assignments (if optimization fails)

#### 4.5.2 Schedule Distribution
**Priority:** P0 (Critical)

**Requirements:**
- **FR-SE-006:** Once schedule is optimized, system shall automatically:
  - Send detailed schedule to each technician via WhatsApp by 7 PM previous day
  - Update admin dashboard with all assignments
  - Send client notifications about scheduled service window

- **FR-SE-007:** WhatsApp schedule message shall include:
  - List of service requests with sequence
  - Container location (Google Maps link)
  - Client contact details
  - Estimated time per service
  - Required spare parts list
  - Special instructions
  - Route map
  - Interactive button: "Acknowledge Schedule"

- **FR-SE-008:** System shall handle schedule conflicts:
  - If technician is unavailable (sick leave), auto-reassign
  - If customer cancels, reoptimize remaining schedule
  - If emergency request comes, suggest schedule adjustments

#### 4.5.3 Manual Override
**Priority:** P1 (High)

**Requirements:**
- **FR-SE-009:** Admin shall be able to manually:
  - Override AI assignments
  - Reassign services between technicians
  - Block time slots
  - Mark technicians as unavailable
  - Add urgent requests to existing schedules

- **FR-SE-010:** Manual changes shall trigger notification to affected technicians and clients

### 4.6 Technician Management Module

#### 4.6.1 Technician Registry
**Priority:** P0 (Critical)

**Requirements:**
- **FR-TM-001:** System shall maintain technician profiles:
  - Technician ID
  - Name, contact details
  - Home/base location (GPS)
  - Service areas (radius or specific zones)
  - Skills/certifications
  - Experience level (Junior, Mid, Senior, Expert)
  - Working hours/shifts
  - Availability calendar
  - Performance metrics
  - Assigned spare parts inventory

- **FR-TM-002:** System shall track technician performance:
  - Average service completion time
  - First-time fix rate
  - Customer satisfaction rating
  - Total services completed
  - On-time arrival rate
  - Documentation quality score

#### 4.6.2 WhatsApp-Based Service Workflow
**Priority:** P0 (Critical)

**Requirements:**
- **FR-TM-003:** Technician workflow via WhatsApp Interactive Messages:

  **Step 1: Acknowledge Schedule**
  - Technician receives schedule at 7 PM
  - Button: "Acknowledge" → Confirms receipt
  - If not acknowledged by 9 PM, alert to supervisor

  **Step 2: Start Travel**
  - When leaving for first service
  - Button: "Start Travel to [Container ID]"
  - Backend starts tracking time

  **Step 3: Arrive at Location**
  - When technician reaches client site
  - Button: "Arrived at Location"
  - System validates GPS coordinates (within 50m radius)
  - Log arrival time

  **Step 4: Start Service**
  - Before starting actual work
  - Button: "Start Service"
  - Checklist: "Spare parts verified?" (Yes/No)
  - System starts service timer
  - Admin dashboard shows "In Progress" status

  **Step 5: Service Documentation (During/After)**
  - Interactive flow requests:
    - Photos of issue (before)
    - Video of work process (optional)
    - Photos after repair
    - Used spare parts confirmation (checkbox list)
    - Additional parts required (text input)
    - Client signature capture (later via dashboard link)

  **Step 6: Complete Service**
  - Button: "Complete Service" (disabled until documentation uploaded)
  - System validates:
    - Minimum 2 photos uploaded
    - Spare parts confirmed
    - Minimum service duration met (prevents accidental completion)
  - Log completion time
  - Update container status

  **Step 7: Move to Next Service**
  - System automatically shows next service details
  - Button: "Start Travel to Next Location"
  - Repeat Steps 2-6

  **Step 8: End of Day**
  - After all services completed
  - Button: "End Day"
  - System generates daily report
  - Submit timesheet automatically

- **FR-TM-004:** All WhatsApp interactions shall be logged in database with timestamps
- **FR-TM-005:** System shall send reminders if technician hasn't updated status for 30 minutes during work hours

#### 4.6.3 GPS Tracking
**Priority:** P1 (High)

**Requirements:**
- **FR-TM-006:** System should track technician location (with consent):
  - During work hours only
  - When service is in progress
  - For route optimization and ETA calculation

- **FR-TM-007:** Location data shall be used for:
  - Verifying service location
  - Calculating travel time
  - ETA updates to clients
  - Route adherence analysis

### 4.7 Customer Feedback Module

#### 4.7.1 Automated Feedback Collection
**Priority:** P1 (High)

**Requirements:**
- **FR-CF-001:** Upon service completion, system shall automatically send feedback form to client via WhatsApp within 5 minutes
- **FR-CF-002:** Feedback form (WhatsApp Interactive Message):
  - Rating: 1-5 stars (visual star selection)
  - Quick feedback buttons:
    - "Excellent Service"
    - "Good but took longer"
    - "Issue not fully resolved"
    - "Technician was professional"
    - "Needs improvement"
  - Optional text feedback field
  - Button: "Submit Feedback"

- **FR-CF-003:** Follow-up actions based on rating:
  - **5 stars:** Thank you message + referral program offer
  - **4 stars:** Thank you message
  - **3 stars or below:** Auto-escalate to service manager + follow-up call scheduled

- **FR-CF-004:** Feedback metrics displayed on:
  - Admin dashboard (aggregated)
  - Technician performance dashboard
  - Client portal (their feedback history)

#### 4.7.2 Issue Escalation
**Priority:** P1 (High)

**Requirements:**
- **FR-CF-005:** If client reports "Issue not fully resolved":
  - System shall automatically create follow-up service request
  - Priority escalated to High
  - Same technician assigned (unless rating is low)
  - No additional charge for follow-up

### 4.8 WhatsApp Communication Engine

#### 4.8.1 WhatsApp Business API Integration
**Priority:** P0 (Critical)

**Requirements:**
- **FR-WC-001:** System shall integrate with WhatsApp Business API (Official)
- **FR-WC-002:** All communications shall use approved message templates for:
  - Service notifications
  - Alerts
  - Invoices
  - Schedules
  - Feedback requests
  - Payment reminders

- **FR-WC-003:** Interactive message types to be used:
  - Button messages (max 3 buttons)
  - List messages (for multiple options)
  - Reply buttons
  - Flow messages (multi-step forms)

#### 4.8.2 Message Templates
**Priority:** P0 (Critical)

**Requirements:**
- **FR-WC-004:** System shall maintain library of message templates:

  **Alert Notification Template:**
  ```
  🚨 Alert: {SEVERITY}
  Container: {CONTAINER_ID}
  Issue: {ISSUE_DESCRIPTION}
  
  {RESOLUTION_STEPS or SERVICE_REQUEST}
  
  [Button: View Details] [Button: Request Service]
  ```

  **Service Schedule Template (Client):**
  ```
  ✅ Service Scheduled
  Container: {CONTAINER_ID}
  Date: {DATE}
  Time Window: {TIME_WINDOW}
  Technician: {TECH_NAME}
  
  Track status: {DASHBOARD_LINK}
  
  [Button: Reschedule] [Button: Cancel]
  ```

  **Invoice Template:**
  ```
  📄 Invoice #{INVOICE_NUMBER}
  Service: {SERVICE_DESCRIPTION}
  Amount: ₹{AMOUNT}
  Due Date: {DUE_DATE}
  
  Invoice PDF: {PDF_LINK}
  
  [Button: Pay Now] [Button: View Details]
  ```

  **Technician Schedule Template:**
  ```
  📋 Tomorrow's Schedule ({DATE})
  
  Total Services: {COUNT}
  
  1️⃣ {TIME} - {LOCATION}
     Container: {CONTAINER_ID}
     Issue: {ISSUE}
     Parts: {PARTS_LIST}
     
  2️⃣ {TIME} - {LOCATION}
     ...
  
  Route Map: {MAPS_LINK}
  
  [Button: Acknowledge]
  ```

- **FR-WC-005:** All templates shall be customizable by admin
- **FR-WC-006:** System shall support template variables and dynamic content

#### 4.8.3 Conversation Management
**Priority:** P1 (High)

**Requirements:**
- **FR-WC-007:** System shall maintain conversation history for:
  - Audit trail
  - Context in multi-step interactions
  - Analytics

- **FR-WC-008:** System shall handle:
  - Message delivery status (sent, delivered, read)
  - Failed message retry (3 attempts)
  - Fallback to SMS if WhatsApp fails

### 4.9 Inventory Management Integration

#### 4.9.1 Spare Parts Inventory
**Priority:** P0 (Critical)

**Requirements:**
- **FR-IM-001:** System shall integrate with existing WhatsApp-based inventory management system
- **FR-IM-002:** Integration shall enable:
  - Real-time spare parts availability check
  - Automatic parts reservation when service is scheduled
  - Parts usage logging when service is completed
  - Low stock alerts
  - Reorder triggers

- **FR-IM-003:** Each service request shall link to required spare parts:
  - Part ID
  - Part name
  - Quantity required
  - Availability status
  - Location (warehouse/technician inventory)

#### 4.9.2 Parts Assignment
**Priority:** P0 (Critical)

**Requirements:**
- **FR-IM-004:** When service is scheduled:
  - System shall automatically reserve parts
  - If parts not available, service marked as "Waiting for Parts"
  - Notification sent to procurement team
  - Client informed of delay

- **FR-IM-005:** Technician shall confirm parts received before service day
- **FR-IM-006:** After service completion, technician shall update:
  - Parts actually used
  - Unused parts to be returned
  - Additional parts needed

### 4.10 Admin Dashboard

#### 4.10.1 Dashboard Overview
**Priority:** P0 (Critical)

**Requirements:**
- **FR-AD-001:** Admin dashboard shall provide comprehensive view:

  **Key Metrics (Top Cards):**
  - Total Containers (250)
  - Active Containers (with customers)
  - Containers in Maintenance
  - Active Alerts (by severity)
  - Pending Service Requests
  - Today's Scheduled Services
  - Revenue (MTD, YTD)
  - Average Service TAT

  **Real-Time Monitoring Section:**
  - Live map with all container locations
  - Color-coded markers (Green: OK, Yellow: Alert, Red: Critical)
  - Technician locations (during work hours)
  - Active services (in-progress indicator)

  **Container Health Section:**
  - List of IoT containers with live metrics
  - Last sync time
  - Error indicators
  - Quick filter: All / Errors Only / Offline

  **Service Operations Section:**
  - Service request queue (Kanban view)
    - Pending → Scheduled → In Progress → Completed
  - Drag-and-drop for manual assignment
  - Technician availability grid
  - Today's schedule overview

  **Analytics Section:**
  - Service volume trends (daily/weekly/monthly)
  - Average resolution time
  - First-time fix rate
  - Customer satisfaction scores
  - Technician performance comparison
  - Container utilization rates
  - Revenue analytics

  **Alerts & Notifications Panel:**
  - Recent alerts (last 24 hours)
  - System notifications
  - Overdue service requests
  - Payment overdue clients

- **FR-AD-002:** Dashboard shall refresh in real-time (WebSocket)
- **FR-AD-003:** All widgets shall be clickable for detailed drill-down
- **FR-AD-004:** Dashboard shall support date range filtering
- **FR-AD-005:** Export functionality for all data tables (CSV, Excel, PDF)

#### 4.10.2 Container Management Interface
**Priority:** P0 (Critical)

**Requirements:**
- **FR-AD-006:** Container management interface shall provide:
  - Searchable, filterable list of all containers
  - Bulk actions (assign, update status, export)
  - Individual container detail view with tabs:
    - Overview (specs, current status)
    - Location History (timeline + map)
    - Service History (complete log)
    - Alert History
    - Usage Statistics (charts)
    - Documents (manuals, certificates)
    - Financial (revenue, charges)

- **FR-AD-007:** Admin shall be able to:
  - Add new containers
  - Edit container details
  - Assign/unassign customers
  - Mark containers as inactive
  - Attach/detach Orbcomm devices
  - Upload container documents

#### 4.10.3 Service Management Interface
**Priority:** P0 (Critical)

**Requirements:**
- **FR-AD-008:** Service management interface shall provide:
  - Service request creation form
  - Service request listing (filterable by status, priority, date)
  - Service request detail view
  - Technician assignment (manual/auto)
  - Service cancellation with reason
  - Service timeline tracking

- **FR-AD-009:** Admin shall receive real-time notifications for:
  - New service requests
  - Service started
  - Service completed
  - Service delayed
  - Customer complaints (low ratings)

#### 4.10.4 Technician Management Interface
**Priority:** P1 (High)

**Requirements:**
- **FR-AD-010:** Technician management interface shall provide:
  - Technician list with status indicators
  - Individual technician profile view
  - Performance dashboard per technician
  - Schedule view (calendar format)
  - Availability management
  - Skills matrix editing

#### 4.10.5 Reports & Analytics
**Priority:** P1 (High)

**Requirements:**
- **FR-AD-011:** System shall provide pre-built reports:
  - Daily Operations Report
  - Service Performance Report
  - Container Utilization Report
  - Technician Performance Report
  - Customer Satisfaction Report
  - Financial Report (revenue, outstanding payments)
  - Alert Analysis Report
  - Spare Parts Usage Report

- **FR-AD-012:** Reports shall be:
  - Exportable (PDF, Excel, CSV)
  - Schedulable (daily/weekly/monthly email)
  - Customizable (date range, filters)
  - Shareable via link

- **FR-AD-013:** Custom report builder shall allow:
  - Drag-and-drop field selection
  - Custom filters and grouping
  - Chart type selection
  - Saved report templates

---

## 5. Technical Requirements

### 5.1 Performance Requirements

**NFR-PERF-001:** API response time shall be < 500ms for 95% of requests

**NFR-PERF-002:** Dashboard load time shall be < 2 seconds

**NFR-PERF-003:** Real-time updates shall have latency < 1 second

**NFR-PERF-004:** System shall support 1000 concurrent users

**NFR-PERF-005:** WhatsApp message delivery shall be < 5 seconds

**NFR-PERF-006:** Database queries shall be optimized with proper indexing

**NFR-PERF-007:** Media files (images/videos) shall be compressed before storage

**NFR-PERF-008:** System shall handle 10,000 Orbcomm API calls per day

### 5.2 Scalability Requirements

**NFR-SCALE-001:** System shall be horizontally scalable to support 1000+ containers

**NFR-SCALE-002:** Database shall support sharding for future growth

**NFR-SCALE-003:** Microservices architecture shall allow independent scaling

**NFR-SCALE-004:** Cache layer shall reduce database load by 70%

**NFR-SCALE-005:** CDN shall be used for static assets and media files

### 5.3 Availability & Reliability

**NFR-AVAIL-001:** System uptime shall be 99.9% (excluding planned maintenance)

**NFR-AVAIL-002:** Planned maintenance shall be scheduled during low-traffic windows

**NFR-AVAIL-003:** Automated health checks shall run every 5 minutes

**NFR-AVAIL-004:** Failover mechanisms shall be implemented for critical services

**NFR-AVAIL-005:** Database backups shall be taken daily with 30-day retention

**NFR-AVAIL-006:** Point-in-time recovery shall be possible for last 7 days

**NFR-AVAIL-007:** System shall gracefully degrade if external APIs (Orbcomm, WhatsApp) are unavailable

### 5.4 Security Requirements

**NFR-SEC-001:** All data transmission shall use HTTPS/TLS 1.3

**NFR-SEC-002:** Passwords shall be hashed using bcrypt with salt

**NFR-SEC-003:** API endpoints shall be protected with JWT authentication

**NFR-SEC-004:** Role-based access control (RBAC) shall be implemented

**NFR-SEC-005:** API rate limiting: 100 requests/minute per user

**NFR-SEC-006:** SQL injection prevention through parameterized queries

**NFR-SEC-007:** XSS prevention through input sanitization

**NFR-SEC-008:** CSRF tokens shall be used for state-changing operations

**NFR-SEC-009:** Sensitive data (payment info, personal details) shall be encrypted at rest

**NFR-SEC-010:** Audit logs shall track all critical operations

**NFR-SEC-011:** Session timeout: 30 minutes of inactivity

**NFR-SEC-012:** Failed login attempts: Account locked after 5 attempts for 30 minutes

**NFR-SEC-013:** WhatsApp API credentials shall be stored in secure vault (AWS Secrets Manager)

**NFR-SEC-014:** Regular security audits and penetration testing

### 5.5 Data Management

**NFR-DATA-001:** Data retention policy:
- Transactional data: 7 years
- Container metrics: 2 years (raw), 5 years (aggregated)
- Logs: 90 days
- Media files: 2 years

**NFR-DATA-002:** Personal data shall comply with data privacy regulations

**NFR-DATA-003:** Data anonymization for analytics and reporting

**NFR-DATA-004:** GDPR compliance for data export and deletion requests

**NFR-DATA-005:** Data synchronization between systems shall be near real-time (< 30 seconds)

### 5.6 Monitoring & Observability

**NFR-MON-001:** Application Performance Monitoring (APM) shall be implemented

**NFR-MON-002:** Centralized logging with log aggregation

**NFR-MON-003:** Real-time alerting for:
- System errors
- API failures
- High latency
- Resource utilization > 80%
- Security incidents

**NFR-MON-004:** Distributed tracing for debugging

**NFR-MON-005:** Business metrics dashboards for stakeholders

---

## 6. Integration Requirements

### 6.1 Orbcomm IoT API Integration

**INT-ORB-001:** Integration Type: REST API

**INT-ORB-002:** Authentication: API Key based

**INT-ORB-003:** Data Sync Frequency: Every 5 minutes for active containers

**INT-ORB-004:** Endpoints to integrate:
- GET /devices - List all devices
- GET /devices/{deviceId}/location - Real-time location
- GET /devices/{deviceId}/telemetry - Sensor data
- GET /devices/{deviceId}/alerts - Device alerts
- GET /devices/{deviceId}/history - Historical data

**INT-ORB-005:** Error Handling:
- Retry logic: 3 attempts with exponential backoff
- If device offline > 1 hour, flag as "Communication Lost"
- Admin alert if API fails for > 15 minutes

**INT-ORB-006:** Data Mapping:
- Map Orbcomm device IDs to internal container IDs
- Transform Orbcomm error codes to internal alert classification
- Store raw data for audit purposes

**INT-ORB-007:** Rate Limiting: Respect Orbcomm API limits (configurable)

### 6.2 WhatsApp Business API Integration

**INT-WA-001:** Integration Type: WhatsApp Business Platform (Cloud API)

**INT-WA-002:** Authentication: Bearer Token

**INT-WA-003:** Message Types:
- Text messages
- Template messages
- Interactive messages (buttons, lists)
- Media messages (images, videos, documents, PDFs)
- Flow messages (multi-step forms)

**INT-WA-004:** Webhook Configuration:
- Receive message status updates
- Receive user responses
- Handle button clicks
- Process flow completions

**INT-WA-005:** Template Management:
- Create and submit templates via API
- Version control for templates
- A/B testing capability

**INT-WA-006:** Message Queue:
- Implement message queue (Redis/RabbitMQ)
- Handle rate limits (80 messages/second per number)
- Priority queue for critical messages
- Retry failed messages

**INT-WA-007:** Conversation Tracking:
- 24-hour conversation window tracking
- Session management
- Conversation cost calculation

**INT-WA-008:** Media Handling:
- Upload media to WhatsApp servers
- Generate media IDs
- Download incoming media
- Virus scanning for uploaded files

**INT-WA-009:** Compliance:
- Opt-in/opt-out management
- SPAM prevention
- Template policy compliance

### 6.3 Payment Gateway Integration

**INT-PAY-001:** Recommended Gateway: Razorpay (India-focused) or Stripe

**INT-PAY-002:** Integration Features:
- Payment link generation
- Invoice creation
- Payment status webhooks
- Refund processing
- Payment reminder automation

**INT-PAY-003:** Payment Methods:
- UPI
- Credit/Debit cards
- Net banking
- Digital wallets

**INT-PAY-004:** Security:
- PCI DSS compliance
- No card data storage on servers
- Tokenization for recurring payments

**INT-PAY-005:** Reconciliation:
- Daily payment settlement reports
- Automated reconciliation with invoices
- Discrepancy alerts

### 6.4 Inventory System Integration

**INT-INV-001:** Integration Type: Bidirectional API

**INT-INV-002:** Data Exchange:
- Real-time parts availability check
- Parts reservation
- Parts consumption logging
- Low stock alerts
- Reorder notifications

**INT-INV-003:** Sync Frequency: Real-time for availability, batch for analytics

**INT-INV-004:** Conflict Resolution:
- Inventory system is source of truth for availability
- Service system is source of truth for consumption

### 6.5 Maps & Location Services

**INT-MAP-001:** Provider: Google Maps Platform

**INT-MAP-002:** APIs to use:
- Maps JavaScript API (for dashboards)
- Geocoding API (address to coordinates)
- Distance Matrix API (travel time calculation)
- Directions API (route optimization)
- Places API (location search)

**INT-MAP-003:** Usage Optimization:
- Cache static location data
- Batch distance calculations
- Use Places Autocomplete for address entry

### 6.6 Communication Channels (Backup)

**INT-COM-001:** Email Integration:
- SMTP/SendGrid for transactional emails
- Invoice delivery
- Reports delivery
- Critical alerts backup

**INT-COM-002:** SMS Integration:
- Twilio for SMS backup
- Used when WhatsApp fails
- OTP delivery

---

## 7. AI/ML Components

### 7.1 Alert Classification Model

**AI-ALT-001:** Model Type: Multi-class Classification

**AI-ALT-002:** Input Features:
- Error code
- Container type
- Sensor readings
- Historical failure patterns
- Time since last service
- Usage intensity

**AI-ALT-003:** Output: Severity classification (Critical, High, Medium, Low)

**AI-ALT-004:** Training Data:
- Historical alert data (6+ months)
- Technician feedback on severity accuracy
- Service outcome data

**AI-ALT-005:** Model Performance Target:
- Accuracy: > 85%
- Precision for Critical alerts: > 90%
- Regular retraining: Monthly

**AI-ALT-006:** Implementation:
- scikit-learn Random Forest or XGBoost
- Feature importance analysis
- SHAP values for explainability

### 7.2 Resolution Recommendation System

**AI-RES-001:** Model Type: Content-based Recommendation

**AI-RES-002:** Input: Alert details, container specifications

**AI-RES-003:** Output: 
- Recommended resolution steps (ranked)
- Required spare parts
- Estimated resolution time
- Success probability

**AI-RES-004:** Knowledge Base:
- Maintained knowledge graph of issues → resolutions
- Updated based on successful resolutions
- Technician feedback loop

**AI-RES-005:** Implementation:
- Vector similarity search for similar past issues
- NLP for text analysis
- Collaborative filtering based on successful resolutions

### 7.3 Intelligent Scheduling Optimizer

**AI-SCH-001:** Optimization Algorithm: Hybrid approach

**AI-SCH-002:** Components:
- **Geographic Clustering:** K-means for location grouping
- **Route Optimization:** Genetic Algorithm or Google OR-Tools
- **Constraint Solver:** For business rules and hard constraints
- **ML Predictor:** For service duration estimation

**AI-SCH-003:** Constraints:
- Hard Constraints (must satisfy):
  - Technician working hours
  - Spare parts availability
  - Technician skill match
  - Customer time windows
  
- Soft Constraints (optimize):
  - Minimize total travel time
  - Minimize idle time
  - Balance workload across technicians
  - Prioritize high-severity services

**AI-SCH-004:** Service Duration Prediction:
- Model Type: Regression (Random Forest/Gradient Boosting)
- Features:
  - Service type
  - Container model
  - Technician experience
  - Historical service times
  - Issue complexity
- Target accuracy: MAE < 15 minutes

**AI-SCH-005:** Optimization Objective Function:
```
Minimize: 
  w1 * total_travel_time 
  + w2 * total_service_time 
  + w3 * priority_weighted_delay
  + w4 * workload_imbalance
  - w5 * sla_compliance_score

Where weights (w1-w5) are configurable
```

**AI-SCH-006:** Performance:
- Optimization time: < 2 minutes for 50 service requests
- Solution quality: Within 5% of optimal

**AI-SCH-007:** Continuous Improvement:
- Compare predicted vs actual durations
- Adjust model based on feedback
- A/B testing of scheduling strategies

### 7.4 Predictive Maintenance Model

**AI-PM-001:** Model Type: Time-series forecasting + Anomaly detection

**AI-PM-002:** Objective: Predict potential failures before they occur

**AI-PM-003:** Input Features:
- Historical sensor readings (temperature, vibration, etc.)
- Usage patterns
- Service history
- Environmental factors
- Age of container

**AI-PM-004:** Output:
- Failure probability (next 7, 14, 30 days)
- Recommended preventive actions
- Optimal maintenance schedule

**AI-PM-005:** Implementation:
- LSTM networks for time-series prediction
- Isolation Forest for anomaly detection
- Survival analysis for failure prediction

**AI-PM-006:** Business Value:
- Reduce emergency service calls by 30%
- Extend container lifespan by 20%
- Improve customer satisfaction

**AI-PM-007:** Phase: Phase 2 (Post-MVP)

### 7.5 Dynamic Pricing Model

**AI-PRC-001:** Model Type: Regression + Business Rules

**AI-PRC-002:** Objective: Optimize pricing based on multiple factors

**AI-PRC-003:** Input Features:
- Service complexity
- Spare parts cost
- Travel distance
- Time of day (regular/after-hours)
- Customer tier
- Service history
- Market rates
- Technician utilization

**AI-PRC-004:** Output: Recommended service price

**AI-PRC-005:** Implementation:
- Base pricing from rules engine
- ML adjustment factor based on historical acceptance rates
- Real-time market rate comparison

**AI-PRC-006:** Phase: Phase 2

### 7.6 Customer Churn Prediction

**AI-CHR-001:** Objective: Identify customers at risk of leaving

**AI-CHR-002:** Input Features:
- Service frequency
- Payment delays
- Satisfaction scores
- Container usage patterns
- Support ticket frequency
- Contract renewal proximity

**AI-CHR-003:** Output: Churn probability score

**AI-CHR-004:** Action:
- High-risk customers: Proactive engagement by account manager
- Retention offers (discounts, priority service)

**AI-CHR-005:** Phase: Phase 2

### 7.7 NLP-Based Issue Extraction

**AI-NLP-001:** Objective: Extract structured data from unstructured issue descriptions

**AI-NLP-002:** Use Cases:
- Parse client complaints (phone calls transcribed)
- Extract key information from technician notes
- Automated ticket categorization

**AI-NLP-003:** Implementation:
- Named Entity Recognition (NER) for container IDs, parts
- Text classification for issue categories
- Sentiment analysis for urgency detection

**AI-NLP-004:** Integration: OpenAI GPT-4 API or fine-tuned BERT model

---

## 8. User Flows

### 8.1 Automated Service Flow (IoT Container)

```
1. Orbcomm device detects error → Sends to Orbcomm cloud
2. System polls Orbcomm API → Fetches new alert
3. AI Model classifies alert severity
4. IF severity = Low/Medium:
   → Send resolution steps to client (WhatsApp)
   → Log alert in dashboard
   → Monitor if issue persists
5. IF severity = High/Critical:
   → Create service request automatically
   → AI predicts required parts & service duration
   → Check parts availability in inventory
   → IF parts available:
      → Generate invoice based on customer type
      → Send invoice to client (WhatsApp + Email)
      → Client clicks "Pay Now" or "Approve Service"
      → IF customer type requires prepayment:
         → Wait for payment confirmation
      → Add to scheduling queue
   → IF parts not available:
      → Notify procurement team
      → Inform client of delay
6. Scheduling Engine runs (daily 6 PM):
   → Optimizes next day assignments
   → Assigns technician
   → Sends schedule to technician (WhatsApp)
   → Sends confirmation to client (WhatsApp)
7. Service Day:
   → Technician: "Start Travel" (WhatsApp button)
   → System updates client: "Technician en route"
   → Technician: "Arrived" (GPS validated)
   → System updates client: "Service started"
   → Technician: "Start Service" (WhatsApp button)
   → Technician uploads documentation
   → Technician: "Complete Service"
   → System marks service complete
   → IF invoice not paid (post-paid customers):
      → Send final invoice with payment link
8. Post-Service:
   → Send feedback form to client (WhatsApp)
   → Client submits rating
   → IF rating < 3:
      → Escalate to manager
      → Schedule follow-up call
   → Generate service report
   → Update container history
   → Update inventory (parts consumed)
   → Update technician performance metrics
```

### 8.2 Manual Service Request Flow (Non-IoT Container)

```
1. Client calls service center
2. Service coordinator receives complaint
3. Coordinator logs in dashboard:
   → Selects container ID
   → Enters issue description (voice-to-text option)
   → Uploads photos/videos if available
   → Selects severity (or AI suggests)
4. System follows same flow as automated (from step 5 onwards)
```

### 8.3 Client Self-Service Flow

```
1. Client logs into portal
2. Navigates to "My Containers"
3. Selects specific container
4. Sees active alert/issue
5. Clicks "Request Service"
6. Fills form:
   → Issue description
   → Preferred time window
   → Upload media (optional)
7. Submits request
8. System creates service request
9. Client receives confirmation (WhatsApp + Email)
10. Follows standard service flow
```

### 8.4 Technician Daily Workflow

```
Morning:
1. Receives schedule at 7 PM previous day (WhatsApp)
2. Reviews schedule, acknowledges
3. Verifies spare parts allocation
4. IF parts missing: Reports via WhatsApp

Service Day:
1. 8:00 AM - Day starts
2. Clicks "Start Travel to [First Location]"
3. Uses Google Maps link for navigation
4. Arrives at location → "Arrived" button
5. Meets client → "Start Service" button
6. Completes work
7. Takes photos (before/after)
8. Records video of repair (optional)
9. Confirms parts used
10. Client signs off (digital signature)
11. Clicks "Complete Service"
12. System prompts: "Move to next location?" → "Yes"
13. Repeats steps 2-12 for all assigned services
14. After last service → "End Day" button
15. System generates daily report
16. Technician reviews and submits timesheet

Evening:
17. Receives next day schedule at 7 PM
```

### 8.5 Invoice & Payment Flow

**For Prepaid Customers (Standard/Basic):**
```
1. Service request created
2. Invoice generated immediately
3. Sent to client (WhatsApp + Email)
4. Client clicks "Pay Now"
5. Redirected to payment gateway
6. Completes payment
7. Webhook confirms payment
8. Service scheduled
9. Technician assigned
```

**For Postpaid Customers (Premium):**
```
1. Service request created
2. Service scheduled immediately (no payment wait)
3. Service completed
4. Final invoice generated (actual costs)
5. Sent to client
6. Payment terms: 30 days
7. Automated reminders:
   - Day 27: Gentle reminder
   - Day 30: Payment due today
   - Day 32: Overdue notice
   - Day 37: Service suspension warning
```

---

## 9. Data Model

### 9.1 Core Entities

#### Container
```
id: UUID (PK)
container_code: String (Unique, indexed)
type: Enum (Refrigerated, Dry, Special)
manufacturer: String
model: String
capacity: Float (cubic meters)
purchase_date: Date
status: Enum (Active, Maintenance, Retired, In-Transit)
orbcomm_device_id: String (nullable)
has_iot: Boolean
current_location: Point (GPS coordinates)
current_customer_id: UUID (FK → Customer)
assignment_date: Date
expected_return_date: Date
created_at: Timestamp
updated_at: Timestamp
```

#### Customer
```
id: UUID (PK)
company_name: String
contact_person: String
email: String (unique, indexed)
phone: String (unique, indexed)
whatsapp_number: String (unique, indexed)
customer_tier: Enum (Premium, Standard, Basic)
payment_terms: Enum (Prepaid, Net15, Net30)
billing_address: Text
shipping_address: Text
gstin: String
account_manager_id: UUID (FK → User)
status: Enum (Active, Inactive, Suspended)
created_at: Timestamp
updated_at: Timestamp
```

#### Alert
```
id: UUID (PK)
container_id: UUID (FK → Container)
alert_code: String
alert_type: Enum (Error, Warning, Info)
severity: Enum (Critical, High, Medium, Low)
description: Text
source: Enum (Orbcomm, Manual, Predictive)
detected_at: Timestamp
acknowledged_at: Timestamp (nullable)
acknowledged_by: UUID (FK → User, nullable)
resolved_at: Timestamp (nullable)
resolution_method: Enum (Auto, Service, DIY, Ignored)
service_request_id: UUID (FK → ServiceRequest, nullable)
metadata: JSONB (sensor readings, raw data)
created_at: Timestamp
```

#### ServiceRequest
```
id: UUID (PK)
request_number: String (unique, auto-generated)
container_id: UUID (FK → Container)
customer_id: UUID (FK → Customer)
alert_id: UUID (FK → Alert, nullable)
issue_description: Text
priority: Enum (Urgent, High, Normal, Low)
status: Enum (Pending, Approved, Scheduled, InProgress, Completed, Cancelled)
requested_at: Timestamp
approved_at: Timestamp (nullable)
scheduled_date: Date (nullable)
scheduled_time_window: String (e.g., "10:00-12:00")
assigned_technician_id: UUID (FK → Technician, nullable)
actual_start_time: Timestamp (nullable)
actual_end_time: Timestamp (nullable)
service_duration: Integer (minutes)
resolution_notes: Text
required_parts: JSONB (array of part IDs)
used_parts: JSONB (array with quantities)
total_cost: Decimal
invoice_id: UUID (FK → Invoice, nullable)
customer_feedback_id: UUID (FK → Feedback, nullable)
created_by: UUID (FK → User)
created_at: Timestamp
updated_at: Timestamp
```

#### Technician
```
id: UUID (PK)
user_id: UUID (FK → User)
employee_code: String (unique)
name: String
phone: String
whatsapp_number: String
email: String
base_location: Point (GPS)
service_radius: Integer (km)
skills: JSONB (array of skill codes)
experience_level: Enum (Junior, Mid, Senior, Expert)
hourly_rate: Decimal
working_hours_start: Time
working_hours_end: Time
is_available: Boolean
current_location: Point (GPS, updated in real-time)
average_rating: Float
total_services_completed: Integer
first_time_fix_rate: Float (percentage)
created_at: Timestamp
updated_at: Timestamp
```

#### Invoice
```
id: UUID (PK)
invoice_number: String (unique, auto-generated)
service_request_id: UUID (FK → ServiceRequest)
customer_id: UUID (FK → Customer)
issue_date: Date
due_date: Date
line_items: JSONB (array of {description, quantity, rate, amount})
subtotal: Decimal
tax_rate: Float
tax_amount: Decimal
total_amount: Decimal
payment_status: Enum (Pending, PartiallyPaid, Paid, Overdue, Cancelled)
amount_paid: Decimal
payment_date: Timestamp (nullable)
payment_method: String (nullable)
payment_reference: String (nullable)
pdf_url: String
sent_at: Timestamp
created_at: Timestamp
updated_at: Timestamp
```

#### Feedback
```
id: UUID (PK)
service_request_id: UUID (FK → ServiceRequest)
customer_id: UUID (FK → Customer)
technician_id: UUID (FK → Technician)
rating: Integer (1-5)
feedback_text: Text (nullable)
quick_feedback_tags: JSONB (array of selected tags)
issue_resolved: Boolean
submitted_at: Timestamp
follow_up_required: Boolean
follow_up_completed: Boolean
created_at: Timestamp
```

#### ScheduledService
```
id: UUID (PK)
service_request_id: UUID (FK → ServiceRequest)
technician_id: UUID (FK → Technician)
scheduled_date: Date
sequence_number: Integer (order in technician's day)
estimated_start_time: Time
estimated_end_time: Time
estimated_travel_time: Integer (minutes)
estimated_service_duration: Integer (minutes)
route_order: Integer
total_distance: Float (km)
optimization_score: Float
status: Enum (Scheduled, InProgress, Completed, Rescheduled, Cancelled)
actual_start_time: Timestamp (nullable)
actual_end_time: Timestamp (nullable)
created_at: Timestamp
updated_at: Timestamp
```

#### WhatsAppMessage
```
id: UUID (PK)
recipient_type: Enum (Customer, Technician, Admin)
recipient_id: UUID
phone_number: String
message_type: Enum (Text, Template, Interactive, Media, Flow)
template_name: String (nullable)
message_content: JSONB
whatsapp_message_id: String (from WhatsApp API)
status: Enum (Sent, Delivered, Read, Failed)
sent_at: Timestamp
delivered_at: Timestamp (nullable)
read_at: Timestamp (nullable)
failed_reason: String (nullable)
conversation_id: UUID (nullable)
related_entity_type: String (e.g., "ServiceRequest")
related_entity_id: UUID
created_at: Timestamp
```

#### ContainerMetrics (Time-Series Data)
```
id: UUID (PK)
container_id: UUID (FK → Container)
timestamp: Timestamp (indexed)
location: Point (GPS)
temperature: Float (nullable)
humidity: Float (nullable)
power_status: Boolean
door_status: Enum (Open, Closed)
battery_level: Float (percentage, nullable)
signal_strength: Integer
error_codes: JSONB (array)
raw_data: JSONB (all sensor readings)
```

### 9.2 Relationships

```
Customer 1---* Container (one customer can have multiple containers)
Container 1---* Alert (one container can have multiple alerts)
Alert 1---1 ServiceRequest (one alert can create one service request)
ServiceRequest *---1 Customer
ServiceRequest *---1 Container
ServiceRequest *---1 Technician
ServiceRequest 1---1 Invoice
ServiceRequest 1---1 Feedback
ServiceRequest 1---1 ScheduledService
Technician 1---* ServiceRequest
Container 1---* ContainerMetrics
```

### 9.3 Indexes

**Critical Indexes for Performance:**
```
- Container.container_code (unique)
- Container.current_customer_id
- Container.status
- Alert.container_id + detected_at (composite)
- Alert.severity + resolved_at (composite)
- ServiceRequest.status + scheduled_date (composite)
- ServiceRequest.assigned_technician_id + scheduled_date
- ServiceRequest.customer_id + status
- ContainerMetrics.container_id + timestamp (composite)
- WhatsAppMessage.recipient_id + sent_at
- Invoice.customer_id + payment_status
```

---

## 10. Security & Compliance

### 10.1 Authentication & Authorization

**AUTH-001:** Multi-factor authentication for admin users

**AUTH-002:** JWT-based authentication with refresh tokens

**AUTH-003:** Role-based access control (RBAC):
- **Super Admin:** Full system access
- **Admin:** Operations management, no system config
- **Service Coordinator:** Service request management
- **Technician:** Own assignments only
- **Client:** Own containers and services only
- **Viewer:** Read-only access

**AUTH-004:** API key authentication for integration endpoints

**AUTH-005:** OAuth 2.0 for third-party integrations

### 10.2 Data Privacy

**PRIV-001:** Comply with GDPR and Indian data protection laws

**PRIV-002:** Data minimization: Collect only necessary data

**PRIV-003:** Right to access: Clients can download their data

**PRIV-004:** Right to deletion: Data deletion upon request (with legal retention exceptions)

**PRIV-005:** Consent management for WhatsApp communications

**PRIV-006:** Data anonymization for analytics

### 10.3 Audit & Compliance

**AUD-001:** Audit logs for all critical operations:
- User login/logout
- Data modifications
- Service assignments
- Payment transactions
- Configuration changes

**AUD-002:** Immutable audit trail (append-only)

**AUD-003:** Audit log retention: 7 years

**AUD-004:** Regular compliance audits

### 10.4 Data Backup & Recovery

**BACK-001:** Automated daily backups

**BACK-002:** Backup retention: 30 days

**BACK-003:** Backup testing: Monthly

**BACK-004:** Disaster recovery plan with RTO < 4 hours, RPO < 1 hour

**BACK-005:** Geographic redundancy for critical data

---

## 11. Implementation Roadmap

### Phase 1: MVP (3-4 months)

**Month 1: Foundation**
- Database design and setup
- Core API development
- User authentication
- Admin dashboard (basic)
- Container registry
- Orbcomm API integration

**Month 2: Core Features**
- Alert detection and classification
- Service request management
- Technician management
- Basic WhatsApp integration (templates)
- Client portal (basic)

**Month 3: Automation**
- Scheduling engine (basic algorithm)
- WhatsApp interactive messages
- Technician workflow (WhatsApp buttons)
- Invoice generation
- Payment gateway integration

**Month 4: Polish & Launch**
- Feedback system
- Dashboard enhancements
- Real-time updates
- Testing and bug fixes
- User training
- Soft launch with 20 containers

**MVP Scope:**
- 90 IoT containers tracked
- Automated alert detection
- Manual service request creation
- Basic scheduling (semi-automated)
- WhatsApp notifications
- Client portal (view-only)
- Admin dashboard

### Phase 2: AI & Advanced Features (2-3 months)

**Month 5-6:**
- AI alert classification model
- Intelligent scheduling optimizer
- Service duration prediction
- Resolution recommendation system
- Advanced analytics
- Custom reports
- Mobile-responsive improvements

**Month 7:**
- Predictive maintenance (basic)
- Inventory integration
- Route optimization enhancement
- Performance metrics dashboard
- A/B testing framework

### Phase 3: Scale & Optimize (Ongoing)

**Month 8+:**
- Support for 250+ containers
- Multi-location expansion
- Predictive analytics
- Customer churn prediction
- Dynamic pricing
- Mobile app (native)
- Advanced NLP features
- Integration marketplace

---

## 12. Success Metrics (KPIs)

### 12.1 Operational Metrics

**OP-KPI-001:** Average Service TAT
- Target: < 24 hours for High severity, < 4 hours for Critical
- Measurement: Time from alert detection to service completion

**OP-KPI-002:** First-Time Fix Rate
- Target: > 90%
- Measurement: Percentage of services resolved in first visit

**OP-KPI-003:** Technician Utilization Rate
- Target: 75-85%
- Measurement: (Active service time / Total working hours) × 100

**OP-KPI-004:** Service Scheduling Efficiency
- Target: < 20% idle time between services
- Measurement: Total travel + idle time vs. service time

**OP-KPI-005:** Alert Response Time
- Target: < 5 minutes for automated alerts
- Measurement: Time from alert detection to client notification

**OP-KPI-006:** Parts Availability Rate
- Target: > 95%
- Measurement: Services completed without parts delay

### 12.2 Customer Experience Metrics

**CX-KPI-001:** Customer Satisfaction Score (CSAT)
- Target: > 4.5/5
- Measurement: Average feedback rating

**CX-KPI-002:** Net Promoter Score (NPS)
- Target: > 50
- Measurement: Quarterly NPS survey

**CX-KPI-003:** Customer Effort Score
- Target: < 2/5 (lower is better)
- Measurement: How easy was it to get service

**CX-KPI-004:** Container Downtime
- Target: < 5% of total operational time
- Measurement: Time in maintenance/repair vs. active time

**CX-KPI-005:** Communication Response Rate
- Target: > 95% clients read WhatsApp messages within 1 hour
- Measurement: WhatsApp read receipts

### 12.3 Business Metrics

**BUS-KPI-001:** Revenue per Container
- Target: ₹X per month (baseline to be established)
- Measurement: Total revenue / active containers

**BUS-KPI-002:** Service Cost per Container
- Target: < 15% of revenue
- Measurement: Total service costs / revenue

**BUS-KPI-003:** Payment Collection Rate
- Target: > 95% within due date
- Measurement: On-time payments / total invoices

**BUS-KPI-004:** Container Utilization Rate
- Target: > 85%
- Measurement: Containers with customers / total containers

**BUS-KPI-005:** Operational Cost Reduction
- Target: 40% reduction from baseline
- Measurement: Compare pre-automation vs. post-automation costs

### 12.4 Technical Metrics

**TECH-KPI-001:** System Uptime
- Target: 99.9%
- Measurement: (Total time - downtime) / total time

**TECH-KPI-002:** API Response Time
- Target: p95 < 500ms
- Measurement: 95th percentile API latency

**TECH-KPI-003:** WhatsApp Message Delivery Success
- Target: > 98%
- Measurement: Delivered messages / sent messages

**TECH-KPI-004:** Real-time Data Sync Latency
- Target: < 30 seconds
- Measurement: Time lag for Orbcomm data sync

**TECH-KPI-005:** Error Rate
- Target: < 0.1% of requests
- Measurement: Failed requests / total requests

### 12.5 AI Model Performance Metrics

**AI-KPI-001:** Alert Classification Accuracy
- Target: > 85%
- Measurement: Correctly classified alerts / total alerts

**AI-KPI-002:** Scheduling Optimization Score
- Target: > 80% (vs. theoretical optimal)
- Measurement: Actual efficiency / optimal efficiency

**AI-KPI-003:** Service Duration Prediction Accuracy
- Target: MAE < 15 minutes
- Measurement: |Predicted time - actual time|

**AI-KPI-004:** Predictive Maintenance Accuracy
- Target: > 75% precision for failure prediction
- Measurement: True positives / (True positives + False positives)

---

## 13. Risk Management

### 13.1 Technical Risks

**RISK-TECH-001:** Orbcomm API Downtime
- Impact: High - Cannot track IoT containers
- Probability: Medium
- Mitigation: 
  - Cache last known state
  - Fallback to manual entry
  - SLA with Orbcomm for uptime guarantee
  - Multi-vendor strategy for future

**RISK-TECH-002:** WhatsApp API Policy Changes
- Impact: High - Communication channel disrupted
- Probability: Low
- Mitigation:
  - Maintain email/SMS backup channels
  - Stay updated with WhatsApp policy changes
  - Build flexible messaging abstraction layer
  - Consider alternate platforms (Telegram Business)

**RISK-TECH-003:** Data Loss
- Impact: Critical
- Probability: Low
- Mitigation:
  - Automated daily backups
  - Geographic redundancy
  - Point-in-time recovery
  - Regular backup testing

**RISK-TECH-004:** Security Breach
- Impact: Critical
- Probability: Low
- Mitigation:
  - Regular security audits
  - Penetration testing
  - WAF (Web Application Firewall)
  - Intrusion detection system
  - Incident response plan

**RISK-TECH-005:** Scalability Issues
- Impact: Medium
- Probability: Medium
- Mitigation:
  - Load testing before launch
  - Horizontal scaling architecture
  - Performance monitoring
  - Capacity planning

### 13.2 Operational Risks

**RISK-OP-001:** Technician Resistance to Technology
- Impact: Medium
- Probability: Medium
- Mitigation:
  - Comprehensive training program
  - Gradual rollout
  - Incentives for adoption
  - Dedicated support helpline

**RISK-OP-002:** Customer Adoption Issues
- Impact: Medium
- Probability: Low
- Mitigation:
  - User-friendly interface
  - Onboarding tutorials
  - 24/7 customer support
  - Fallback to traditional communication

**RISK-OP-003:** Inventory Integration Failure
- Impact: Medium
- Probability: Medium
- Mitigation:
  - Thorough integration testing
  - Manual override capability
  - Clear escalation process
  - Regular sync validation

**RISK-OP-004:** Scheduling Algorithm Inefficiency
- Impact: Medium
- Probability: Medium
- Mitigation:
  - Manual override available
  - Gradual AI adoption (start with suggestions)
  - Continuous model improvement
  - Feedback loop from field teams

### 13.3 Business Risks

**RISK-BUS-001:** Customer Rejection of Automated Service
- Impact: High
- Probability: Low
- Mitigation:
  - Maintain human touchpoints for critical issues
  - Option for manual coordinator assignment
  - Gradual automation introduction
  - Premium support tier with dedicated coordinator

**RISK-BUS-002:** Cost Overruns
- Impact: Medium
- Probability: Medium
- Mitigation:
  - Phased implementation
  - Fixed-price vendor contracts
  - Regular budget reviews
  - Prioritization of features

**RISK-BUS-003:** Competitor Adoption of Similar Technology
- Impact: Low
- Probability: High
- Mitigation:
  - Fast time-to-market
  - Continuous innovation
  - Strong customer relationships
  - Proprietary AI models

---

## 14. Testing Strategy

### 14.1 Unit Testing
- Code coverage target: > 80%
- Automated tests for all business logic
- Test frameworks: Jest (JS), pytest (Python)

### 14.2 Integration Testing
- API endpoint testing
- External integration testing (Orbcomm, WhatsApp, Payment)
- Database transaction testing
- Message queue testing

### 14.3 System Testing
- End-to-end workflow testing
- Performance testing (load testing with 1000+ concurrent users)
- Stress testing (system behavior under extreme load)
- Security testing (OWASP Top 10)

### 14.4 User Acceptance Testing (UAT)
- Alpha testing with internal team (2 weeks)
- Beta testing with 5 pilot customers (4 weeks)
- Feedback incorporation
- User training refinement

### 14.5 AI Model Testing
- Model accuracy validation
- A/B testing of different models
- Edge case testing
- Bias detection and mitigation

---

## 15. Documentation Requirements

### 15.1 Technical Documentation
- System architecture diagram
- API documentation (Swagger/OpenAPI)
- Database schema documentation
- Integration guide
- Deployment guide
- Troubleshooting guide

### 15.2 User Documentation
- Admin user manual
- Client portal guide
- Technician WhatsApp workflow guide
- Quick reference cards
- Video tutorials
- FAQs

### 15.3 Process Documentation
- Standard Operating Procedures (SOPs)
- Escalation matrix
- Incident response procedures
- Change management process
- Data backup and recovery procedures

---

## 16. Training Plan

### 16.1 Admin Training (3 days)
- Day 1: System overview, dashboard navigation
- Day 2: Service management, scheduling, reporting
- Day 3: Configuration, troubleshooting, advanced features

### 16.2 Service Coordinator Training (2 days)
- Day 1: Service request creation, customer management
- Day 2: Communication handling, escalation procedures

### 16.3 Technician Training (1 day)
- Morning: WhatsApp workflow demonstration
- Afternoon: Hands-on practice with test scenarios
- Documentation upload training
- Q&A session

### 16.4 Customer Onboarding (Self-service + Webinar)
- Self-service video tutorials (10 mins)
- Monthly webinar for Q&A
- Dedicated onboarding support for premium customers

---

## 17. Support & Maintenance

### 17.1 Support Tiers

**Tier 1: Self-Service**
- Knowledge base
- Video tutorials
- Chatbot for common queries
- Email support (response within 24 hours)

**Tier 2: Standard Support**
- Email/WhatsApp support (response within 4 hours)
- Phone support (business hours)
- Bug fixes in next release

**Tier 3: Priority Support (Premium Customers)**
- 24/7 phone/WhatsApp support
- Dedicated account manager
- Response within 1 hour
- Priority bug fixes
- Quarterly business reviews

### 17.2 Maintenance Windows
- Scheduled maintenance: Sunday 2 AM - 4 AM IST
- Advance notification: 7 days
- Emergency maintenance: As needed with 2-hour notice

### 17.3 Continuous Improvement
- Monthly feature releases
- Quarterly major updates
- User feedback incorporation
- AI model retraining monthly
- Performance optimization quarterly

---

## 18. Cost Estimation

### 18.1 Development Costs (One-time)

**Team Composition (6 months):**
- 1 Tech Lead: ₹2,00,000/month × 6 = ₹12,00,000
- 2 Backend Developers: ₹1,20,000/month × 6 × 2 = ₹14,40,000
- 2 Frontend Developers: ₹1,00,000/month × 6 × 2 = ₹12,00,000
- 1 AI/ML Engineer: ₹1,50,000/month × 6 = ₹9,00,000
- 1 QA Engineer: ₹80,000/month × 6 = ₹4,80,000
- 1 DevOps Engineer: ₹1,20,000/month × 6 = ₹7,20,000
- 1 UI/UX Designer: ₹1,00,000/month × 4 = ₹4,00,000
- 1 Product Manager: ₹1,50,000/month × 6 = ₹9,00,000

**Total Development: ₹72,40,000**

**Other One-time Costs:**
- Infrastructure setup: ₹5,00,000
- Third-party tools/licenses: ₹3,00,000
- Testing & QA tools: ₹2,00,000
- Training & documentation: ₹3,00,000
- Contingency (15%): ₹12,81,000

**Total One-time: ₹98,21,000 (approx. ₹1 Crore)**

### 18.2 Recurring Costs (Monthly)

**Infrastructure (AWS/GCP):**
- Compute (EC2/Compute Engine): ₹80,000
- Database (RDS/Cloud SQL): ₹50,000
- Storage (S3/Cloud Storage): ₹20,000
- CDN: ₹15,000
- Monitoring & Logging: ₹10,000
**Subtotal: ₹1,75,000**

**Third-party Services:**
- WhatsApp Business API: ₹1,50,000 (conversation-based pricing)
- Orbcomm API: ₹50,000
- Payment Gateway: 2% of transactions (variable)
- Maps API: ₹30,000
- Email/SMS: ₹10,000
**Subtotal: ₹2,40,000**

**Support & Maintenance:**
- 1 DevOps Engineer: ₹1,20,000
- 2 Support Engineers: ₹60,000 × 2 = ₹1,20,000
- Ongoing development: ₹2,00,000
**Subtotal: ₹4,40,000**

**Total Monthly Recurring: ₹8,55,000**
**Annual Recurring: ₹1,02,60,000**

### 18.3 ROI Projection

**Current Manual Process Costs (Estimated):**
- 3 Full-time coordinators: ₹50,000 × 3 = ₹1,50,000/month
- Inefficient scheduling (lost productivity): ₹1,00,000/month
- Delayed service response (customer churn): ₹2,00,000/month
- Manual error costs: ₹50,000/month
**Total Current Monthly: ₹5,00,000**

**Post-automation Monthly Costs:**
- System recurring costs: ₹8,55,000
- Reduced to 1 coordinator: ₹50,000
**Total New Monthly: ₹9,05,000**

**Initial Investment Breakeven:**
- Additional monthly cost: ₹4,05,000
- But increased efficiency = Additional 50 services/month × ₹5,000 profit = ₹2,50,000
- Net additional cost: ₹1,55,000/month
- Breakeven from development investment: ₹1 Crore / ₹1,55,000 = ~65 months

**However, considering:**
- 40% operational cost reduction after 12 months
- 30% increase in service capacity
- Improved customer retention (20% churn reduction)
- Better resource utilization

**Realistic ROI:** 18-24 months

---

## 19. Success Criteria for MVP Launch

### 19.1 Functional Criteria
✅ All 90 IoT containers connected and syncing data
✅ Alert detection working with 80%+ accuracy
✅ Service request creation (automated + manual)
✅ WhatsApp notifications for all stakeholders
✅ Technician workflow functional end-to-end
✅ Client portal accessible with real-time data
✅ Admin dashboard with core features
✅ Invoice generation and payment integration
✅ Feedback collection automated

### 19.2 Performance Criteria
✅ System uptime > 99% during beta
✅ API response time < 1 second (p95)
✅ Zero critical bugs
✅ < 5 high-priority bugs
✅ WhatsApp message delivery > 95%

### 19.3 User Acceptance Criteria
✅ 80% beta users rate system 4+ stars
✅ 90% technicians successfully complete workflow training
✅ 5 pilot customers onboarded successfully
✅ Positive feedback from operations team

### 19.4 Business Criteria
✅ Service TAT reduced by 50% compared to baseline
✅ Manual coordination time reduced by 70%
✅ Customer satisfaction maintained or improved
✅ Zero data loss or security incidents

---

## 20. Post-Launch Roadmap

### Q1 Post-Launch (Months 1-3)
- Monitor system stability
- Collect user feedback
- Bug fixes and minor enhancements
- Onboard 50 more containers
- Optimize AI models based on real data
- Document lessons learned

### Q2 Post-Launch (Months 4-6)
- Roll out to all 250 containers
- Launch mobile app (React Native)
- Advanced analytics dashboard
- Predictive maintenance features
- Multi-language support (Hindi, regional)
- Customer referral program

### Q3 Post-Launch (Months 7-9)
- Voice-based interactions (IVR integration)
- Advanced route optimization
- Dynamic pricing implementation
- Marketplace for spare parts
- Integration with accounting software
- White-label solution for partners

### Q4 Post-Launch (Months 10-12)
- International expansion readiness
- Multi-currency support
- Compliance certifications (ISO, SOC2)
- API marketplace for third-party integrations
- Blockchain for service history (optional)
- AR-based technician assistance

---

## 21. Glossary

**TAT:** Turn-Around Time - Duration from service request to completion

**IoT:** Internet of Things - Connected devices that transmit data

**SLA:** Service Level Agreement - Agreed service standards

**RBAC:** Role-Based Access Control - Permission management system

**JWT:** JSON Web Token - Authentication token standard

**API:** Application Programming Interface - Software integration endpoint

**CDN:** Content Delivery Network - Distributed content serving

**ML:** Machine Learning - AI subset for pattern learning

**NLP:** Natural Language Processing - AI for text understanding

**GPS:** Global Positioning System - Location tracking technology

**CSAT:** Customer Satisfaction Score - Customer happiness metric

**NPS:** Net Promoter Score - Customer loyalty metric

**MAE:** Mean Absolute Error - Model accuracy metric

**RTO:** Recovery Time Objective - Max downtime tolerance

**RPO:** Recovery Point Objective - Max data loss tolerance

---

## 22. Appendices

### Appendix A: API Endpoint List (Sample)

**Container Endpoints:**
```
GET    /api/v1/containers
GET    /api/v1/containers/{id}
POST   /api/v1/containers
PUT    /api/v1/containers/{id}
DELETE /api/v1/containers/{id}
GET    /api/v1/containers/{id}/alerts
GET    /api/v1/containers/{id}/metrics
GET    /api/v1/containers/{id}/location-history
```

**Service Request Endpoints:**
```
GET    /api/v1/service-requests
GET    /api/v1/service-requests/{id}
POST   /api/v1/service-requests
PUT    /api/v1/service-requests/{id}
POST   /api/v1/service-requests/{id}/assign
POST   /api/v1/service-requests/{id}/start
POST   /api/v1/service-requests/{id}/complete
POST   /api/v1/service-requests/{id}/cancel
```

**Scheduling Endpoints:**
```
POST   /api/v1/scheduling/optimize
GET    /api/v1/scheduling/daily/{date}
GET    /api/v1/scheduling/technician/{id}/{date}
PUT    /api/v1/scheduling/{id}/reschedule
```

**WhatsApp Endpoints:**
```
POST   /api/v1/whatsapp/send
POST   /api/v1/whatsapp/webhook
GET    /api/v1/whatsapp/templates
POST   /api/v1/whatsapp/templates
```

### Appendix B: WhatsApp Message Templates (Detailed)

**Template 1: Critical Alert**
```json
{
  "name": "critical_alert_notification",
  "language": "en",
  "category": "ALERT_UPDATE",
  "components": [
    {
      "type": "HEADER",
      "format": "TEXT",
      "text": "🚨 CRITICAL ALERT"
    },
    {
      "type": "BODY",
      "text": "Container {{1}} requires immediate attention.\n\nIssue: {{2}}\nLocation: {{3}}\n\nA service technician will be assigned shortly.\n\nService Request #{{4}}"
    },
    {
      "type": "FOOTER",
      "text": "Reply URGENT for immediate callback"
    },
    {
      "type": "BUTTONS",
      "buttons": [
        {
          "type": "QUICK_REPLY",
          "text": "View Details"
        },
        {
          "type": "QUICK_REPLY",
          "text": "Call Support"
        }
      ]
    }
  ]
}
```

### Appendix C: Scheduling Algorithm Pseudocode

```python
def optimize_daily_schedule(service_requests, technicians, date):
    # Step 1: Filter eligible requests
    eligible_requests = filter_by_date_and_status(service_requests, date)
    
    # Step 2: Check spare parts availability
    requests_with_parts = check_parts_availability(eligible_requests)
    
    # Step 3: Filter available technicians
    available_techs = get_available_technicians(technicians, date)
    
    # Step 4: Match skills
    matched_requests = match_skills(requests_with_parts, available_techs)
    
    # Step 5: Geographic clustering
    clusters = kmeans_clustering(matched_requests, n_clusters=len(available_techs))
    
    # Step 6: Assign clusters to technicians
    assignments = assign_clusters_to_technicians(clusters, available_techs)
    
    # Step 7: Optimize routes within each cluster
    for tech, requests in assignments.items():
        optimized_route = solve_tsp(tech.base_location, requests)
        calculate_times(optimized_route, tech)
        assignments[tech] = optimized_route
    
    # Step 8: Validate constraints
    validated_assignments = validate_working_hours(assignments)
    
    # Step 9: Calculate optimization score
    score = calculate_optimization_score(validated_assignments)
    
    return validated_assignments, score
```

### Appendix D: Database Migration Strategy

**Phase 1: Schema Creation**
- Create all tables with proper constraints
- Set up foreign keys
- Create indexes
- Set up partitioning for time-series data

**Phase 2: Historical Data Migration**
- Export existing container data
- Transform to new schema
- Import with validation
- Verify data integrity

**Phase 3: Parallel Run**
- Run old and new systems in parallel for 2 weeks
- Compare outputs
- Fix discrepancies

**Phase 4: Cutover**
- Final data sync
- Switch to new system
- Keep old system as read-only backup for 3 months

---

## Document Approval

**Prepared by:** Product Management Team  
**Reviewed by:** Engineering, Operations, Business Teams  
**Approved by:** CEO / CTO  
**Next Review Date:** 3 months post-launch

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Sept 30, 2025 | Product Team | Initial PRD |

---

**END OF DOCUMENT**