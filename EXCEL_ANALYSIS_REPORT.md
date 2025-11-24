# COMPREHENSIVE ANALYSIS REPORT: Serivce Master.xlsx

## EXECUTIVE SUMMARY

**File:** Serivce Master.xlsx
**Total Records:** 1,645 service records
**Total Columns:** 158 columns
**Primary Key:** Job Order No. (Column 1)
**Container Identifier:** Container Number (appears in 4 different columns)

---

## DATA STRUCTURE OVERVIEW

The Excel file contains a SINGLE sheet named "Sheet1" with **1,645 rows** of service data and **158 columns**. The data appears to be from multiple Google Forms merged together, creating duplicate column headers and fields.

### Key Findings:
- **Job Order Numbers** follow a pattern: JUL001, JUL002, etc. (Month + Sequential Number)
- **Container Numbers** follow international container numbering: CXRU1043337, TITU9231009, etc.
- Multiple sections represent different stages of the service workflow
- Many duplicate columns (e.g., "Timestamp" appears 6 times, "Email Address" appears 5 times)
- Columns 129-158 (30 columns) are completely empty

---

## COMPLETE COLUMN LISTING

### SECTION 1: INITIAL COMPLAINT REGISTRATION (Columns 1-16)

| Col | Column Name | Data Type | Purpose | Sample Values |
|-----|-------------|-----------|---------|---------------|
| 1 | Job Order No. | String | **UNIQUE IDENTIFIER** | JUL001, JUL002, JUL010 |
| 2 | Timestamp | DateTime | Form submission time | 2024-07-11 22:22:11 |
| 3 | Email Address | String | Submitter email | pravin.shinde@crystalgroup.in |
| 4 | Client Name | String | Customer name | BPCL, Cipla, Quick supply chain PVT LTD |
| 5 | Contact Person Name | String | Client contact | Mohsin, Kiran, Pramod rane |
| 6 | Contact Person Number | String/Int | Phone number | 9995814821, 9146012098 |
| 7 | Contact Person Designation | String | Job title | Supervisor, Manager |
| 8 | Container Number | String | **CONTAINER ID** | CXRU1043337, TITU9231009 |
| 9 | What's the complaint? | String | Initial complaint | Installation request, Not maintaining temperature |
| 10 | Remarks | String | Internal notes | Visit, Pravin, Vinit |
| 11 | Client Email ID | Empty | Not used | - |
| 12 | Client Location | Empty | Not used | - |
| 13 | Machine Status | String | Current state | Installation, Running with issues |
| 14 | Description of complaint | Empty | Not used | - |
| 15 | Contacted method | Empty | Not used | - |
| 16 | Call Attended By | Empty | Not used | - |

### SECTION 2: JOB ASSIGNMENT & DETAILS (Columns 17-41)

| Col | Column Name | Data Type | Purpose | Sample Values |
|-----|-------------|-----------|---------|---------------|
| 17 | Timestamp | DateTime | Assignment time | 2024-07-11 11:13:32 |
| 18 | Email Address | String | Assignee email | pravin.shinde@crystalgroup.in |
| 19 | Client Name | String | Client (duplicate) | Bharat Petroleum, Cipla Unit 1 |
| 20 | Container No | String | Container (duplicate) | CXRU1043337, TITU9231009 |
| 21 | Container Size | String | Size category | 40-REEFER, 20-REEFER, 40-SUPERSTORE |
| 22 | Machine Make | String | Manufacturer | DAIKIN, CARRIER-THINLINE |
| 23 | Work Type | String | Service type | INSTALLATION, SERVICE-ON CALL, SERVICE-AT SITE |
| 24 | Client Type | String | Customer category | LEASE, SALE |
| 25 | Job Type | String | Billing category | FOC (Free of Cost), PAID |
| 26 | Issue(s) found | String | Diagnosis | Due to power fluctuation, COMPRESSOR NOISY |
| 27 | Remedial Action | String | Action taken | Reset the unit, Need to replace parts |
| 28 | List of Spares Required | String | Parts needed | REFRIGERANT GAS 2 KGS, COMPRESSOR OIL 1 LTR |
| 29 | Spares Required | Empty | Not used | - |
| 30 | Reason / Cause | Empty | Not used | - |
| 31 | Form Link | String | Google Form URL | https://docs.google.com/forms/d/e/... |
| 32 | Reefer Unit | String | Equipment brand | DAikin, Carrier - Thinline |
| 33 | Reefer Unit Model Name | String | Model | LXE10E147F2, Thinline |
| 34 | Reefer Unit Serial No | String | Serial number | M002030, NA |
| 35 | Controller Configuration Number | String | Config ID | K31405126348, LXE10E136F2R |
| 36 | Controller Version | String | Software version | DECOS 3F 2353 / 1 |
| 37 | Brand new / Used | String | Equipment condition | used, Brand new |
| 38 | Crystal Smart Sr No. | String | Smart device serial | JSGA622170399, JSGA622180055 |
| 39 | Technician Name | String | **ASSIGNED TECH** | SHAHBUDDIN, RAMIZ, UMESH |
| 40 | Technician Required at Client Site | Empty | Not used | - |
| 41 | What's the complaint? | String | Complaint (duplicate) | Installation request, Not working |

