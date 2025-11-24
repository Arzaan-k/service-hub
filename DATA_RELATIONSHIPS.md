# DATA RELATIONSHIPS & WORKFLOW DIAGRAM
## Serivce Master.xlsx Structure

---

## WORKFLOW STAGES & COLUMN MAPPING

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     STAGE 1: COMPLAINT REGISTRATION                     │
│                           Columns 1-16                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  Job Order No (1) ──────────► UNIQUE IDENTIFIER                        │
│  Container Number (8) ───────► ASSET IDENTIFIER                        │
│  Client Name (4) ────────────► CUSTOMER                                │
│  Complaint (9) ──────────────► INITIAL ISSUE                           │
│  Timestamp (2) ──────────────► REGISTRATION TIME                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     STAGE 2: JOB ASSIGNMENT                             │
│                           Columns 17-41                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  Technician Name (39) ───────► RESOURCE ASSIGNED                       │
│  Work Type (23) ─────────────► SERVICE CATEGORY                        │
│  Machine Make (22) ───────────► EQUIPMENT TYPE                         │
│  Issue(s) found (26) ─────────► DIAGNOSIS                              │
│  Remedial Action (27) ────────► ACTION PLAN                            │
│  List of Spares Required (28) ► PARTS NEEDED                           │
│  Timestamp (17) ─────────────► ASSIGNMENT TIME                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                      ┌─────────────┴─────────────┐
                      │                           │
                      ▼                           ▼
       ┌────────────────────────┐   ┌────────────────────────┐
       │   PARTS NEEDED?        │   │   DIRECT SERVICE       │
       │   YES → Continue       │   │   NO → Skip to Stage 6 │
       └────────────────────────┘   └────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     STAGE 3: INDENT/PARTS REQUEST                       │
│                           Columns 42-53                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  Indent Required? (44) ───────► YES/NO                                 │
│  Indent No (45) ──────────────► REQUEST ID                             │
│  Client Location (49) ────────► SITE LOCATION                          │
│  Billing Type (52) ───────────► FOC/PAID                               │
│  Timestamp (42) ──────────────► REQUEST TIME                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   STAGE 4: MATERIAL ARRANGEMENT                         │
│                           Columns 54-60                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  Spares Required? (56) ───────► YES/NO                                 │
│  Indent No (57) ──────────────► REFERENCE                              │
│  Material Arranged? (58) ─────► PROCUREMENT STATUS                     │
│  Timestamp (54) ──────────────► ARRANGEMENT TIME                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   STAGE 5: MATERIAL DISPATCH                            │
│                           Columns 61-70                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  Material Sent Through (65) ──► COURIER/TECHNICIAN                     │
│  Indent No (64) ──────────────► REFERENCE                              │
│  Timestamp (61) ──────────────► DISPATCH TIME                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   STAGE 6: SERVICE EXECUTION                            │
│                           Columns 71-119                                │
├─────────────────────────────────────────────────────────────────────────┤
│  Complaint Attended Date (72) ► SERVICE DATE ★                         │
│  Issue/Complaint Logged (80) ─► PROBLEM                                │
│  Operating Temperature (82) ──► TEMP SETTING                           │
│                                                                         │
│  EQUIPMENT INSPECTION (83-113): 28 Inspection Points                   │
│    • Container Condition (83)                                          │
│    • Condenser Coil (84)                                               │
│    • Condenser Motor (86)                                              │
│    • Evaporator Coil (87)                                              │
│    • Evaporator Motor (88)                                             │
│    • Compressor Oil (89)                                               │
│    • Refrigerant Gas (91)                                              │
│    • Controller Display (93)                                           │
│    • Controller Keypad (95)                                            │
│    • Power Cable (97)                                                  │
│    • Machine Breaker (99)                                              │
│    • Compressor Contactor (100)                                        │
│    • EVP/COND Contactor (102)                                          │
│    • Customer MCB (104)                                                │
│    • Filter Drier (108)                                                │
│    • Pressure (110)                                                    │
│    • Compressor Current (111)                                          │
│    • Main Voltage (112)                                                │
│    • PTI (113)                                                         │
│                                                                         │
│  Observations (114) ──────────► TECH NOTES                             │
│  Work Description (115) ──────► WORK PERFORMED                         │
│  Spare parts used (116) ──────► PARTS CONSUMED                         │
│  Sign JOB ORDER (119) ────────► SIGNATURE                              │
│  Timestamp (71) ──────────────► COMPLETION TIME                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   STAGE 7: CLOSURE & FOLLOW-UP                          │
│                           Columns 120-128                               │
├─────────────────────────────────────────────────────────────────────────┤
│  Any Pending Job? (122) ──────► YES/NO                                 │
│  Next Service Required (123) ─► YES/NO                                 │
│  Next Service Urgency (124) ──► PRIORITY                               │
│  List pending job (125) ──────► PENDING WORK                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## ENTITY RELATIONSHIPS

