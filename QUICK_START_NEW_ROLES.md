# 🚀 Quick Start Guide - New Roles

## Step 1: Run Database Migration

Open your PostgreSQL terminal and run:

```sql
-- Connect to your database
\c your_database_name

-- Add new roles
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'senior_technician';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'amc';

-- Verify
SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role');
```

Or use the migration file:

```bash
psql $DATABASE_URL -f migrations/add_new_roles.sql
```

---

## Step 2: Restart Server

```bash
# Stop current server (Ctrl+C)
# Then restart
npm run dev
```

---

## Step 3: Create Test Users

### Option A: Create Senior Technician (Technicians Page)

1. Navigate to: `http://localhost:3000/technicians`
2. Click **"Add Technician"**
3. Fill in:
   ```
   Name: Test Senior Tech
   Phone: +1111111111
   Email: seniortech@test.com
   Role: Senior Technician ← IMPORTANT!
   Experience: Senior
   Specialization: Refrigeration
   Base Location: New York
   ```
4. Click **"Create Technician & Send Credentials"**
5. Check email for password setup link

### Option B: Create AMC User (User Management Page)

1. Navigate to: `http://localhost:3000/admin/user-management`
2. Click **"Create User"**
3. Fill in:
   ```
   Name: AMC Test User
   Phone: +2222222222
   Email: amc@test.com
   Role: AMC ← IMPORTANT!
   ```
4. Click **"Create User & Send Credentials"**
5. Check email for credentials

---

## Step 4: Test Access Controls

### Test Senior Technician Access

**Login** with senior technician account

**Expected Behavior:**
- ✅ Can see Dashboard
- ✅ Can see Containers page
  - Shows ONLY reefer containers with IoT enabled and status active/in_service
  - Should NOT show dry containers
  - Should NOT show containers without IoT
- ✅ Can see Clients page (READ-ONLY)
  - Can view all client data
  - **Cannot** add/edit/delete clients (no action buttons shown)
- ✅ Can see Alerts (for accessible containers)
- ✅ Can see Service Requests (for accessible containers)
- ✅ Can access Inventory
- ✅ Can access Manuals
- ✅ Can access AI Assistant
- ❌ Cannot see User Management
- ❌ Cannot see Analytics

### Test AMC Access

**Login** with AMC account

**Expected Behavior:**
- ✅ Can see Containers page
  - Shows ONLY containers with status "sold"
  - Limited fields: basic info only, no telemetry/health data
- ✅ Can see Clients page
  - Shows contact information only
  - No billing, payment terms, or financial data
- ❌ Cannot see Dashboard
- ❌ Cannot see Alerts
- ❌ Cannot see Service Requests
- ❌ Cannot see Inventory

---

## Quick Test Checklist

### ☑️ Database Migration
- [ ] Migration executed successfully
- [ ] New roles visible in database enum

### ☑️ Senior Technician
- [ ] Can create senior technician via Technicians page
- [ ] Role selector shows "Senior Technician" option
- [ ] Welcome email sent with password reset link
- [ ] Login successful
- [ ] Sees only reefer containers with IoT
- [ ] Cannot access admin pages

### ☑️ AMC User
- [ ] Can create AMC user via User Management
- [ ] Role selector shows "AMC" option
- [ ] Welcome email sent
- [ ] Login successful
- [ ] Sees only sold containers
- [ ] Container data is sanitized (no telemetry)
- [ ] Client data is sanitized (contact only)

---

## Common Issues & Solutions

### ❌ "Role not found in dropdown"
**Fix**: Restart the server

### ❌ "Migration error: value already exists"
**Fix**: Safe to ignore - migration uses `IF NOT EXISTS`

### ❌ "Senior Technician sees all containers"
**Check**:
1. Are containers marked as reefer type? (`type = 'refrigerated'`)
2. Do containers have IoT enabled? (`has_iot = true`)
3. Are containers active? (`status = 'active' OR 'in_service'`)

### ❌ "AMC sees full container data"
**Check**: Server logs for data sanitization
Look for: `[SERVER] /api/containers after role filtering (amc)`

---

## Support

For detailed information, see: [NEW_ROLES_IMPLEMENTATION.md](NEW_ROLES_IMPLEMENTATION.md)