### SECTION 3: INDENT/PARTS REQUEST (Columns 42-53)

| Col | Column Name | Data Type | Purpose | Sample Values |
|-----|-------------|-----------|---------|---------------|
| 42 | Timestamp | DateTime | Indent request time | 2024-07-11 11:38:52 |
| 43 | Email Address | String | Requester email | pravin.shinde@crystalgroup.in |
| 44 | Indent Required ? | String | Parts needed? | YES, NO |
| 45 | Indent No | String | Indent ID | JUL064, JUL063, JUL065 |
| 46 | Indent Date | String | Request date | 7.7.24 |
| 47 | Indent Type | Empty | Not used | - |
| 48 | Client Name | String | Client (duplicate) | QWICK SUPPLY, SYMBIOTECH |
| 49 | Client Location | String | Site location | HAPUR, PUNJAB, TALOJA, Kerala |
| 50 | Container No | String | Container (duplicate) | TITU7263521, TCLU1904607 |
| 51 | Where to Use | String | Usage location | SITE |
| 52 | Billing Type | String | Payment type | FOC, PAID |
| 53 | Container Make & Model | Empty | Not used | - |

### SECTION 4: MATERIAL ARRANGEMENT (Columns 54-60)

| Col | Column Name | Data Type | Purpose | Sample Values |
|-----|-------------|-----------|---------|---------------|
| 54 | Timestamp | DateTime | Arrangement time | 2024-07-11 11:49:57 |
| 55 | Email Address | String | Arranger email | pravin.shinde@crystalgroup.in |
| 56 | Spares Required ? | String | Parts status | YES, NO |
| 57 | Indent No | String | Reference indent | JUL064, JUL059 |
| 58 | Required Material Arranged ? | String | Procurement status | YES |
| 59 | PO | Empty | Purchase order | - |
| 60 | Material arranged from | Empty | Supplier | - |

### SECTION 5: MATERIAL DISPATCH (Columns 61-70)

| Col | Column Name | Data Type | Purpose | Sample Values |
|-----|-------------|-----------|---------|---------------|
| 61 | Timestamp | DateTime | Dispatch time | 2024-07-11 11:51:30 |
| 62 | Email Address | String | Dispatcher email | pravin.shinde@crystalgroup.in |
| 63 | Spares Required ? | String | Parts needed | YES, NO |
| 64 | Indent No | String | Reference indent | JUL075, JUL059 |
| 65 | Required Material Sent Through | String | Delivery method | COURIER, TECHNICIAN |
| 66 | Courier Docket Number | Empty | Tracking number | - |
| 67 | Courier Name | Empty | Courier company | - |
| 68 | Technician Name | Empty | Hand carrier | - |
| 69 | Courier Receipt Note | Empty | Upload field | - |
| 70 | Courier Contact Number | Empty | Phone | - |

### SECTION 6: SERVICE EXECUTION & INSPECTION (Columns 71-119)

