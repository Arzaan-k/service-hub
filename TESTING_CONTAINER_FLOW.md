# Testing Container Verification Flow

## ⚠️ IMPORTANT: Before Testing

### 1. Restart the Server
The changes are in the code, but you need to restart the server for them to take effect:

```bash
# Stop the current server (Ctrl+C in terminal)
# Then restart:
npm run dev
```

### 2. Clear Existing WhatsApp Session (Optional but Recommended)
If you've already sent "hi" before, the old session state might interfere. You can:

**Option A: Send from a different WhatsApp number**
- Test with a fresh number that hasn't interacted with the bot yet

**Option B: Clear the session in database**
- The session will reset automatically after some time
- Or manually delete from `whatsapp_sessions` table for your phone number

**Option C: Wait a few minutes**
- Sessions expire after inactivity

---

## 📋 Test Scenarios

### ✅ Test 1: Valid Container Number (Happy Path)

**Steps:**
1. Send: `hi` or `hii` or `hello`
2. **Expected Response:** 
   ```
   👋 Welcome! Please enter your container number to continue.
   ```
3. Enter a **valid container number** from your database (e.g., `CONT123`)
4. **Expected Response:** Client menu with buttons:
   - 🛠️ Request Service
   - 📊 Check Status

**What to verify:**
- ✅ Bot asks for container number (not showing menu immediately)
- ✅ Valid container is accepted
- ✅ Client menu appears after verification
- ✅ You can proceed with service request or status check normally

---

### ❌ Test 2: Invalid Container - First Attempt

**Steps:**
1. Send: `hi`
2. Bot asks for container number
3. Enter an **invalid container number** (e.g., `INVALID123`)
4. **Expected Response:**
   ```
   ❌ Invalid container number. Please enter a correct container number.
   ```
5. Bot should still be waiting for container number input

**What to verify:**
- ✅ Error message shows on first invalid attempt
- ✅ Bot asks to try again (doesn't give up)
- ✅ You can enter another container number

---

### ❌ Test 3: Invalid Container - Second Attempt (Support Contact)

**Steps:**
1. Send: `hi`
2. Bot asks for container number
3. Enter invalid container: `INVALID123`
4. Bot shows error and asks to try again
5. Enter another invalid container: `WRONG456`
6. **Expected Response:**
   ```
   ❌ Container number not found.
   
   Please contact support at +91 70213 07474 for assistance.
   ```
7. Flow should reset (you'd need to send "hi" again to restart)

**What to verify:**
- ✅ After 2 failed attempts, support contact is shown
- ✅ Flow resets (doesn't keep asking)
- ✅ Support number is: +91 70213 07474

---

### 🔧 Test 4: Technician Flow (Should NOT Ask for Container)

**Steps:**
1. Send `hi` from a **technician's WhatsApp number**
2. **Expected Response:** Technician menu immediately:
   - 👤 View Profile
   - 📋 View Schedule
   - 🔧 Start Service

**What to verify:**
- ✅ Technician is NOT asked for container number
- ✅ Technician menu appears immediately
- ✅ All technician features work normally

---

### 🔄 Test 5: Valid Container After Invalid Attempt

**Steps:**
1. Send: `hi`
2. Enter invalid container: `WRONG123`
3. Bot shows error
4. Enter **valid container**: `CONT123`
5. **Expected Response:** Client menu appears

**What to verify:**
- ✅ Valid container works even after one failed attempt
- ✅ Client menu appears correctly
- ✅ Flow continues normally

---

## 🔍 How to Check if Changes Are Active

### Check Server Logs
When you send "hi", you should see in terminal:

```
[WhatsApp] ✅ Greeting detected from 919321774772, user role: client
[WhatsApp] 🎯 Routing to CLIENT flow...
[WhatsApp] 📱 Starting CLIENT MODE for 919321774772
[WhatsApp] ✅ Container number request sent to 919321774772
```

If you see this, the changes are active! ✅

### If You Don't See Changes

1. **Restart the server:**
   - Press `Ctrl+C` in terminal
   - Run `npm run dev` again

2. **Check the file was saved:**
   - Look at `server/services/whatsapp.ts` line 4395
   - Should say: `'👋 Welcome! Please enter your container number to continue.'`

3. **Clear your WhatsApp session:**
   - Try from a different phone number
   - Or wait a few minutes for session to expire

---

## 📊 Database Requirements

### You Need Valid Container Data
Make sure you have containers in your database with:
- `containerCode` field populated (e.g., "CONT123", "CONT456")
- `currentCustomerId` linked to a valid customer

### Check Your Database:
```sql
-- See available containers
SELECT containerCode, currentCustomerId FROM containers LIMIT 10;

-- Use one of these container codes for testing
```

---

## ✅ Success Criteria

After testing, you should confirm:

- [x] Client greeting asks for container number
- [x] Valid container proceeds to client menu
- [x] Invalid container (1st attempt) asks to retry
- [x] Invalid container (2nd attempt) shows support contact
- [x] Technician flow unchanged (no container prompt)
- [x] Service request creation works after container verification
- [x] Status check works after container verification
- [x] Dashboard shows all data correctly

---

## 🆘 Troubleshooting

### "I still see the old menu immediately"
- **Solution:** Restart server and clear WhatsApp session

### "Bot doesn't respond at all"
- **Solution:** Check server is running, check WhatsApp API token is valid

### "Container verification doesn't work"
- **Solution:** Check database has containers with `containerCode` field

### "Technician also asked for container"
- **Solution:** Check user role in database is 'technician', not 'client'

---

## 📝 Notes

- Container numbers are automatically converted to UPPERCASE
- Session state tracks verification and attempts
- After 2 failed attempts, user must restart with "hi"
- All other flows (service request, status, etc.) work normally after verification
