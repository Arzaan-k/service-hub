# QUICK COLUMN REFERENCE - Serivce Master.xlsx

## ALL 158 COLUMNS WITH DATA STATUS

### SECTION 1: Initial Complaint (Columns 1-16)
| Col | Column Name | Status | Notes |
|-----|-------------|--------|-------|
| 1 | Job Order No. | **DATA** | PRIMARY KEY |
| 2 | Timestamp | **DATA** | Form submission time |
| 3 | Email Address | **DATA** | Submitter |
| 4 | Client Name | **DATA** | Customer |
| 5 | Contact Person Name | **DATA** | Contact |
| 6 | Contact Person Number | **DATA** | Phone |
| 7 | Contact Person Designation | **DATA** | Job title |
| 8 | Container Number | **DATA** | CONTAINER ID #1 |
| 9 | What's the complaint? | **DATA** | Initial complaint |
| 10 | Remarks | **DATA** | Internal notes |
| 11 | Client Email ID | EMPTY | - |
| 12 | Client Location | EMPTY | - |
| 13 | Machine Status | **DATA** | Current state |
| 14 | Description of complaint | EMPTY | - |
| 15 | Contacted method | EMPTY | - |
| 16 | Call Attended By | EMPTY | - |

### SECTION 2: Job Assignment (Columns 17-41)
| Col | Column Name | Status | Notes |
|-----|-------------|--------|-------|
| 17 | Timestamp | **DATA** | Assignment time |
| 18 | Email Address | **DATA** | Assignee |
| 19 | Client Name | **DATA** | Duplicate |
| 20 | Container No | **DATA** | CONTAINER ID #2 |
| 21 | Container Size | **DATA** | 40FT, 20FT |
| 22 | Machine Make | **DATA** | DAIKIN, CARRIER |
| 23 | Work Type | **DATA** | Service type |
| 24 | Client Type | **DATA** | LEASE/SALE |
| 25 | Job Type | **DATA** | FOC/PAID |
| 26 | Issue(s) found | **DATA** | Diagnosis |
| 27 | Remedial Action | **DATA** | Solution |
| 28 | List of Spares Required | **DATA** | Parts list |
| 29 | Spares Required | EMPTY | - |
| 30 | Reason / Cause | EMPTY | - |
| 31 | Form Link | **DATA** | Google Form URL |
| 32 | Reefer Unit | **DATA** | Brand |
| 33 | Reefer Unit Model Name (Thinline / MP) | **DATA** | Model |
| 34 | Reefer Unit Serial No | **DATA** | Serial |
| 35 | Controller Configuration Number | **DATA** | Config ID |
| 36 | Controller Version | **DATA** | Software |
| 37 | Brand new / Used | **DATA** | Condition |
| 38 | Crystal Smart Sr No. | **DATA** | Smart device |
| 39 | Technician Name | **DATA** | TECHNICIAN |
| 40 | Technician Required at Client Site | EMPTY | - |
| 41 | What's the complaint? | **DATA** | Duplicate |

### SECTION 3: Indent (Columns 42-53)
| Col | Column Name | Status | Notes |
|-----|-------------|--------|-------|
| 42 | Timestamp | **DATA** | Indent time |
| 43 | Email Address | **DATA** | Requester |
| 44 | Indent Required ? | **DATA** | YES/NO |
| 45 | Indent No | **DATA** | Indent ID |
| 46 | Indent Date | **DATA** | Request date |
| 47 | Indent Type | EMPTY | - |
| 48 | Client Name | **DATA** | Duplicate |
| 49 | Client Location | **DATA** | Site location |
| 50 | Container No | **DATA** | CONTAINER ID #3 |
| 51 | Where to Use | **DATA** | SITE |
| 52 | Billing Type | **DATA** | FOC/PAID |
| 53 | Container Make & Model | EMPTY | - |

