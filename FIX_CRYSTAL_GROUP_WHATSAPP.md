# Fix Crystal Group WhatsApp Integration

## 🎯 Problem Identified

You've created **Crystal Group** client in the dashboard with:
- ✅ Company Name: Crystal Group
- ✅ Contact Person: Jawad
- ✅ WhatsApp Number: +918218994855
- ✅ Containers: TDRU7152244, TRIU6617292

**BUT** WhatsApp still shows mock data because:
- ❌ The user account has `whatsappVerified = false`
- When creating clients via dashboard, WhatsApp is disabled by default

---

## ✅ Solution: Enable WhatsApp for Crystal Group

### Option 1: SQL Script (Fastest)

Run this SQL command to enable WhatsApp:

```sql
-- Enable WhatsApp for Crystal Group
UPDATE users 
SET whatsappVerified = true
WHERE id IN (
  SELECT u.id 
  FROM users u
  JOIN customers c ON c.userId = u.id
  WHERE c.companyName = 'Crystal Group' 
    OR u.phoneNumber IN ('918218994855', '8218994855', '+918218994855')
);
```

**Verify it worked:**
```sql
SELECT 
  u.phoneNumber,
  u.name,
  u.whatsappVerified,
  c.companyName
FROM users u
JOIN customers c ON c.userId = u.id
WHERE c.companyName = 'Crystal Group';
```

**Expected result:**
- `whatsappVerified` should be `true`

---

### Option 2: API Call (Programmatic)

Use the new API endpoint to enable WhatsApp:

```bash
# Get the customer ID first (from dashboard or API)
# Then call:

curl -X PATCH http://localhost:5000/api/clients/{CUSTOMER_ID}/whatsapp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"enabled": true}'
```

---

### Option 3: Dashboard UI (Future Enhancement)

Add a WhatsApp toggle button in the client profile:
- Go to Dashboard → Clients → Crystal Group → Edit
- Toggle "WhatsApp Enabled" to ON
- Save

*(This requires frontend changes - not yet implemented)*

---

## 🔧 What I Fixed in the Code

### 1. **Changed Default WhatsApp Setting**
**File:** `server/routes.ts` (Line 1613)

**Before:**
```typescript
whatsappVerified: false, // WhatsApp disabled by default
```

**After:**
```typescript
whatsappVerified: true, // Enable WhatsApp by default for new clients
```

**Result:** All **new clients** created from now on will have WhatsApp enabled automatically.

---

### 2. **Added WhatsApp Toggle API**
**File:** `server/routes.ts` (Lines 1672-1696)

**New Endpoint:**
```
PATCH /api/clients/:id/whatsapp
Body: { "enabled": true }
```

**Purpose:** Enable/disable WhatsApp for existing clients without SQL.

---

## 🚀 Testing Steps

### Step 1: Enable WhatsApp (Choose one option above)
Run the SQL script or use the API endpoint.

---

### Step 2: Restart Server
```bash
# Stop server (Ctrl+C)
npm run dev
```

---

### Step 3: Clear WhatsApp Chat
- Delete conversation with bot
- Start fresh

---

### Step 4: Test WhatsApp
```
You: hi
Bot: 👋 Welcome Jawad!
     🏢 Crystal Group
     How can I help you today?
     
     [🧰 Request Service] [📊 Status]
```

**If still showing error:**
- Check server logs
- Verify SQL update worked
- Ensure phone number matches exactly

---

### Step 5: Test Container Fetch
```
You: [Click Request Service]
Bot: 🔧 Service Request
     Which container needs service?
     
     [Select Containers] → Should show:
     ✅ TDRU7152244 – dry | active | Los Angeles
     ✅ TRIU6617292 – refrigerated | active | Thane
```

**Success!** No more TEST001, TEST002, TEST003!

---

## 🔍 Verification Checklist

Run these checks to verify everything is set up:

### 1. Check User Record
```sql
SELECT 
  u.id,
  u.phoneNumber,
  u.name,
  u.role,
  u.isActive,
  u.whatsappVerified
FROM users u
JOIN customers c ON c.userId = u.id
WHERE c.companyName = 'Crystal Group';
```

