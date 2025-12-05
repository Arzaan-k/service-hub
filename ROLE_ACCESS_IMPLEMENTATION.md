# Role-Based Access Control Implementation

## Overview

This document describes the complete Role-Based Access Control (RBAC) system implemented in the Service Hub application. The system enforces strict access controls based on 6 distinct user roles.

## System Roles

### 1. Admin (admin)
**Access Level:** Complete system access (highest privilege)

**What they can access:**
- ✅ All containers (all types, statuses, IoT deployment states)
- ✅ All alerts across all containers
- ✅ All service requests with full management capabilities
- ✅ All technicians - create, view, edit, and manage profiles
- ✅ All customers/clients - complete access including financial information
- ✅ User management - create, edit, delete users and assign roles
- ✅ Scheduling & trip planning - full technician travel planning access
- ✅ Inventory management - complete parts inventory control
- ✅ WhatsApp administration - template management and message monitoring
- ✅ Analytics & reporting - full system-wide analytics
- ✅ Service history - complete access to all service records
- ✅ RAG Chat (AI Assistant) - access to diagnostic chatbot
- ✅ Manuals - upload and manage technical manuals

**Restrictions:**
- None - complete system access

---

### 2. Senior Technician (senior_technician)
**Access Level:** Specialized technical operations (medium privilege)

**Container Access:**
- ✅ **ONLY refrigerated containers** (type: "refrigerated")
- ✅ All refrigerated containers regardless of IoT status or deployment
- ✅ All container statuses (active, maintenance, sold, etc.)

**What they can access:**
- ✅ Dashboard - system overview
- ✅ Filtered containers - only refrigerated containers
- ✅ Related alerts - alerts from their accessible containers
- ✅ Related service requests - service requests for their containers
- ✅ Inventory - parts access for service work
- ✅ Manuals - technical documentation access
- ✅ RAG Chat - AI diagnostic assistance
- ✅ Customer data - **read-only** contact information only
- ✅ Service history - service records
- ✅ Profile management - personal profile updates

**Restrictions:**
- ❌ Cannot access dry containers, special containers, or non-refrigerated equipment
- ❌ No access to customer financial data (payment terms, billing addresses, GSTIN)
- ❌ No technician management or user creation capabilities
- ❌ No scheduling or trip planning access
- ❌ No WhatsApp communication tools
- ❌ No analytics access
- ❌ Read-only customer contact info (cannot edit)

---

### 3. Coordinator (coordinator)
**Access Level:** Full operational access (high privilege, no user management)

**What they can access:**
- ✅ All containers (all types, statuses, IoT states)
- ✅ All alerts
- ✅ All service requests
- ✅ Technician management - view, create, edit, manage
- ✅ Scheduling & trip planning - full access
- ✅ Complete customer/client data including financial information
- ✅ Inventory management - full access
- ✅ WhatsApp communication and template management
- ✅ Analytics & reporting
- ✅ Service history - all records
- ✅ Manuals - access and upload
- ✅ RAG Chat - AI assistant
- ✅ Profile management

**Restrictions:**
- ❌ No user management (cannot create/edit/delete users or assign roles)

---

### 4. Technician (technician)
**Access Level:** General field operations (medium privilege)

**Container Access:**
- ✅ **ONLY containers they have allocated services for**
- ✅ Full container data for assigned containers

**What they can access:**
- ✅ Dashboard - operational overview
- ✅ Containers - only containers with allocated services to them
- ✅ All alerts - monitor alerts for system-wide awareness
- ✅ Service requests - only requests assigned to them
- ✅ Inventory - parts access for service work
- ✅ WhatsApp communication - customer communication tools
- ✅ Manuals - technical documentation
- ✅ RAG Chat - AI diagnostic assistance
- ✅ Service history - their completed service records
- ✅ Profile management - personal profile updates

