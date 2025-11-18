# Quick Test Guide - WhatsApp Bot

## 🚀 Start Server
```bash
npm run dev
```

## 📱 Test Client Flow

### Step 1: Send "hi"
- Open WhatsApp
- Send: `hi` or `Hi` or `HI`

### Expected Response:
```
👋 Welcome to Service Hub!

How can I help you today?

Buttons:
🔧 Request Service
📊 Check Status
```

### Step 2: Click "Request Service"

Expected:
1. List of your containers from dashboard
2. Container ID reference image
3. Message: "If you don't know where the container ID is located..."

### Step 3: Select Container
- Choose one or more containers from the list

### Step 4: Enter Error Code
- Type error code (e.g., `E001`)
- OR type `NA` to get auto video link

### Step 5: Describe Issue
- Type brief description (2-3 sentences)

### Step 6: Upload Photos
- Send photos of the issue
- Type `DONE` when finished
- ⚠️ Mandatory - cannot skip

### Step 7: Upload Video
- Send video showing the issue
- Type `DONE` when finished

### Step 8: Confirmation
Expected:
```
✅ Your service request has been raised!

📋 Request Number(s): SR-xxxxx
📸 Photos: X
🎥 Videos: X

A technician will contact you soon.
```

### Step 9: Verify Dashboard
1. Open Dashboard → Service Requests
2. Find your request by number
3. Check all details are correct

## 🔧 Test Technician Flow

### Step 1: Send "hi"
- Open WhatsApp (from technician number)
- Send: `hi`

### Expected Response:
Technician menu with schedule/service options

## 🔍 Check Logs

Watch for these messages in console:

### Client Detection:
```
[WhatsApp] Processing message from 918218994855
[WhatsApp] Found existing user: Name (id), role: client
[WhatsApp] 🔍 Verifying user role from dashboard data...
[WhatsApp] ✅ User identified as CLIENT from dashboard
[WhatsApp] ✅ Greeting detected, user role: client
[WhatsApp] 🎯 Routing to CLIENT flow...
[WhatsApp] 📱 Starting CLIENT MODE
[WhatsApp] ✅ Client menu sent successfully
```

### Technician Detection:
```
[WhatsApp] Processing message from 917021307474
[WhatsApp] Found existing user: Name (id), role: technician
[WhatsApp] 🔍 Verifying user role from dashboard data...
[WhatsApp] ✅ User identified as TECHNICIAN from dashboard
[WhatsApp] ✅ Greeting detected, user role: technician
[WhatsApp] 🎯 Routing to TECHNICIAN flow...
[WhatsApp] 🔧 Starting TECHNICIAN MODE
[WhatsApp] ✅ Technician menu sent successfully
```

## ❌ Troubleshooting

### Bot not responding?
1. Check server is running
2. Check WhatsApp webhook is configured
3. Check `.env` has correct credentials

### Wrong flow triggered?
1. Check user has correct record in dashboard:
   - Clients: Dashboard → Customers
   - Technicians: Dashboard → Technicians
2. Check phone number matches
3. Check logs for role detection

### Service request not in dashboard?
1. Check logs for "Service request created"
2. Refresh dashboard page
3. Check customer ID is valid

### "Customer profile not found"?
1. User needs customer record in dashboard
2. Phone number must match
3. Try variations: with/without country code

## 📊 Dashboard Checks

### For Clients:
1. Dashboard → Customers → Find your company
2. Check phone number matches WhatsApp
3. Check containers are assigned

### For Technicians:
1. Dashboard → Technicians → Find your name
2. Check phone number matches WhatsApp
3. Check schedule assignments

## ✅ Success Criteria

- [ ] Client sends "hi" → Gets client menu
- [ ] Technician sends "hi" → Gets technician menu
- [ ] Client completes service request → Appears in dashboard
- [ ] Logs show correct role detection
- [ ] Logs show correct flow routing
- [ ] No errors in console
- [ ] All photos/videos uploaded successfully
- [ ] Request number is generated
- [ ] Dashboard shows all request details

## 🎯 Key Log Indicators

| Emoji | Meaning |
|-------|---------|
| 🔍 | Checking dashboard data |
| ✅ | Success / Confirmed |
| 🔄 | Updating/Correcting |
| 🎯 | Routing decision |
| 📱 | Client mode active |
| 🔧 | Technician mode active |
| ❌ | Error occurred |
| ⚠️ | Warning/Fallback |

---

**Quick Commands:**
- Start server: `npm run dev`
- Stop server: `Ctrl+C`
- View logs: Check console output
- Check dashboard: `http://localhost:5000`

**Need Help?**
Check `ROLE_DETECTION_FIX.md` for detailed documentation.
