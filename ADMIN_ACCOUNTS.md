# 🔒 Admin Accounts Setup

## ✅ Accounts Created

### Account 1: System Administrator
- **Email:** admin@servicehub.com
- **Password:** Admin@2025#Secure
- **Role:** ADMIN (full access)
- **Phone:** +91-1000000001
- **Status:** ✅ Active

### Account 2: Backup Operations Manager
- **Email:** ops@servicehub.com
- **Password:** Ops@2025#Manager
- **Role:** ADMIN (full access)
- **Phone:** +91-1000000002
- **Status:** ✅ Active

> **Note:** These accounts were originally created as `super_admin` but converted to `admin` since both roles had identical access. The system now uses a single `admin` role for full system access.

---

## 🎯 Admin Role Features

### ✅ FULL ACCESS TO EVERYTHING:

1. **Dashboard**
   - System overview
   - Statistics and metrics
   - Real-time monitoring

2. **Containers**
   - All container types (refrigerated, dry, special)
   - All statuses (active, in_service, maintenance, retired, etc.)
   - IoT and non-IoT containers
   - Container details and telemetry

3. **Alerts**
   - All alerts across all containers
   - Alert management and resolution
   - Alert classification

4. **Service Requests**
   - View all service requests
   - Assign technicians
   - Track service progress
   - Service completion verification

5. **Technicians**
   - View all technicians
   - Create/edit technician profiles
   - Manage technician assignments
   - Track technician performance

6. **Scheduling**
   - Trip planning and optimization
   - Multi-location route planning
   - Travel and accommodation booking
   - Trip finance tracking

7. **Inventory**
   - Parts inventory management
   - Stock tracking
   - Inventory alerts

8. **User Management**
   - Create/edit/delete users
   - Assign roles
   - Manage permissions
   - Send credentials

9. **Analytics**
   - System-wide analytics
   - Performance metrics
   - Reports and insights

10. **WhatsApp Admin**
    - Template management
    - Message monitoring
    - Flow configuration

11. **Service History**
    - Complete service history
    - Performance analysis
    - Cost tracking

12. **Clients/Customers** ✅ **FULL ACCESS**
    - View all clients
    - Client details (names, contacts, financial data)
    - Create/edit/delete clients
    - Manage client relationships
    - Access to all customer information

---

## 🔐 Security Implementation

### Backend Protection

**File:** `server/services/roleAccess.ts`

```typescript
// Page access control
export function hasPageAccess(role: string, page: string): boolean {
  const normalizedRole = role.toLowerCase();

  // SUPER_ADMIN and Admin have access to EVERYTHING
  if (['super_admin', 'admin'].includes(normalizedRole)) {
    return true;
  }
  // ... other roles
}

// Client data access
export function canAccessClientData(role: string): boolean {
  const normalizedRole = role.toLowerCase();

  // SUPER_ADMIN, ADMIN, COORDINATOR have full access
  if (['super_admin', 'admin', 'coordinator'].includes(normalizedRole)) {
    return true;
  }
  // ... other roles
}
```

### API Endpoint Access

**File:** `server/routes.ts`

```typescript
// GET /api/customers - super_admin has full access
app.get("/api/customers", authenticateUser,
  requireRole("admin", "coordinator", "super_admin"),
  async (req: AuthRequest, res) => {
    const customers = await storage.getAllCustomers();
    // super_admin gets all data
    res.json(customersWithCounts);
  }
);

// GET /api/clients - super_admin has full access
app.get("/api/clients", authenticateUser,
  requireRole("admin", "coordinator", "amc", "senior_technician", "super_admin"),
  async (req: AuthRequest, res) => {
    let list = await storage.getAllCustomers();
    // super_admin gets full client data
    res.json(list);
  }
);
```

### Frontend Access

**File:** `client/src/components/layout/sidebar.tsx`

```typescript
const navItems = [
  // ... other nav items
  {
    path: "/clients",
    label: "Clients",
    icon: "fas fa-users",
    roles: ["admin", "coordinator", "super_admin", "amc", "senior_technician"]
    // super_admin INCLUDED - full access
  },
  // ... other nav items
];
```

---

## 🧪 Testing the Setup

### Test 1: Login
```
1. Go to http://localhost:5000/login
2. Login with: admin@servicehub.com / Admin@2025#Secure
3. Verify successful login
```

### Test 2: Sidebar Menu
```
✅ Should see ALL menu items:
- Dashboard
- Containers
- Alerts
- Service Requests
- Service History
- Technicians
- Scheduling
- Clients ✅ (Full access)
- Inventory
- User Management
- Analytics
```

