# WhatsApp Bot - Dynamic Role Detection Fix

## Problem Solved
Bot was not properly identifying whether a WhatsApp user is a Client or Technician from the dashboard, causing incorrect flow routing.

## Solution Implemented

### 1. ✅ Enhanced Role Detection (Lines 3687-3710)

The system now performs **3-tier role verification**:

```typescript
// TIER 1: Find user by phone number (with format variations)
let user = await storage.getUserByPhoneNumber(from);

// TIER 2: Check customer and technician tables
const customer = await storage.getCustomerByUserId(user.id);
const technician = await storage.getTechnicianByUserId(user.id);

// TIER 3: Update user role based on dashboard data
if (customer) {
  user.role = 'client';  // Update to client
} else if (technician) {
  user.role = 'technician';  // Update to technician
}
```

### 2. ✅ Comprehensive Logging

Every step is now logged with clear indicators:

- 🔍 **Role Verification**: Shows when checking dashboard data
- ✅ **Role Confirmed**: Shows which role was detected
- 🔄 **Role Updated**: Shows when user role is corrected
- 🎯 **Flow Routing**: Shows which flow (CLIENT/TECHNICIAN) is triggered
- 📱 **Client Mode**: Shows when client flow starts
- 🔧 **Technician Mode**: Shows when technician flow starts

### 3. ✅ Independent Flow Management

**Client Flow** (when customer record found):
1. Send "Request Service" and "Check Status" menu
2. Request Service → Show containers from dashboard
3. Send container ID reference image
4. Collect error code (or "NA" for auto video)
5. Collect issue description
6. Mandatory photo upload
7. Mandatory video upload
8. Create service request in database
9. Show confirmation with request number
10. Service request appears in Dashboard → Service Requests

**Technician Flow** (when technician record found):
1. Check for active service assignments
2. If active services → Show active services menu
3. If no active services → Show technician main menu
4. All data fetched from live dashboard (no mock data)

## Code Changes

### File: `server/services/whatsapp.ts`

#### Change 1: Enhanced Role Detection (Lines 3687-3710)
```typescript
// ENHANCED ROLE DETECTION: Check customer and technician tables
console.log(`[WhatsApp] 🔍 Verifying user role from dashboard data...`);
const customer = await storage.getCustomerByUserId(user.id);
const technician = await storage.getTechnicianByUserId(user.id);

if (customer && technician) {
  console.log(`[WhatsApp] ⚠️ User has both records. Using user.role: ${user.role}`);
} else if (customer) {
  console.log(`[WhatsApp] ✅ User identified as CLIENT from dashboard`);
  if (user.role !== 'client') {
    console.log(`[WhatsApp] 🔄 Updating user role to client`);
    await storage.updateUser(user.id, { role: 'client' });
    user.role = 'client';
  }
} else if (technician) {
  console.log(`[WhatsApp] ✅ User identified as TECHNICIAN from dashboard`);
  if (user.role !== 'technician') {
    console.log(`[WhatsApp] 🔄 Updating user role to technician`);
    await storage.updateUser(user.id, { role: 'technician' });
    user.role = 'technician';
  }
} else {
  console.log(`[WhatsApp] ⚠️ No customer or technician record. Using user.role: ${user.role}`);
}
```

#### Change 2: Enhanced Flow Routing (Lines 3770-3812)
```typescript
if (/^(hi|hello|hey|start|menu)$/i.test(text)) {
  console.log(`[WhatsApp] ✅ Greeting detected, user role: ${user.role}`);
  console.log(`[WhatsApp] 🎯 Routing to ${user.role.toUpperCase()} flow...`);
  
  if (user.role === 'client') {
    console.log(`[WhatsApp] 📱 Starting CLIENT MODE`);
    await sendRealClientMenu(from);
  } else if (user.role === 'technician') {
    console.log(`[WhatsApp] 🔧 Starting TECHNICIAN MODE`);
    // Technician flow with live data
  }
}
```

## Testing Instructions

### Test 1: Client Flow
1. **Setup**: Ensure user has a customer record in Dashboard → Customers
2. **Send**: "hi" to the bot
3. **Expected Logs**:
   ```
   [WhatsApp] Processing message from 918218994855
   [WhatsApp] Found existing user: John Doe (user-id), role: client
   [WhatsApp] 🔍 Verifying user role from dashboard data...
   [WhatsApp] ✅ User identified as CLIENT from dashboard
   [WhatsApp] ✅ Greeting detected, user role: client
   [WhatsApp] 🎯 Routing to CLIENT flow...
   [WhatsApp] 📱 Starting CLIENT MODE
   [WhatsApp] ✅ Client menu sent successfully
   ```