This is the MOST DETAILED section containing actual service work performed.

| Col | Column Name | Data Type | Purpose | Sample Values |
|-----|-------------|-----------|---------|---------------|
| 71 | Timestamp | DateTime | Service completion | 2024-08-07 04:35:24 |
| 72 | Complaint Attended Date | DateTime | **SERVICE DATE** | 2024-07-01, 2024-07-05 |
| 73 | Service Type | String | Service category | Lease, Paid, Free of Cost |
| 74 | Complaint Received By | String | Source | Regular Visit, EMAIL, Phone |
| 75 | Client Name | String | Client (duplicate) | BPCL, Cipla, Quick supply |
| 76 | Client Location | String | Location (duplicate) | Kerala, Goa, Hapur |
| 77 | Container Number | String | Container (duplicate) | CXRU1043337, TITU9231009 |
| 78 | Contanier size | String | Size | 40FT, 20FT |
| 79 | Call Attended Type | String | Service mode | SERVICE-AT SITE, SITE INSPECTION |
| 80 | Issue/Complaint Logged | String | Problem description | Display not working, Breakdown |
| 81 | Reefer Make & Model | String | Equipment | Daikin, Carrier, Thermo king |
| 82 | Set / Operating Temperature | String/Int | Temp setting | +15 C to +20 C, 4, -30 C, -25* / -18* |

#### EQUIPMENT INSPECTION FIELDS (Columns 83-113)

| Col | Column Name | Data Type | Inspection Point | Possible Values |
|-----|-------------|-----------|------------------|-----------------|
| 83 | Contanier Condition | String | Overall condition | Clean, Dirty |
| 84 | Condenser Coil | String | Coil status | Clean, Rusty |
| 85 | Condenser Coil Image | Empty | Photo upload | - |
| 86 | CondenserMotor | String | Motor status | Okay, Need to replace |
| 87 | Evaporator Coil | String | Coil status | Clean, Rusty |
| 88 | Evaporator Motor | String | Motor status | Okay, Need to replace |
| 89 | Compressor Oil | String | Oil level | Okay, Need to top up |
| 90 | Compressor Oil2 | Empty | Duplicate field | - |
| 91 | Refrigerant Gas | String | Gas level | Okay, Need to top up |
| 92 | Refrigerant Gas2 | Empty | Duplicate field | - |
| 93 | Controller Display | String | Display status | Okay, Need to replace |
| 94 | Controller Display2 | Empty | Duplicate field | - |
| 95 | Controller keypad | String | Keypad status | Okay, Need to replace |
| 96 | Controller keypad2 | Empty | Duplicate field | - |
| 97 | Power cable | String | Cable condition | Okay |
| 98 | Power cable2 | Empty | Duplicate field | - |
| 99 | Machine main braker | String | Breaker status | Okay |
| 100 | Compressor contactor | String | Contactor status | Okay, Need to replace |
| 101 | Compressor contactor2 | Empty | Duplicate field | - |
| 102 | EVP/COND contactor | String | Contactor status | Okay, Need to replace |
| 103 | EVP/COND contactor2 | Empty | Duplicate field | - |
| 104 | Customer main MCB | String | MCB status | Okay |
| 105 | Customer main cable | String | Cable condition | Okay |
| 106 | FLP scoket condition | String | Socket status | Okay |
| 107 | Alarm lisit clear | String | Alarm cleared | Done |
| 108 | Filter drier | String | Filter status | Clean |
| 109 | Filter drier2 | Empty | Duplicate field | - |
| 110 | Pressure | String | Pressure readings | 0.6 and 140, 0.8/190, 180/1690 |
| 111 | Comp current | String/DateTime | Current readings | R- 9.6\nY- 9.5\nB- 9.6 |
| 112 | Main Voltage | String | Voltage readings | L1- 440\nL2- 440\nL3- 440 |
| 113 | PTI | String | PTI status | Not done, Short, Full |

#### SERVICE DOCUMENTATION (Columns 114-119)