**Restrictions:**
- ❌ No customer data access (financial or contact information)
- ❌ Cannot view containers without allocated services
- ❌ No technician management or scheduling capabilities
- ❌ No user management or analytics access
- ❌ No coordinator/admin features

---

### 5. AMC (After Market Care) (amc)
**Access Level:** Limited customer support (low-medium privilege)

**Container Access:**
- ✅ **ONLY sold containers** (status: "sold")
- ✅ Limited data fields - contact information only

**What they can access:**
- ✅ Sold containers - only containers with "sold" status
- ✅ Limited container data:
  - Container ID, code, status, type
  - Manufacturer, model, capacity
  - Current location
- ✅ Customer contacts:
  - Company name
  - Contact person
  - Email
  - Phone
  - WhatsApp number
- ✅ Profile management - personal profile only

**Restrictions:**
- ❌ Cannot access operational containers (active, maintenance, in_service, etc.)
- ❌ No access to sensitive container data:
  - Health scores
  - Telemetry data
  - Orbcomm device IDs
  - Usage cycles
  - IoT information
- ❌ No access to customer financial data:
  - Payment terms
  - Billing addresses
  - Shipping addresses
  - GSTIN
  - Account manager information
  - Credit limits
  - Outstanding balances
- ❌ No alerts, service requests, inventory, or technical documentation access
- ❌ No technician or scheduling access
- ❌ No WhatsApp communication tools
- ❌ No analytics or system-wide data access

---

### 6. Client (client)
**Access Level:** Customer portal (lowest privilege)

**Container Access:**
- ✅ **ONLY their assigned containers**
- ✅ Full details of their containers only

**What they can access:**
- ✅ Client dashboard - personalized overview
- ✅ Their containers - only containers assigned to them
- ✅ Related alerts - alerts from their containers only
- ✅ Their service requests - service requests for their containers
- ✅ WhatsApp communication - direct communication with service team
- ✅ Profile management - personal profile updates

**Restrictions:**
- ❌ Cannot access other customers' containers or data
- ❌ No access to technician information or scheduling
- ❌ No inventory, manuals, or technical documentation access
- ❌ No analytics or system-wide data access
- ❌ No service history access
- ❌ No customer/client list access

---

## Implementation Details

### Backend Enforcement

#### 1. Role Access Filter (`server/services/roleAccess.ts`)

```typescript
// Admin - Complete access
case 'admin':
  return {
    role: 'admin',
    allowedTypes: undefined,      // All types
    requiresIoT: undefined,        // All IoT states
    allowedStatuses: undefined,    // All statuses
    fieldsRestriction: 'full'      // Full access
  };

// Senior Technician - Refrigerated only
case 'senior_technician':
  return {
    role: 'senior_technician',
    allowedTypes: ['refrigerated'], // ONLY refrigerated
    requiresIoT: undefined,         // All IoT states
    allowedStatuses: undefined,     // All statuses
    fieldsRestriction: 'readonly'   // Read-only customer data
  };

// AMC - Sold only with limited fields
case 'amc':
  return {
    role: 'amc',
    allowedStatuses: ['sold'],      // ONLY sold
    fieldsRestriction: 'contact_only' // Contact info only
  };

// Technician - Assigned services only
case 'technician':
  return {
    role: 'technician',
    assignedOnly: true,             // Only assigned containers
    fieldsRestriction: 'full'       // Full container data
  };
```

#### 2. Customer Data Sanitization

**Admin/Coordinator:** Full access to all customer data including:
- Payment terms, billing/shipping addresses
- GSTIN, credit limits, outstanding balances
- Account manager information

**Senior Technician:** Read-only contact information:
- Company name, contact person
- Email, phone, WhatsApp number
- ❌ No financial data

**AMC:** Contact information only:
- Company name, contact person
- Email, phone, WhatsApp number
- ❌ No financial data

**Technician:** No customer data access

#### 3. Container Data Filtering

