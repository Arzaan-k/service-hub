# WhatsApp Real Data Integration Guide

## ✅ Implementation Complete

The WhatsApp integration now fetches **real container data** from your dashboard database for registered clients.

---

## 🎯 How It Works

### For **Real Registered Clients** (e.g., Crystal Group +918218994855)

When a real client interacts with WhatsApp:

1. **System identifies the client** using their WhatsApp number
2. **Fetches their profile** from `customers` table
3. **Fetches their containers** from `containers` table using `currentCustomerId`
4. **Shows ONLY their real containers** - NOT mock data

#### Example Flow:
```
Client: hi
Bot: 👋 Welcome Jawad!
     🏢 Crystal Group
     How can I help you today?
     
     [🧰 Request Service] [📊 Status]

Client: [Clicks Request Service]
Bot: 🔧 Service Request
     Which container needs service?
     
     TRIU6617292 – refrigerated
     Status: active | Location: Thane
     
     TDRU7152244 – dry  
     Status: active | Location: Los Angeles
     
     [TRIU6617292] [TDRU7152244]  ← Real containers from database!
```

---

## 🧪 Test Mode vs Real Mode

### Test Numbers (Show Mock Data)
- `+917021307474` / `7021307474`
- `+918218994855` / `8218994855` (if configured as test)

**Test numbers see:**
- Role selection menu (Technician/Client)
- Mock containers: TEST001, TEST002, TEST003
- "Switch Role" button
- Used for testing flows without affecting real data

### Real Clients (Show Real Data)
- Any WhatsApp number registered in your `users` table with `whatsappVerified = true`
- Must have a linked `customers` record

**Real clients see:**
- Their actual containers from database
- Real container status, location, metrics
- Real service requests
- NO "Switch Role" button
- NO mock data

---

## 🔧 How to Make a Number Use Real Data

### Option 1: Remove from Test Numbers
If +918218994855 is currently a test number, remove it from the test number list:

**In `.env` file:**
```env
# Remove 918218994855 from this list:
WHATSAPP_TEST_NUMBERS=917021307474,7021307474
```

### Option 2: Ensure Proper Database Setup
Make sure the client exists in your database:

1. **User record** in `users` table:
   - `phoneNumber`: `918218994855` (digits only)
   - `role`: `client`
   - `whatsappVerified`: `true`
   - `isActive`: `true`

2. **Customer record** in `customers` table:
   - `userId`: (linked to user above)
   - `companyName`: `Crystal Group`
   - `contactPerson`: `Jawad`
   - `whatsappNumber`: `918218994855`
   - `status`: `active`

3. **Container records** in `containers` table:
   - `containerCode`: `TRIU6617292`, `TDRU7152244`, etc.
   - `currentCustomerId`: (linked to customer above)
   - `status`: `active`

---

## 📋 Button IDs Reference

### Real Client Buttons (Fetch Real Data)
- `request_service` → Fetches real containers from database
- `status` → Shows real container status
- `select_container_{containerId}` → Selects real container for service request
- `status_container_{containerId}` → Shows real container details
- `attach_photos_yes` / `attach_photos_no` → Photo attachment choice

### Test Mode Buttons (Use Mock Data)
- `test_client_request_service` → Shows mock containers
- `test_client_status` → Shows mock status
- `test_container_TEST001` → Mock container selection
- `switch_role` → Switch between test roles

---

## 🚀 Testing the Real Data Flow

### Step 1: Verify Database
```sql
-- Check if client exists
SELECT u.*, c.* 
FROM users u 
JOIN customers c ON c.userId = u.id 
WHERE u.phoneNumber = '918218994855';

-- Check client's containers
SELECT cont.* 
FROM containers cont
JOIN customers c ON cont.currentCustomerId = c.id
JOIN users u ON c.userId = u.id
WHERE u.phoneNumber = '918218994855';
```

### Step 2: Test WhatsApp Flow
1. Send "hi" from +918218994855
2. Should see: "Welcome Jawad! 🏢 Crystal Group"
3. Click "🧰 Request Service"
4. Should see: TRIU6617292 and TDRU7152244 (real containers)
5. Select a container
6. Follow the flow: error code → description → photos → submit
7. Check Dashboard → Service Requests for the new request

### Step 3: Verify Service Request Created
- Go to Dashboard → Service Requests
- Should see new request with:
  - Request Number: SR-xxxxx
  - Container: TRIU6617292 (or selected container)
  - Status: Pending
  - Description: (what client entered)
  - Photos: (if attached)

---

## 🔍 Troubleshooting

### Issue: Still seeing TEST001, TEST002, TEST003
**Cause:** Number is configured as a test number

**Fix:**
1. Check `.env` → `WHATSAPP_TEST_NUMBERS`
2. Remove the number from the list
3. Restart server

### Issue: "No active containers found"
**Cause:** Client has no containers in database OR containers not assigned to them

**Fix:**
1. Check database: `SELECT * FROM containers WHERE currentCustomerId = '{customerId}'`
2. Assign containers to the client in Dashboard → Containers
3. Ensure `status = 'active'`

### Issue: "Customer profile not found"
**Cause:** No customer record linked to the user

**Fix:**
1. Create customer record in Dashboard → Clients
2. Link to user via `userId`
3. Set `whatsappNumber` to match user's phone

---

## 📁 Key Files Modified

- `server/services/whatsapp.ts`:
  - `handleRealClientRequestService()` - Fetches real containers
  - `handleContainerSelection()` - Processes real container selection
  - `createServiceRequestFromWhatsApp()` - Creates real service request
  - `handleRealClientStatusCheck()` - Shows real container status
  - `showContainerStatus()` - Displays real container details
  - `sendRealClientMenu()` - Shows real client menu

---

## 🎉 Summary

✅ **Real clients** (non-test numbers) now see **real container data** from the database
✅ **Test numbers** still see mock data for testing
✅ **Service requests** created via WhatsApp appear on the Dashboard
✅ **No mock data fallback** for registered clients
✅ **All existing functionality** preserved

The system automatically detects whether a number is a test number or a real client and shows the appropriate data.