### SECTION 4: Material Arrangement (Columns 54-60)
| Col | Column Name | Status | Notes |
|-----|-------------|--------|-------|
| 54 | Timestamp | **DATA** | Arrangement time |
| 55 | Email Address | **DATA** | Arranger |
| 56 | Spares Required ? | **DATA** | YES/NO |
| 57 | Indent No | **DATA** | Reference |
| 58 | Required Material Arranged ? | **DATA** | YES/NO |
| 59 | PO | EMPTY | - |
| 60 | Material arranged from | EMPTY | - |

### SECTION 5: Material Dispatch (Columns 61-70)
| Col | Column Name | Status | Notes |
|-----|-------------|--------|-------|
| 61 | Timestamp | **DATA** | Dispatch time |
| 62 | Email Address | **DATA** | Dispatcher |
| 63 | Spares Required ? | **DATA** | YES/NO |
| 64 | Indent No | **DATA** | Reference |
| 65 | Required Material Sent Through | **DATA** | COURIER/TECH |
| 66 | Courier Docket Number | EMPTY | - |
| 67 | Courier Name | EMPTY | - |
| 68 | Technician Name | EMPTY | - |
| 69 | Courier Receipt Note (Upload Courier Tracking number) | EMPTY | - |
| 70 | Courier Contact Number | EMPTY | - |

### SECTION 6: Service Execution (Columns 71-119)
| Col | Column Name | Status | Notes |
|-----|-------------|--------|-------|
| 71 | Timestamp | **DATA** | Completion time |
| 72 | Complaint Attended Date | **DATA** | SERVICE DATE |
| 73 | Service Type | **DATA** | Lease/Paid/FOC |
| 74 | Complaint Received By | **DATA** | Source |
| 75 | Client Name | **DATA** | Duplicate |
| 76 | Client Location | **DATA** | Location |
| 77 | Container Number | **DATA** | CONTAINER ID #4 |
| 78 | Contanier size | **DATA** | 40FT/20FT |
| 79 | Call Attended Type | **DATA** | Service mode |
| 80 | Issue/Complaint Logged | **DATA** | Problem |
| 81 | Reefer Make & Model | **DATA** | Equipment |
| 82 | Set / Operating Temperature | **DATA** | Temperature |
| 83 | Contanier Condition | **DATA** | Clean/Dirty |
| 84 | Condenser Coil | **DATA** | Condition |
| 85 | Condenser Coil Image | EMPTY | - |
| 86 | CondenserMotor | **DATA** | Condition |
| 87 | Evaporator Coil | **DATA** | Condition |
| 88 | Evaporator Motor | **DATA** | Condition |
| 89 | Compressor Oil | **DATA** | Oil level |
| 90 | Compressor Oil2 | EMPTY | - |
| 91 | Refrigerant Gas | **DATA** | Gas level |
| 92 | Refrigerant Gas2 | EMPTY | - |
| 93 | Controller Display | **DATA** | Display status |
| 94 | Controller Display2 | EMPTY | - |
| 95 | Controller keypad | **DATA** | Keypad status |
| 96 | Controller keypad2 | EMPTY | - |
| 97 | Power cable | **DATA** | Cable condition |
| 98 | Power cable2 | EMPTY | - |
| 99 | Machine main braker | **DATA** | Breaker status |
| 100 | Compressor contactor | **DATA** | Contactor |
| 101 | Compressor contactor2 | EMPTY | - |
| 102 | EVP/COND contactor | **DATA** | Contactor |
| 103 | EVP/COND contactor2 | EMPTY | - |
| 104 | Customer main MCB | **DATA** | MCB status |
| 105 | Customer main cable | **DATA** | Cable |
| 106 | FLP scoket condition | **DATA** | Socket |
| 107 | Alarm lisit clear | **DATA** | Alarm status |
| 108 | Filter drier | **DATA** | Filter |
| 109 | Filter drier2 | EMPTY | - |
| 110 | Pressure | **DATA** | Readings |
| 111 | Comp current | **DATA** | Current |
| 112 | Main Voltage | **DATA** | Voltage |
| 113 | PTI | **DATA** | PTI status |
| 114 | Observations | **DATA** | Tech notes |
| 115 | Work Description/Technician Comments | **DATA** | WORK DONE |
| 116 | Required spare part(s)/Consumable(s) | **DATA** | PARTS USED |
| 117 | Sign JOB ORDER (front) | EMPTY | - |
| 118 | Sign JOB ORDER (back) | EMPTY | - |
| 119 | Sign JOB ORDER | **DATA** | Signature URL |

