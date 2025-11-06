# WhatsApp Database Setup Guide

## 🚨 Error: "Sorry, I encountered an error processing your message"

This error occurs when the WhatsApp bot cannot find your client profile in the database.

---

## ✅ Database Requirements

For WhatsApp to work with real data, you need **3 database records**:

### 1. **User Record** (in `users` table)
```sql
-- Check if user exists
SELECT * FROM users WHERE phoneNumber = '918218994855';

-- If not exists, create user:
INSERT INTO users (
  id,
  phoneNumber,
  name,
  email,
  role,
  password,
  isActive,
  whatsappVerified,
  emailVerified
) VALUES (
  gen_random_uuid(),
  '918218994855',           -- Phone number (digits only, with country code)
  'Jawad',                  -- User name
  'jawad@crystalgroup.com', -- Email
  'client',                 -- Role MUST be 'client'
  'hashed_password_here',   -- Password hash
  true,                     -- isActive = true
  true,                     -- whatsappVerified = true (IMPORTANT!)
  true                      -- emailVerified
);
```

**Important Fields:**
- `phoneNumber`: Must match WhatsApp number (digits only: `918218994855`)
- `role`: Must be `'client'`
- `whatsappVerified`: Must be `true`
- `isActive`: Must be `true`

---

### 2. **Customer Record** (in `customers` table)
```sql
-- Check if customer exists
SELECT c.*, u.phoneNumber 
FROM customers c 
JOIN users u ON c.userId = u.id 
WHERE u.phoneNumber = '918218994855';

-- If not exists, create customer:
INSERT INTO customers (
  id,
  userId,
  companyName,
  contactPerson,
  email,
  phone,
  whatsappNumber,
  customerTier,
  paymentTerms,
  billingAddress,
  status
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM users WHERE phoneNumber = '918218994855'), -- Link to user
  'Crystal Group',          -- Company name
  'Jawad',                  -- Contact person
  'jawad@crystalgroup.com', -- Email
  '918218994855',           -- Phone
  '918218994855',           -- WhatsApp number
  'premium',                -- Tier
  'net30',                  -- Payment terms
  'Mumbai, India',          -- Address
  'active'                  -- Status MUST be 'active'
);
```

**Important Fields:**
- `userId`: Must link to the user record
- `whatsappNumber`: Must match user's phone number
- `status`: Must be `'active'`

---

### 3. **Container Records** (in `containers` table)
```sql
-- Check if containers exist
SELECT cont.* 
FROM containers cont
JOIN customers c ON cont.currentCustomerId = c.id
JOIN users u ON c.userId = u.id
WHERE u.phoneNumber = '918218994855';

-- If not exists, assign containers:
UPDATE containers 
SET currentCustomerId = (
  SELECT c.id FROM customers c 
  JOIN users u ON c.userId = u.id 
  WHERE u.phoneNumber = '918218994855'
)
WHERE containerCode IN ('TRIU6617292', 'TDRU7152244');
```

**Important Fields:**
- `currentCustomerId`: Must link to customer record
- `status`: Should be `'active'` for containers to appear
- `containerCode`: Unique identifier (e.g., TRIU6617292)

---

## 🔍 Troubleshooting Steps

### Step 1: Check User Exists
```sql
SELECT 
  id,
  phoneNumber,
  name,
  role,
  isActive,
  whatsappVerified
FROM users 
WHERE phoneNumber IN ('918218994855', '8218994855');
```

**Expected Result:**
- Should return 1 row
- `role` = 'client'
- `isActive` = true
- `whatsappVerified` = true

**If no result:**
- User doesn't exist → Create user in Dashboard → Users → Add User
- Set role to "Client"
- Enable WhatsApp verification

---

### Step 2: Check Customer Profile Exists
```sql
SELECT 
  c.id,
  c.companyName,
  c.contactPerson,
  c.status,
  u.phoneNumber
FROM customers c
JOIN users u ON c.userId = u.id
WHERE u.phoneNumber = '918218994855';
```

**Expected Result:**
- Should return 1 row
- `companyName` = 'Crystal Group'
- `status` = 'active'

**If no result:**
- Customer profile doesn't exist → Create in Dashboard → Clients → Add Client
- Link to the user created in Step 1
- Set WhatsApp number to match user's phone

---

### Step 3: Check Containers Assigned
```sql
SELECT 
  cont.containerCode,
  cont.type,
  cont.status,
  c.companyName
FROM containers cont
JOIN customers c ON cont.currentCustomerId = c.id
JOIN users u ON c.userId = u.id
WHERE u.phoneNumber = '918218994855';
```

**Expected Result:**
- Should return 2+ rows (TRIU6617292, TDRU7152244)
- `status` = 'active'

**If no result:**
- Containers not assigned → Go to Dashboard → Containers
- Find containers TRIU6617292 and TDRU7152244
- Edit each container
- Set "Assigned Client" to "Crystal Group"

---