4. **Expected Response**: Menu with "Request Service" and "Check Status" buttons
5. **Test Service Request**:
   - Click "Request Service"
   - Select container(s)
   - Enter error code
   - Upload photos
   - Upload video
   - Verify service request appears in Dashboard → Service Requests

### Test 2: Technician Flow
1. **Setup**: Ensure user has a technician record in Dashboard → Technicians
2. **Send**: "hi" to the bot
3. **Expected Logs**:
   ```
   [WhatsApp] Processing message from 917021307474
   [WhatsApp] Found existing user: Tech Name (user-id), role: technician
   [WhatsApp] 🔍 Verifying user role from dashboard data...
   [WhatsApp] ✅ User identified as TECHNICIAN from dashboard
   [WhatsApp] ✅ Greeting detected, user role: technician
   [WhatsApp] 🎯 Routing to TECHNICIAN flow...
   [WhatsApp] 🔧 Starting TECHNICIAN MODE
   [WhatsApp] Technician found: Tech Name (tech-id)
   [WhatsApp] Active services count: X
   [WhatsApp] ✅ Technician menu sent successfully
   ```
4. **Expected Response**: Technician menu with schedule/service options

### Test 3: Role Correction
1. **Setup**: User exists with wrong role (e.g., role='client' but has technician record)
2. **Send**: "hi" to the bot
3. **Expected Logs**:
   ```
   [WhatsApp] Found existing user: Name (user-id), role: client
   [WhatsApp] 🔍 Verifying user role from dashboard data...
   [WhatsApp] ✅ User identified as TECHNICIAN from dashboard
   [WhatsApp] 🔄 Updating user role from client to technician
   [WhatsApp] 🎯 Routing to TECHNICIAN flow...
   ```
4. **Expected**: Role auto-corrected and technician flow triggered

## Key Features

✅ **Live Dashboard Data**: All role detection uses real database records
✅ **Auto Role Correction**: If user role doesn't match dashboard, it's automatically updated
✅ **Phone Format Handling**: Tries multiple phone number formats (with/without country code)
✅ **Independent Flows**: Client and technician flows are completely separate
✅ **Service Request Creation**: Client requests are automatically created in database
✅ **Dashboard Visibility**: All service requests appear in Dashboard → Service Requests
✅ **Comprehensive Logging**: Every step is logged for debugging
✅ **No Mock Data**: All data comes from live dashboard (except for test numbers)

## Verification Checklist

- [ ] Client with customer record gets client menu
- [ ] Technician with technician record gets technician menu
- [ ] Service requests created by client appear in dashboard
- [ ] Logs show correct role detection
- [ ] Logs show correct flow routing
- [ ] No mixing of client/technician flows
- [ ] Phone number variations are handled
- [ ] Role auto-correction works

## Common Issues & Solutions

### Issue: User gets wrong flow
**Check**:
1. Does user have correct record in dashboard?
   - Clients: Dashboard → Customers
   - Technicians: Dashboard → Technicians
2. Is phone number in dashboard matching WhatsApp number?
3. Check logs for role detection messages

**Fix**: Update user record in dashboard or correct phone number

### Issue: Service request not appearing in dashboard
**Check**:
1. Logs show "Service request created"?
2. Customer ID is valid?
3. Container ID is valid?

**Fix**: Check `createServiceRequestFromWhatsApp` logs for errors

### Issue: "Customer profile not found"
**Check**:
1. User has customer record linked?
2. Phone numbers match?

**Fix**: Link customer record to user in dashboard

## Next Steps

1. **Restart server**: `npm run dev`
2. **Test client flow**: Send "hi" from client phone
3. **Test technician flow**: Send "hi" from technician phone
4. **Verify logs**: Check console for role detection messages
5. **Create service request**: Complete full client flow
6. **Check dashboard**: Verify service request appears

---

**Status**: 🎉 **READY FOR TESTING**

The bot now:
- ✅ Dynamically detects user type from dashboard
- ✅ Routes to correct flow (client/technician)
- ✅ Uses live dashboard data (no mock data)
- ✅ Creates service requests visible in dashboard
- ✅ Maintains independent flows
- ✅ Provides comprehensive logging