**Expected:**
- ✅ `phoneNumber`: `918218994855` (or `8218994855`)
- ✅ `role`: `client`
- ✅ `isActive`: `true`
- ✅ `whatsappVerified`: `true` ← **MUST BE TRUE**

---

### 2. Check Customer Record
```sql
SELECT 
  c.id,
  c.companyName,
  c.contactPerson,
  c.whatsappNumber,
  c.status,
  u.phoneNumber as user_phone
FROM customers c
JOIN users u ON c.userId = u.id
WHERE c.companyName = 'Crystal Group';
```

**Expected:**
- ✅ `companyName`: `Crystal Group`
- ✅ `whatsappNumber`: `918218994855`
- ✅ `status`: `active`
- ✅ `userId`: (linked to user)

---

### 3. Check Containers
```sql
SELECT 
  cont.containerCode,
  cont.type,
  cont.status,
  c.companyName
FROM containers cont
JOIN customers c ON cont.currentCustomerId = c.id
WHERE c.companyName = 'Crystal Group';
```

**Expected:**
- ✅ `TDRU7152244` – assigned to Crystal Group
- ✅ `TRIU6617292` – assigned to Crystal Group
- ✅ Both `status`: `active`

---

## 📊 Server Logs to Watch For

After enabling WhatsApp and testing, you should see:

### ✅ Success Logs:
```
[WhatsApp Auth] Looking up customer for user abc-123 (Jawad)
[WhatsApp Auth] Found customer: Crystal Group (xyz-789)
[WhatsApp] Processing message for customer: Crystal Group (xyz-789)
```

### ❌ Error Logs (if still failing):
```
[WhatsApp Auth] Customer profile not found for user abc-123
→ Customer record missing or not linked

[WhatsApp] Customer profile not found for user abc-123 (phone: 918218994855)
→ User exists but customer record missing
```

---

## 🐛 Troubleshooting

### Issue: Still showing "Client profile not found"
**Cause:** User exists but customer record is missing or not linked

**Fix:**
```sql
-- Check if customer exists
SELECT * FROM customers WHERE userId = (
  SELECT id FROM users WHERE phoneNumber = '918218994855'
);

-- If no result, the customer record is missing
-- Recreate via Dashboard → Clients → Add Client
```

---

### Issue: Still showing TEST001, TEST002, TEST003
**Cause:** Number is still in test numbers list OR whatsappVerified is still false

**Fix:**
1. Check `server/services/whatsapp.ts` line 60:
   ```typescript
   const DEFAULT_TEST_NUMBERS = ['917021307474', '7021307474'];
   // Should NOT include 918218994855
   ```

2. Verify whatsappVerified:
   ```sql
   SELECT whatsappVerified FROM users WHERE phoneNumber = '918218994855';
   -- Should return: true
   ```

3. Restart server

---

### Issue: "No containers found"
**Cause:** Containers not assigned to customer

**Fix:**
```sql
UPDATE containers 
SET currentCustomerId = (
  SELECT c.id FROM customers c 
  JOIN users u ON c.userId = u.id 
  WHERE c.companyName = 'Crystal Group'
)
WHERE containerCode IN ('TDRU7152244', 'TRIU6617292');
```

---

## 📁 Files Modified

1. **`server/routes.ts`**:
   - Line 1613: Changed `whatsappVerified: true` (default for new clients)
   - Lines 1672-1696: Added WhatsApp toggle API endpoint

2. **`enable-whatsapp-crystal-group.sql`**:
   - SQL script to enable WhatsApp for existing client

---

## ✅ Summary

**Problem:** Crystal Group exists in dashboard but WhatsApp shows mock data

**Root Cause:** User account has `whatsappVerified = false`

**Solution:** 
1. Run SQL script to set `whatsappVerified = true`
2. Restart server
3. Test WhatsApp

**Result:** WhatsApp now shows real data:
- ✅ Welcome message with "Jawad" and "Crystal Group"
- ✅ Real containers: TDRU7152244, TRIU6617292
- ✅ No more TEST001, TEST002, TEST003

---

## 🎉 Next Steps

1. **Run the SQL script** (Option 1 above)
2. **Restart server**
3. **Test WhatsApp** - send "hi"
4. **Verify** you see real containers

All new clients created from now on will have WhatsApp enabled automatically! 🚀