```
┌─────────────────┐
│  JOB ORDER      │ ◄────────────────────────┐
│  (Column 1)     │                          │
│  PRIMARY KEY    │                          │
└────────┬────────┘                          │
         │                                   │
         │ 1:1                               │
         ▼                                   │
┌─────────────────┐                          │
│  CONTAINER      │ ◄────────┐               │
│  (Column 8)     │          │               │
│  Asset ID       │          │ 1:many        │
└────────┬────────┘          │               │
         │                   │               │
         │ many:1       ┌────┴─────┐         │
         ▼              │ SERVICE  │         │
┌─────────────────┐     │ HISTORY  │         │
│  CLIENT         │     │          │         │
│  (Column 4)     │     └──────────┘         │
│  Customer       │                          │
└────────┬────────┘                          │
         │                                   │
         │ 1:many                            │
         └───────────────────────────────────┘


┌─────────────────┐         ┌─────────────────┐
│  TECHNICIAN     │         │  SPARE PARTS    │
│  (Column 39)    │◄────┐   │  (Col 28, 116)  │
│  Resource       │     │   │  Inventory      │
└─────────────────┘     │   └─────────────────┘
                        │            ▲
                        │            │
                   ┌────┴─────┐      │
                   │ SERVICE  │──────┘
                   │ REQUEST  │
                   │ (Job #)  │
                   └──────────┘
```

---

## DATA FLOW DIAGRAM

```
┌───────────┐
│  CLIENT   │
│  CALLS    │
└─────┬─────┘
      │
      ▼
┌───────────────────────┐
│  COMPLAINT            │
│  REGISTRATION         │
│  • Job Order Created  │
│  • Container ID       │
│  • Issue Logged       │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│  JOB ASSIGNMENT       │
│  • Technician         │
│  • Diagnosis          │
│  • Parts Assessment   │
└───────────┬───────────┘
            │
            ├─────────────┐
            │             │
  ┌─────────▼──────┐     │
  │  PARTS NEEDED? │     │
  └────────┬───────┘     │
           │ YES         │ NO
           ▼             │
  ┌────────────────┐     │
  │  INDENT        │     │
  │  CREATED       │     │
  └────────┬───────┘     │
           │             │
           ▼             │
  ┌────────────────┐     │
  │  PARTS         │     │
  │  PROCURED      │     │
  └────────┬───────┘     │
           │             │
           ▼             │
  ┌────────────────┐     │
  │  PARTS         │     │
  │  DISPATCHED    │     │
  └────────┬───────┘     │
           │             │
           └─────────────┤
                         │
                         ▼
            ┌─────────────────────┐
            │  SERVICE            │
            │  EXECUTION          │
            │  • On-site work     │
            │  • Inspection       │
            │  • Parts used       │
            │  • Signature        │
            └─────────┬───────────┘
                      │
                      ▼
            ┌─────────────────────┐
            │  CLOSURE            │
            │  • Job completed    │
            │  • Follow-up check  │
            │  • Next service?    │
            └─────────────────────┘
```

---

## CONTAINER NUMBER CROSS-REFERENCES

```
Container Number appears in 4 locations:

┌────────────────┐
│  Column 8      │ ◄── Initial Complaint Registration
│  PRIMARY       │
└───────┬────────┘
        │
        ├─────────────────────────────────┐
        │                                 │
┌───────▼────────┐                ┌──────▼──────┐
│  Column 20     │                │  Column 50  │
│  Job Assignment│                │  Indent     │
└────────────────┘                └─────────────┘
        │
        │
┌───────▼────────┐
│  Column 77     │
│  Service Exec  │
└────────────────┘

All four should contain the SAME container number.
Use Column 8 as the primary reference.
```

---

## INSPECTION CHECKLIST GROUPING

```
EQUIPMENT INSPECTION (Columns 83-113)
├── Physical Condition
│   ├── Container Condition (83)
│   └── FLP socket condition (106)
│
├── Heat Exchange System
│   ├── Condenser Coil (84)
│   ├── Condenser Motor (86)
│   ├── Evaporator Coil (87)
│   └── Evaporator Motor (88)
│
├── Refrigeration System
│   ├── Compressor Oil (89)
│   ├── Refrigerant Gas (91)
│   ├── Filter drier (108)
│   └── Pressure (110)
│
├── Control System
│   ├── Controller Display (93)
│   ├── Controller keypad (95)
│   └── Alarm list clear (107)
│
├── Electrical System
│   ├── Power cable (97)
│   ├── Machine main breaker (99)
│   ├── Compressor contactor (100)
│   ├── EVP/COND contactor (102)
│   ├── Customer main MCB (104)
│   ├── Customer main cable (105)
│   ├── Comp current (111)
│   └── Main Voltage (112)
│
└── Performance Test
    └── PTI (113)
```

