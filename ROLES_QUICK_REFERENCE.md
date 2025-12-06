# Role Access Quick Reference

## 5 Roles Implemented

### 1. Admin
- **Access:** Everything
- **Containers:** All
- **Customers:** Full (contact + financial)

### 2. Senior Technician
- **Access:** Technical operations
- **Containers:** Only **refrigerated** (all statuses, all IoT)
- **Customers:** Read-only contact info

### 3. AMC
- **Access:** Limited support
- **Containers:** Only **sold** (limited fields)
- **Customers:** Contact info only

### 4. Technician
- **Access:** Field operations
- **Containers:** Only **assigned services**
- **Customers:** None

### 5. Client
- **Access:** Customer portal
- **Containers:** Only **theirs**
- **Customers:** None

---

## Key Restrictions

### Senior Technician
- ❌ Cannot access dry/special containers
- ❌ No customer financial data
- ❌ No technician/scheduling management

### AMC
- ❌ Cannot access active/maintenance containers
- ❌ No health scores, telemetry, IoT data
- ❌ No service requests, alerts, inventory

### Technician
- ❌ No customer data
- ❌ Only containers with allocated services
- ❌ No technician/user management

### Client
- ❌ No other customers' data
- ❌ No technician info
- ❌ No inventory/manuals

---

**See [ROLE_ACCESS_FINAL.md](./ROLE_ACCESS_FINAL.md) for complete details**