| Col | Column Name | Data Type | Purpose | Sample Values |
|-----|-------------|-----------|---------|---------------|
| 114 | Observations | String | Tech observations | Installation unit, Traning for technical staff |
| 115 | Work Description/Technician Comments | String | **WORK DONE** | Installation point checked and satisfied |
| 116 | Required spare part(s)/Consumable(s) | String | **PARTS USED** | Display-1, sheetkey-1, Compessor oil 3L |
| 117 | Sign JOB ORDER (front) | Empty | Signature upload | - |
| 118 | Sign JOB ORDER (back) | Empty | Signature upload | - |
| 119 | Sign JOB ORDER | String | Signature URL | https://drive.google.com/open?id=1prk4-ZJ... |

### SECTION 7: FOLLOW-UP & CLOSURE (Columns 120-128)

| Col | Column Name | Data Type | Purpose | Sample Values |
|-----|-------------|-----------|---------|---------------|
| 120 | Column_120 | Empty | Unused | - |
| 121 | Trip No | String | Trip identifier | NA |
| 122 | Any Pending Job? | String | Completion status | No, Yes |
| 123 | Next Service Call Required | String | Follow-up needed | No, Yes |
| 124 | Next Service - Urgency | String | Priority | Can be done on next PM |
| 125 | List down the pending job | String | Pending work | NA |
| 126 | List of Spares | Empty | Not used | - |
| 127 | Email Address | Empty | Not used | - |
| 128 | Type of Container | Empty | Not used | - |

### SECTION 8: EMPTY COLUMNS (Columns 129-158)

**30 completely empty columns** - likely placeholders for future fields or form expansion.

---

## KEY FIELD MAPPINGS

### PRIMARY IDENTIFIER
- **Job Order No.** (Column 1) - Unique service request identifier
  - Format: [MONTH][NUMBER] (e.g., JUL001, JUL002)
  - Acts as the primary key for each service record

### CONTAINER IDENTIFICATION
The container number appears in **4 different columns** due to form merging:
- **Column 8:** Container Number (Initial registration)
- **Column 20:** Container No (Job assignment)
- **Column 50:** Container No (Indent request)
- **Column 77:** Container Number (Service execution)

**Container Number Format:**
- Standard ISO container format: 4 letters + 7 digits
- Examples: CXRU1043337, TITU9231009, TRIU6681440, TCLU1904607

### DATE/TIME TRACKING

| Column | Field Name | Purpose | Stage |
|--------|------------|---------|-------|
| 2 | Timestamp | Complaint registration | Initial |
| 17 | Timestamp | Job assignment | Assignment |
| 42 | Timestamp | Indent request | Parts |
| 54 | Timestamp | Material arrangement | Procurement |
| 61 | Timestamp | Material dispatch | Logistics |
| 71 | Timestamp | Service form submission | Completion |
| 72 | Complaint Attended Date | **Actual service date** | Execution |
| 46 | Indent Date | Parts request date | Procurement |

### CLIENT INFORMATION

Client details appear in multiple sections:
- **Column 4, 19, 48, 75:** Client Name (4 occurrences)
- **Column 12, 49, 76:** Client Location (3 occurrences)
- **Column 5:** Contact Person Name
- **Column 6:** Contact Person Number
- **Column 7:** Contact Person Designation
- **Column 11:** Client Email ID (empty)
- **Column 24:** Client Type (LEASE/SALE)

### TECHNICIAN INFORMATION

- **Column 39:** Technician Name (Assignment stage)
  - Values: SHAHBUDDIN, RAMIZ, UMESH, etc.
- **Column 68:** Technician Name (Dispatch stage - empty)
- **Column 115:** Work Description/Technician Comments (Detailed work notes)

### SERVICE CATEGORIZATION

| Column | Field | Values |
|--------|-------|--------|
| 23 | Work Type | INSTALLATION, SERVICE-ON CALL, SERVICE-AT SITE |
| 24 | Client Type | LEASE, SALE |
| 25 | Job Type | FOC (Free of Cost), PAID |
| 73 | Service Type | Lease, Paid, Free of Cost |
| 79 | Call Attended Type | SERVICE-AT SITE, SITE INSPECTION, SERVICE-ON CALL |
| 13 | Machine Status | Installation, Running with issues, Preventive Maintenance |