## 🛠️ Quick Fix Script

Run this SQL script to set up everything at once:

```sql
-- 1. Create or update user
INSERT INTO users (
  id, phoneNumber, name, email, role, password, 
  isActive, whatsappVerified, emailVerified
) VALUES (
  gen_random_uuid(),
  '918218994855',
  'Jawad',
  'jawad@crystalgroup.com',
  'client',
  '$2a$10$dummy_hash_replace_with_real', -- Replace with real hash
  true,
  true,
  true
)
ON CONFLICT (phoneNumber) DO UPDATE SET
  role = 'client',
  isActive = true,
  whatsappVerified = true;

-- 2. Create or update customer
INSERT INTO customers (
  id, userId, companyName, contactPerson, email, 
  phone, whatsappNumber, customerTier, paymentTerms, 
  billingAddress, status
)
SELECT 
  gen_random_uuid(),
  u.id,
  'Crystal Group',
  'Jawad',
  'jawad@crystalgroup.com',
  '918218994855',
  '918218994855',
  'premium',
  'net30',
  'Mumbai, India',
  'active'
FROM users u
WHERE u.phoneNumber = '918218994855'
ON CONFLICT (userId) DO UPDATE SET
  whatsappNumber = '918218994855',
  status = 'active';

-- 3. Assign containers
UPDATE containers 
SET currentCustomerId = (
  SELECT c.id FROM customers c 
  JOIN users u ON c.userId = u.id 
  WHERE u.phoneNumber = '918218994855'
)
WHERE containerCode IN ('TRIU6617292', 'TDRU7152244');
```

---

## 📱 Testing After Setup

### 1. Check Server Logs
After restarting the server, send "hi" from WhatsApp and check logs:

```
[WhatsApp Auth] Looking up customer for user abc-123 (Jawad)
[WhatsApp Auth] Found customer: Crystal Group (xyz-789)
[WhatsApp] Processing message for customer: Crystal Group (xyz-789)
```

**If you see:**
```
[WhatsApp Auth] Customer profile not found for user abc-123
```
→ Customer record is missing or not linked to user

---

### 2. Test WhatsApp Flow
```
You: hi
Bot: 👋 Welcome Jawad!
     🏢 Crystal Group
     How can I help you today?
     
     [🧰 Request Service] [📊 Status]
```

**If you see error:**
- Check server logs for specific error
- Verify all 3 database records exist
- Ensure `whatsappVerified = true`

---

### 3. Test Container Fetch
```
You: [Click Request Service]
Bot: 🔧 Service Request
     Which container needs service?
     
     [Select Containers] → Should show:
     - TRIU6617292 – refrigerated | active | Thane
     - TDRU7152244 – dry | active | Los Angeles
```

**If you see "No containers found":**
- Containers not assigned to customer
- Run Step 3 of Quick Fix Script

---

## 🔧 Common Issues

### Issue 1: "Client profile not found"
**Cause:** No customer record linked to user

**Fix:**
1. Go to Dashboard → Clients → Add Client
2. Select user "Jawad" from dropdown
3. Fill in company details
4. Set WhatsApp number to `918218994855`
5. Save

---

### Issue 2: "No containers found"
**Cause:** Containers not assigned to customer

**Fix:**
1. Go to Dashboard → Containers
2. Find TRIU6617292
3. Click Edit
4. Set "Assigned Client" to "Crystal Group"
5. Repeat for TDRU7152244

---

### Issue 3: "WhatsApp access not enabled"
**Cause:** `whatsappVerified = false` in users table

**Fix:**
```sql
UPDATE users 
SET whatsappVerified = true 
WHERE phoneNumber = '918218994855';
```

---

## ✅ Verification Checklist

Before testing WhatsApp, verify:

- [ ] User exists with phone `918218994855`
- [ ] User role is `'client'`
- [ ] User `isActive = true`
- [ ] User `whatsappVerified = true`
- [ ] Customer record exists and linked to user
- [ ] Customer `status = 'active'`
- [ ] Customer `whatsappNumber = '918218994855'`
- [ ] Containers TRIU6617292 and TDRU7152244 exist
- [ ] Containers assigned to Crystal Group customer
- [ ] Containers `status = 'active'`
- [ ] Server restarted after database changes

---

## 📞 Support

If issues persist after following this guide:

1. Check server logs for specific errors
2. Verify database connection is working
3. Ensure all migrations are run
4. Check that storage methods are working:
   - `storage.getUserByPhoneNumber()`
   - `storage.getCustomerByUserId()`
   - `storage.getContainersByCustomer()`

---

## 🎉 Success!

Once all database records are set up correctly, you should see:

```
You: hi
Bot: 👋 Welcome Jawad!
     🏢 Crystal Group
     
     [🧰 Request Service] [📊 Status]

You: [Request Service]
Bot: Shows TRIU6617292 and TDRU7152244 (real containers!)
```

No more mock data (TEST001-003)! 🚀