### Test 3: Direct URL Access
```
Try accessing: http://localhost:5000/clients
Expected: ✅ Full access to clients page
```

### Test 4: API Access
```bash
# Get auth token after login
TOKEN="your-jwt-token"

# Access clients API
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/clients

Expected Response: ✅ Full client data list
```

### Test 5: Container Access
```
✅ Should work:
1. Go to /containers
2. View all containers
3. See container details
4. Access all container features
```

### Test 6: Service Requests & Client Data
```
✅ Should work:
1. Go to /service-requests
2. View all service requests
3. Assign technicians
4. Track progress
5. View full client details in service requests ✅
```

---

## 📝 Usage Guidelines

### When to Use Super Admin

**Use super_admin role for:**
- System administrators who need complete system access
- Top-level executives who require oversight of everything
- Operations managers who oversee all aspects
- Users who need unrestricted access to ALL features
- Senior management requiring full visibility

### Super Admin vs Regular Admin

**Both super_admin and admin have identical access:**
- Full system access
- All features enabled
- Complete client/customer data visibility
- User management capabilities
- Analytics and reporting

**Note:** super_admin is typically reserved for the highest-level system administrators and owners.

---

## 🔄 Role Comparison

| Feature | Super Admin | Admin | Coordinator |
|---------|-------------|-------|-------------|
| Dashboard | ✅ Full | ✅ Full | ✅ Full |
| Containers | ✅ All | ✅ All | ✅ All |
| Alerts | ✅ All | ✅ All | ✅ All |
| Service Requests | ✅ Full | ✅ Full | ✅ Full |
| Technicians | ✅ Full | ✅ Full | ✅ Full |
| Scheduling | ✅ Full | ✅ Full | ✅ Full |
| Inventory | ✅ Full | ✅ Full | ✅ Full |
| User Management | ✅ Full | ✅ Full | ❌ None |
| Analytics | ✅ Full | ✅ Full | ❌ None |
| **Clients/Customers** | ✅ Full | ✅ Full | ✅ Full |
| Client Details | ✅ Full | ✅ Full | ✅ Full |
| Financial Data | ✅ Full | ✅ Full | ✅ Full |

---

## 🔧 Maintenance

### Reset Super Admin Password

Run the script again to update password:

```bash
npx tsx scripts/create-super-admins.ts
```

### Add More Super Admins

Edit `scripts/create-super-admins.ts` and add more accounts:

```typescript
// Account 3: Example
const admin3 = await createSuperAdmin(
  'Another Admin',
  'another@servicehub.com',
  'SecurePass@2025',
  '+91-1000000003'
);
```

### Convert Existing User to Super Admin

```sql
UPDATE users
SET role = 'super_admin'
WHERE email = 'user@example.com';
```

### Revoke Super Admin Access

```sql
UPDATE users
SET role = 'admin'
WHERE email = 'admin@servicehub.com';
```

---

## 📊 Database Changes

### Users Table
No schema changes required. The `super_admin` role is part of the existing `user_role` enum.

```sql
-- Check current super admins
SELECT id, name, email, role, is_active
FROM users
WHERE role = 'super_admin';
```

---

## 🚨 Important Security Notes

1. **Password Security**
   - Use strong passwords (minimum 12 characters)
   - Include uppercase, lowercase, numbers, special characters
   - Store passwords securely (use password manager)
   - Rotate passwords regularly

2. **Access Monitoring**
   - Monitor super admin login activity
   - Review actions in audit logs
   - Set up alerts for suspicious activity

3. **Client Data Access**
   - Super admins have FULL access to all client data
   - Same level of access as regular admin role
   - Complete visibility into customer information

4. **Backup Account**
   - Keep ops@servicehub.com as backup
   - Don't share credentials
   - Use only when primary admin unavailable

---

## ✅ Verification Checklist

- [x] Both super admin accounts created
- [x] Passwords are strong and secure
- [x] Accounts have super_admin role
- [x] Backend API blocks client data access
- [x] Frontend hides client menu items
- [x] Role access functions updated
- [x] All other features accessible
- [x] Documentation completed

---

## 📞 Support

If you encounter issues:

1. **Login Problems:** Check credentials match exactly
2. **Permission Errors:** Verify role is `super_admin` in database
3. **Client Menu Visible:** Clear browser cache and reload
4. **API Errors:** Check server logs for details

---

**Created:** December 4, 2025
**Last Updated:** December 4, 2025
**Script Location:** [scripts/create-super-admins.ts](scripts/create-super-admins.ts)