### EQUIPMENT DETAILS

| Column | Field | Description |
|--------|-------|-------------|
| 21 | Container Size | 40-REEFER, 20-REEFER, 40-SUPERSTORE, 40FT, 20FT |
| 22 | Machine Make | DAIKIN, CARRIER-THINLINE |
| 32 | Reefer Unit | DAikin, Carrier - Thinline, Carrier - Transcold |
| 33 | Reefer Unit Model Name | LXE10E147F2, Thinline, MP |
| 34 | Reefer Unit Serial No | M002030, etc. |
| 35 | Controller Configuration Number | K31405126348, etc. |
| 36 | Controller Version | DECOS 3F 2353 / 1, etc. |
| 37 | Brand new / Used | used, Brand new |
| 38 | Crystal Smart Sr No. | JSGA622170399, JSGA622180055 |
| 81 | Reefer Make & Model | Daikin, Carrier, Thermo king |
| 82 | Set / Operating Temperature | Various temp ranges |

### COMPLAINT/ISSUE TRACKING

| Column | Field | Purpose |
|--------|-------|---------|
| 9 | What's the complaint? | Initial complaint description |
| 41 | What's the complaint? | Duplicate |
| 26 | Issue(s) found | Diagnosis after inspection |
| 80 | Issue/Complaint Logged | Final issue description |
| 27 | Remedial Action | Action taken/needed |
| 114 | Observations | Technical observations |
| 115 | Work Description/Technician Comments | Detailed work performed |

### SPARE PARTS MANAGEMENT

**Request Phase:**
- **Column 28:** List of Spares Required (Initial assessment)
- **Column 44:** Indent Required ? (YES/NO)
- **Column 45:** Indent No (Indent reference number)
- **Column 56, 63:** Spares Required ? (Status checks)

**Procurement Phase:**
- **Column 58:** Required Material Arranged ? (YES/NO)
- **Column 65:** Required Material Sent Through (COURIER/TECHNICIAN)

**Usage Phase:**
- **Column 116:** Required spare part(s)/Consumable(s) (Actual parts used)

### BILLING/FINANCIAL

| Column | Field | Purpose |
|--------|-------|---------|
| 44 | Indent Required ? | Parts purchase needed |
| 45 | Indent No | Purchase request ID |
| 52 | Billing Type | FOC/PAID |
| 59 | PO | Purchase order (empty) |

---

## DATA QUALITY ISSUES

### 1. Duplicate Columns
Multiple columns contain the same information:
- **Timestamp:** Appears 6 times (columns 2, 17, 42, 54, 61, 71)
- **Email Address:** Appears 5 times (columns 3, 18, 43, 55, 62)
- **Client Name:** Appears 4 times (columns 4, 19, 48, 75)
- **Container Number:** Appears 4 times (columns 8, 20, 50, 77)
- Many inspection fields have "2" versions that are always empty

### 2. Inconsistent Naming
- "Container No" vs "Container Number"
- "Contanier size" (typo) vs "Container Size"
- "CondenserMotor" (no space) vs "Evaporator Motor" (with space)

### 3. Empty Columns
- **30 columns (129-158)** are completely empty
- **41 columns total** have no data at all
- Many designated fields remain unused (PO, Courier details, etc.)

### 4. Data Type Inconsistencies
- **Column 6 (Contact Person Number):** Mix of string and integer
- **Column 82 (Temperature):** Mix of string and integer formats
- **Column 111 (Comp current):** Some entries incorrectly parsed as datetime

### 5. Format Variations
- **Dates:** Mix of formats (2024-07-01, 7.7.24)
- **Temperature:** Multiple formats (+15 C to +20 C, 4, -30 C, -25* / -18*)
- **Pressure:** Various formats (0.6 and 140, 0.8/190, 180/1690)

### 6. Typos and Spelling Errors
- "Contanier" instead of "Container"
- "Alarm lisit clear" instead of "Alarm list clear"
- "Traning" instead of "Training"