---

## TIMESTAMP SEQUENCE

```
Service Request Timeline:

T0: Complaint Received
    │
    ├─► Column 2: Timestamp (Complaint Registration)
    │
T1: Job Assigned
    │
    ├─► Column 17: Timestamp (Assignment)
    │
T2: Parts Requested (if needed)
    │
    ├─► Column 42: Timestamp (Indent)
    │
T3: Parts Procured
    │
    ├─► Column 54: Timestamp (Material Arranged)
    │
T4: Parts Dispatched
    │
    ├─► Column 61: Timestamp (Dispatch)
    │
T5: Service Performed ★ MOST IMPORTANT
    │
    ├─► Column 72: Complaint Attended Date
    │
T6: Form Completed
    │
    └─► Column 71: Timestamp (Submission)

Average Timeline: 1-14 days from complaint to service
```

---

## BILLING WORKFLOW

```
┌──────────────┐
│  Job Type    │
│  (Column 25) │
└──────┬───────┘
       │
       ├─────────────┬─────────────┐
       │             │             │
       ▼             ▼             ▼
   ┌──────┐     ┌──────┐     ┌──────┐
   │ FOC  │     │ PAID │     │ AMC  │
   │ 64%  │     │ 10%  │     │  3%  │
   └──────┘     └──────┘     └──────┘
       │             │             │
       └─────────────┴─────────────┘
                     │
                     ▼
           ┌──────────────────┐
           │  Billing Type    │
           │  (Column 52)     │
           │  FOC/PAID        │
           └──────────────────┘
                     │
                     ▼
           ┌──────────────────┐
           │  Service Type    │
           │  (Column 73)     │
           │  Lease/Paid/FOC  │
           └──────────────────┘
```

---

## PARTS MANAGEMENT FLOW

```
┌─────────────────────────┐
│  List of Spares         │
│  Required (Column 28)   │
│  Initial Assessment     │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Indent Required?       │
│  (Column 44) YES/NO     │
└───────────┬─────────────┘
            │ YES
            ▼
┌─────────────────────────┐
│  Indent No Created      │
│  (Column 45)            │
│  e.g., JUL064           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Material Arranged?     │
│  (Column 58) YES/NO     │
└───────────┬─────────────┘
            │ YES
            ▼
┌─────────────────────────┐
│  Sent Through           │
│  (Column 65)            │
│  COURIER/TECHNICIAN     │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Parts Used             │
│  (Column 116)           │
│  Actual Consumption     │
└─────────────────────────┘
```

---

## KEY INSIGHTS FROM STRUCTURE

### Data Duplication Pattern
- **Timestamp:** 6 occurrences (tracks each workflow stage)
- **Email:** 5 occurrences (tracks who did what)
- **Container Number:** 4 occurrences (cross-reference validation)
- **Client Name:** 4 occurrences (redundant data entry)

### Empty Column Pattern
- Many fields have a "2" version that's always empty (e.g., Oil2, Gas2)
- Likely placeholder for future use or second measurement
- Can be removed in database design

### Critical Path
```
Job Order → Container → Technician → Service Date → Work Done → Parts Used
   (1)        (8)          (39)         (72)         (115)        (116)
```

These 6 fields form the core service record.

---

## RECOMMENDED NORMALIZED STRUCTURE

```
┌──────────────────┐
│ service_requests │──┐
│ • id (PK)        │  │
│ • job_order_no   │  │
│ • created_at     │  │
└──────────────────┘  │
                      │
     ┌────────────────┴───────────────┬──────────────────┐
     │                                │                  │
     ▼                                ▼                  ▼
┌──────────────┐            ┌──────────────┐    ┌──────────────┐
│ containers   │            │ clients      │    │ technicians  │
│ • id (PK)    │            │ • id (PK)    │    │ • id (PK)    │
│ • number     │            │ • name       │    │ • name       │
└──────────────┘            └──────────────┘    └──────────────┘
     │                                │                  │
     └────────────────┬───────────────┴──────────────────┘
                      │
                      ▼
            ┌──────────────────┐
            │ service_         │
            │ executions       │
            │ • id (PK)        │
            │ • request_id(FK) │
            │ • service_date   │
            │ • work_done      │
            └────────┬─────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
┌──────────────────┐  ┌──────────────────┐
│ equipment_       │  │ indents          │
│ inspections      │  │ • id (PK)        │
│ • id (PK)        │  │ • request_id(FK) │
│ • execution_id   │  │ • indent_no      │
│ • [28 fields]    │  │ • parts_list     │
└──────────────────┘  └──────────────────┘
```

This structure eliminates duplication and creates proper relationships.