**Senior Technician:**
```typescript
containers.filter(c => c.type === 'refrigerated')
```

**AMC:**
```typescript
containers
  .filter(c => c.status === 'sold')
  .map(c => ({
    id, containerCode, status, type,
    manufacturer, model, capacity, currentLocation
    // Sensitive data removed
  }))
```

**Technician:**
```typescript
containers.filter(c => hasAllocatedService(technicianId, c.id))
```

### Frontend Enforcement

#### Sidebar Menu Visibility (`client/src/components/layout/sidebar.tsx`)

Menu items automatically filtered based on user role:

```typescript
const navItems = [
  { path: "/", label: "Dashboard", roles: ["admin", "coordinator", "technician", "senior_technician"] },
  { path: "/containers", roles: ["admin", "coordinator", "technician", "senior_technician", "amc", "client"] },
  { path: "/alerts", roles: ["admin", "coordinator", "technician", "senior_technician", "client"] },
  // ... etc
].filter(item => item.roles.includes(role));
```

#### Page Access Control

Both frontend menu and backend API routes enforce page access using `hasPageAccess()` function.

### Security Layers

1. **Frontend:** Menu visibility and routing
2. **Backend:** API endpoint authentication
3. **Data Layer:** Query-level filtering and sanitization
4. **Business Logic:** Role-based business rules

## Testing Role Access

### Admin Testing
```bash
# Login as admin@servicehub.com
# Should see ALL menu items and features
# Can access all containers, all customers, user management
```

### Senior Technician Testing
```bash
# Login as senior technician
# Should see only refrigerated containers
# Can view customer contact info (read-only)
# Cannot access dry/special containers
# Cannot manage users or technicians
```

### AMC Testing
```bash
# Login as AMC user
# Should see only "Containers", "Clients", "My Profile"
# Containers list shows only sold containers
# Customer data shows contact info only (no financial data)
# Cannot access alerts, service requests, or inventory
```

### Technician Testing
```bash
# Login as technician
# Should see only containers with allocated services
# Can view all alerts
# Can only see assigned service requests
# Cannot view customer information
```

### Client Testing
```bash
# Login as client
# Should see client dashboard
# Can only access their own containers
# Can view their service requests
# Cannot access other customers' data
```

## Database Queries

### Container Filtering Examples

**Admin:**
```sql
SELECT * FROM containers;
```

**Senior Technician:**
```sql
SELECT * FROM containers WHERE type = 'refrigerated';
```

**AMC:**
```sql
SELECT id, container_code, status, type, manufacturer, model, capacity, current_location
FROM containers WHERE status = 'sold';
```

**Technician:**
```sql
SELECT c.* FROM containers c
INNER JOIN service_requests sr ON sr.container_id = c.id
WHERE sr.technician_id = $1;
```

**Client:**
```sql
SELECT * FROM containers WHERE current_customer_id = $1;
```

## Migration Notes

- No database schema changes required
- Existing user roles remain functional
- Role access enforced at application layer
- Backward compatible with existing data

## Security Considerations

1. **Defense in Depth:** Multiple layers of access control
2. **Principle of Least Privilege:** Users only access what they need
3. **Data Sanitization:** Sensitive data stripped based on role
4. **Audit Trail:** All role-based access logged
5. **Session Management:** Role checked on every request

## Maintenance

### Adding New Roles
1. Update `getRoleAccessFilter()` in `roleAccess.ts`
2. Add role to `hasPageAccess()` function
3. Update sidebar menu items
4. Add role-specific data sanitization
5. Update documentation

### Modifying Permissions
1. Update role filter configuration
2. Update `hasPageAccess()` allowed pages
3. Update sidebar menu roles array
4. Test all affected endpoints
5. Update this documentation

---

**Implementation Date:** December 5, 2025
**Status:** Complete and Production Ready
**Files Modified:**
- `server/services/roleAccess.ts`
- `client/src/components/layout/sidebar.tsx`