---

## RECOMMENDED DATABASE SCHEMA

Based on the analysis, here's the recommended normalized database structure:

### Table 1: service_requests
```sql
- id (PRIMARY KEY, AUTO_INCREMENT)
- job_order_no (UNIQUE, VARCHAR, indexed) -- JUL001, JUL002
- created_at (TIMESTAMP) -- Column 2
- created_by (VARCHAR) -- Column 3
- complaint_description (TEXT) -- Column 9
- machine_status (ENUM) -- Column 13
- remarks (TEXT) -- Column 10
- status (ENUM: pending, assigned, in_progress, completed)
```

### Table 2: clients
```sql
- id (PRIMARY KEY, AUTO_INCREMENT)
- client_name (VARCHAR, indexed) -- Column 4
- client_type (ENUM: LEASE, SALE) -- Column 24
- contact_person_name (VARCHAR) -- Column 5
- contact_person_number (VARCHAR) -- Column 6
- contact_person_designation (VARCHAR) -- Column 7
- client_email (VARCHAR) -- Column 11
- client_location (VARCHAR) -- Column 76
```

### Table 3: containers
```sql
- id (PRIMARY KEY, AUTO_INCREMENT)
- container_number (VARCHAR, UNIQUE, indexed) -- Column 8, 20, 50, 77
- container_size (VARCHAR) -- Column 21, 78
- machine_make (VARCHAR) -- Column 22
- reefer_unit_brand (VARCHAR) -- Column 32
- reefer_model_name (VARCHAR) -- Column 33
- reefer_serial_no (VARCHAR) -- Column 34
- controller_config_number (VARCHAR) -- Column 35
- controller_version (VARCHAR) -- Column 36
- condition_new_used (ENUM: new, used) -- Column 37
- crystal_smart_serial (VARCHAR) -- Column 38
```

### Table 4: technicians
```sql
- id (PRIMARY KEY, AUTO_INCREMENT)
- technician_name (VARCHAR, indexed) -- Column 39
- email (VARCHAR)
- phone (VARCHAR)
- active (BOOLEAN)
```

### Table 5: service_assignments
```sql
- id (PRIMARY KEY, AUTO_INCREMENT)
- service_request_id (FOREIGN KEY -> service_requests)
- container_id (FOREIGN KEY -> containers)
- client_id (FOREIGN KEY -> clients)
- technician_id (FOREIGN KEY -> technicians)
- assigned_at (TIMESTAMP) -- Column 17
- assigned_by (VARCHAR) -- Column 18
- work_type (ENUM) -- Column 23
- job_type (ENUM) -- Column 25
- issue_found (TEXT) -- Column 26
- remedial_action (TEXT) -- Column 27
- form_link (VARCHAR) -- Column 31
```

### Table 6: indents (Parts Requests)
```sql
- id (PRIMARY KEY, AUTO_INCREMENT)
- indent_no (VARCHAR, UNIQUE) -- Column 45, 57, 64
- service_request_id (FOREIGN KEY -> service_requests)
- created_at (TIMESTAMP) -- Column 42
- created_by (VARCHAR) -- Column 43
- indent_required (BOOLEAN) -- Column 44
- indent_date (DATE) -- Column 46
- spares_required (TEXT) -- Column 28
- billing_type (ENUM: FOC, PAID) -- Column 52
- material_arranged (BOOLEAN) -- Column 58
- po_number (VARCHAR) -- Column 59
- arranged_from (VARCHAR) -- Column 60
```

### Table 7: material_dispatch
```sql
- id (PRIMARY KEY, AUTO_INCREMENT)
- indent_id (FOREIGN KEY -> indents)
- dispatched_at (TIMESTAMP) -- Column 61
- dispatched_by (VARCHAR) -- Column 62
- sent_through (ENUM: COURIER, TECHNICIAN) -- Column 65
- courier_docket_no (VARCHAR) -- Column 66
- courier_name (VARCHAR) -- Column 67
- courier_contact (VARCHAR) -- Column 70
- courier_receipt_url (VARCHAR) -- Column 69
```