### SECTION 7: Follow-up (Columns 120-128)
| Col | Column Name | Status | Notes |
|-----|-------------|--------|-------|
| 120 | Column_120 | EMPTY | - |
| 121 | Trip No | **DATA** | Trip ID |
| 122 | Any Pending Job? | **DATA** | Yes/No |
| 123 | Next Service Call Required | **DATA** | Yes/No |
| 124 | Next Service - Urgency | **DATA** | Priority |
| 125 | List down the pending job | **DATA** | Details |
| 126 | List of Spares | EMPTY | - |
| 127 | Email Address | EMPTY | - |
| 128 | Type of Container | EMPTY | - |

### SECTION 8: Unused Columns (129-158)
**ALL EMPTY** - 30 unused columns

---

## SUMMARY BY STATUS

### Columns with DATA: 87 columns (55%)
### EMPTY Columns: 71 columns (45%)
  - Duplicate "2" fields: 11 columns
  - Unused form fields: 30 columns
  - Other empty fields: 30 columns

---

## CRITICAL COLUMNS FOR DATABASE

### Core Fields (Must Have)
- Column 1: Job Order No. (PRIMARY KEY)
- Column 8: Container Number (ASSET ID)
- Column 4: Client Name
- Column 39: Technician Name
- Column 72: Complaint Attended Date (SERVICE DATE)

### Service Details
- Column 23: Work Type
- Column 26: Issue(s) found
- Column 27: Remedial Action
- Column 115: Work Description
- Column 116: Spare parts used

### Equipment Info
- Column 21: Container Size
- Column 22: Machine Make
- Column 32: Reefer Unit
- Column 37: Brand new / Used

### Inspection Data (28 fields)
- Columns 83-113: All inspection fields have valuable data

### Parts Management
- Column 44: Indent Required ?
- Column 45: Indent No
- Column 52: Billing Type
- Column 56: Spares Required ?
- Column 65: Material Sent Through

---

## CONTAINER NUMBER LOCATIONS

The container number appears in 4 columns:
1. **Column 8** - Initial complaint
2. **Column 20** - Job assignment
3. **Column 50** - Indent stage
4. **Column 77** - Service execution

**Use Column 8 as primary**, cross-validate with others.

---

## TIMESTAMP COLUMNS

| Column | Stage | Purpose |
|--------|-------|---------|
| 2 | Initial | Complaint submitted |
| 17 | Assignment | Job assigned |
| 42 | Indent | Parts requested |
| 54 | Procurement | Parts arranged |
| 61 | Logistics | Parts dispatched |
| 71 | Completion | Form submitted |
| 72 | **Service** | **Actual service date** |

**Column 72 is the most important date** - when service was actually performed.

---

## QUICK LOOKUP - KEY FIELDS BY PURPOSE

### For Service Tracking:
- 1, 8, 39, 72 (Job#, Container#, Technician, Date)

### For Client Management:
- 4, 5, 6, 7, 49, 76 (Name, Contact, Location)

### For Technical Issues:
- 9, 26, 80, 114, 115 (Complaints, Issues, Observations)

### For Parts Management:
- 28, 44, 45, 56, 116 (Spares required, Indent, Parts used)

### For Billing:
- 25, 52, 73 (Job Type, Billing Type, Service Type)

### For Equipment Details:
- 21, 22, 32, 33, 34, 35, 36, 37, 38 (All equipment specs)

### For Inspection Results:
- 83-113 (All 28 inspection fields)

---

This reference can be used alongside the detailed reports for quick column lookups during database design.