### Table 8: service_executions
```sql
- id (PRIMARY KEY, AUTO_INCREMENT)
- service_request_id (FOREIGN KEY -> service_requests)
- completed_at (TIMESTAMP) -- Column 71
- service_date (DATE) -- Column 72
- service_type (ENUM) -- Column 73
- complaint_received_by (VARCHAR) -- Column 74
- call_attended_type (VARCHAR) -- Column 79
- issue_logged (TEXT) -- Column 80
- operating_temperature (VARCHAR) -- Column 82
- observations (TEXT) -- Column 114
- work_description (TEXT) -- Column 115
- spare_parts_used (TEXT) -- Column 116
- signature_url (VARCHAR) -- Column 119
- trip_no (VARCHAR) -- Column 121
- pending_job (BOOLEAN) -- Column 122
- next_service_required (BOOLEAN) -- Column 123
- next_service_urgency (VARCHAR) -- Column 124
- pending_job_details (TEXT) -- Column 125
```

### Table 9: equipment_inspections
```sql
- id (PRIMARY KEY, AUTO_INCREMENT)
- service_execution_id (FOREIGN KEY -> service_executions)
- container_condition (ENUM: Clean, Dirty) -- Column 83
- condenser_coil (VARCHAR) -- Column 84
- condenser_coil_image (VARCHAR) -- Column 85
- condenser_motor (VARCHAR) -- Column 86
- evaporator_coil (VARCHAR) -- Column 87
- evaporator_motor (VARCHAR) -- Column 88
- compressor_oil (VARCHAR) -- Column 89
- refrigerant_gas (VARCHAR) -- Column 91
- controller_display (VARCHAR) -- Column 93
- controller_keypad (VARCHAR) -- Column 95
- power_cable (VARCHAR) -- Column 97
- machine_main_breaker (VARCHAR) -- Column 99
- compressor_contactor (VARCHAR) -- Column 100
- evp_cond_contactor (VARCHAR) -- Column 102
- customer_main_mcb (VARCHAR) -- Column 104
- customer_main_cable (VARCHAR) -- Column 105
- flp_socket_condition (VARCHAR) -- Column 106
- alarm_list_clear (VARCHAR) -- Column 107
- filter_drier (VARCHAR) -- Column 108
- pressure_reading (VARCHAR) -- Column 110
- compressor_current (VARCHAR) -- Column 111
- main_voltage (VARCHAR) -- Column 112
- pti_status (VARCHAR) -- Column 113
```

---

## WORKFLOW STAGES IDENTIFIED

Based on the column groupings and timestamps, the service workflow follows these stages:

### Stage 1: Complaint Registration (Columns 1-16)
- Client submits complaint
- Job Order Number generated
- Initial triage and status assignment

### Stage 2: Job Assignment (Columns 17-41)
- Detailed information collection
- Equipment identification
- Technician assignment
- Initial diagnosis

### Stage 3: Parts Requisition (Columns 42-53)
- Indent creation if parts needed
- Location and billing details

### Stage 4: Material Procurement (Columns 54-60)
- Parts arrangement confirmation
- Purchase order generation

### Stage 5: Material Logistics (Columns 61-70)
- Parts dispatch via courier or technician
- Tracking information

### Stage 6: Service Execution (Columns 71-119)
- On-site service performance
- Detailed equipment inspection (28 inspection points)
- Work documentation
- Parts usage recording
- Customer signature collection

### Stage 7: Closure & Follow-up (Columns 120-128)
- Pending job identification
- Next service scheduling
- Final documentation

---

## CONTAINER NUMBER ANALYSIS

### Format Pattern:
- 4 alphabetic characters (owner/operator code)
- 7 numeric digits (serial number + check digit)
- Examples: CXRU1043337, TITU9231009, TRIU6681440

### Common Prefixes Found:
- **CXRU** - CGM (CMA CGM Group)
- **TITU** - Tiphook
- **TRIU** - Triton
- **TCLU** - Textainer
- **APRU** - APL
- **GRMU** - Unknown

---

## JOB ORDER NUMBER PATTERN

### Format:
- **3 letter month code** (JUL, AUG, SEP, etc.)
- **3 digit sequential number** (001, 002, 003, etc.)

### Examples:
- JUL001, JUL002, JUL003, ... JUL010, ...
- Suggests monthly numbering reset

---

## TEMPERATURE DATA PATTERNS

Container operating temperatures vary widely:
- **Frozen:** -30°C, -25°C to -18°C
- **Chilled:** +4°C, +15°C to +20°C
- **Format variations:** Multiple notation styles need standardization

---

## CRITICAL FIELDS FOR REPORTING

### Service Performance Metrics:
1. **Job Order No.** (Column 1) - Unique identifier
2. **Complaint Attended Date** (Column 72) - Actual service date
3. **Technician Name** (Column 39) - Resource allocation
4. **Client Name** (Column 4/19/48/75) - Customer tracking
5. **Container Number** (Column 8/20/50/77) - Asset tracking
6. **Work Type** (Column 23) - Service categorization
7. **Service Type** (Column 73) - Billing category

### Technical Performance:
1. **Issue(s) found** (Column 26) - Problem diagnosis
2. **Remedial Action** (Column 27) - Solution applied
3. **Equipment Inspection Fields** (Columns 83-113) - Asset condition
4. **Spare parts used** (Column 116) - Inventory consumption

### Financial Tracking:
1. **Job Type** (Column 25) - FOC vs PAID
2. **Billing Type** (Column 52) - Payment terms
3. **Indent No** (Column 45/57/64) - Parts procurement

---

## DATA RELATIONSHIPS

### Primary Relationships:
```
service_request (Job Order No.)
    ├─ 1:1 → container (Container Number)
    ├─ 1:1 → client (Client Name)
    ├─ 1:1 → technician (Technician Name)
    ├─ 1:many → indents (Indent No)
    ├─ 1:1 → service_execution (Service Date)
    └─ 1:1 → equipment_inspection (Inspection Data)

indent
    └─ 1:1 → material_dispatch (Dispatch Info)
```

---

## RECOMMENDATIONS

### 1. Database Normalization
- Create separate tables for clients, containers, technicians, and services
- Eliminate duplicate columns
- Standardize data formats

### 2. Data Cleanup
- Fix typos in column names ("Contanier", "lisit")
- Standardize date formats
- Standardize temperature notation
- Standardize pressure/voltage/current formats

### 3. Form Redesign
- Consolidate duplicate Google Forms into single workflow
- Remove empty columns (129-158)
- Remove unused duplicate fields (all "2" columns)
- Implement dropdown validations for standardization

### 4. Key Fields to Preserve
- Job Order No. (unique identifier)
- Container Number (asset tracking)
- Complaint Attended Date (actual service date)
- All equipment inspection fields (valuable condition data)
- Work Description/Technician Comments (detailed notes)
- Spare parts used (inventory tracking)

### 5. Field Enhancements Needed
- Add service duration (start time, end time)
- Add GPS coordinates for service location
- Add actual cost fields (labor, parts, total)
- Add customer satisfaction rating
- Add photos of completed work
- Add warranty period for repairs

---

## CONCLUSION

The "Serivce Master.xlsx" file contains comprehensive service tracking data with **1,645 records** across **158 columns**. While functionally rich, the structure shows clear signs of being assembled from multiple Google Forms without proper data architecture planning.

**Strengths:**
- Comprehensive service workflow coverage
- Detailed equipment inspection checklist (28 points)
- Clear job order numbering system
- Multi-stage tracking from complaint to closure

**Weaknesses:**
- Significant data duplication (same field in multiple columns)
- 30 completely empty columns
- Inconsistent data formats
- Spelling errors and naming inconsistencies

**Primary Use Cases:**
1. Service request tracking (Job Order → Container mapping)
2. Technician workload analysis
3. Parts inventory management
4. Equipment condition monitoring
5. Customer service history
6. Billing and financial reporting

This data would significantly benefit from migration to a properly normalized relational database with the schema outlined above.
