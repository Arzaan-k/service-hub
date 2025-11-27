# WhatsApp Notification Debugging Guide

## Issue
WhatsApp notifications are not being sent to customers when:
- Technician is assigned to a service request
- Service is started
- Service is completed

## Changes Made for Debugging

### Enhanced Logging Added

**File: `server/routes.ts`**
- Added logs before and after calling `customerCommunicationService.notifyServiceRequestUpdate()`
- Logs will show:
  - When notification attempt starts
  - If import was successful
  - When notification call completes
  - Any errors with stack traces

**File: `server/services/whatsapp.ts`**
- Added detailed logging throughout the notification flow:
  - Service request ID and update type
  - Service request details (request number, customer ID)
  - Customer details (company name, whatsapp number, phone)
  - Phone number being used for notification
  - Message content preview
  - Success/failure of message sending

## How to Debug

### Step 1: Check Server Logs
After assigning a technician, starting, or completing a service, check your server console for these log patterns:

#### Expected Log Flow (Success):
```
[Routes] Attempting to send WhatsApp notification for service request <ID>
[Routes] customerCommunicationService imported successfully
[WhatsApp] Starting notification for service request <ID>, type: assigned
[WhatsApp] Service request found: SR-XXXXX, customerId: <customer-id>
[WhatsApp] Customer found: <Company Name>, whatsappNumber: <number>, phone: <number>
[WhatsApp] Will send notification to: <phone-number>
[WhatsApp] Sending message to <phone-number>: 🔔 *Service Request Update*...
📤 Attempting to send WhatsApp message to: <phone> Text: 🔔 *Service Request Update*...
✅ WhatsApp text send success: {...}
[WhatsApp] Message sent successfully
✅ WhatsApp notification sent for service request <ID> (assigned)
[Routes] WhatsApp notification call completed
```

#### Common Issues to Look For:

**Issue 1: Customer Not Found**
```
[WhatsApp] Customer not found for service request <ID>, skipping notification
```
**Solution**: Check if the service request has a valid `customerId`

**Issue 2: No WhatsApp Number**
```
[WhatsApp] Customer <ID> has no WhatsApp number, skipping notification
```
**Solution**: Ensure the customer has either `whatsappNumber` or `phone` field populated

**Issue 3: WhatsApp API Error**
```
❌ WhatsApp text send error: {...}
[Routes] Failed to send WhatsApp notification: Error...
```
**Solution**: Check WhatsApp API credentials and phone number format

### Step 2: Verify Customer Data

Run this query to check if customer has WhatsApp number:
```sql
SELECT id, companyName, phone, whatsappNumber, userId 
FROM customers 
WHERE id = '<customer-id-from-service-request>';
```

### Step 3: Verify Service Request Data

Check if service request has proper customer linkage:
```sql
SELECT id, requestNumber, customerId, assignedTechnicianId, status 
FROM service_requests 
WHERE id = '<service-request-id>';
```

### Step 4: Check WhatsApp Configuration

Verify these environment variables are set in `.env`:
```
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
```

## Testing Steps

1. **Create a Service Request** via WhatsApp (as shown in Image 2)
   - This ensures the customer has a WhatsApp number registered
   - The service request will be linked to the customer

2. **Assign a Technician** from the dashboard
   - Watch the server logs for the notification flow
   - Check if customer receives "Technician Assigned" message (Image 5)

3. **Start the Service** (via dashboard or WhatsApp)
   - Watch for "Service Started" notification (Image 4)

4. **Complete the Service** (via dashboard or WhatsApp)
   - Watch for "Service Completed" notification (Image 3)

## Expected Message Formats

### Technician Assigned (Image 5)
```
🔔 Service Request Update

✅ Technician Assigned

📋 Request Number: SR-XXXXX
📦 Container: CGMUZ991560
👷 Technician: Shruti

Your service request has been assigned to a technician. You'll receive updates as the service progresses.
```

### Service Started (Image 4)
```
🔔 Service Request Update

🚀 Service Started

📋 Request Number: SR-XXXXX
📦 Container: TRIU6617292
👷 Technician: Shahabuddin
⏰ Started: 18/11/2025, 12:50:19 pm

The technician has started working on your service request.
```

### Service Completed (Image 3)
```
✅ Service Completed!

📋 Request Number: SR-XXXXX
📦 Container: TRIU6617292
👷 Technician: Shahabuddin
⏰ Completed: 18/11/2025, 12:50:43 pm
⏱️ Duration: 0 minutes

📝 Notes: done

Thank you for using our service!
```

## Common Solutions

### Solution 1: Customer Missing WhatsApp Number
If customer was created manually (not via WhatsApp), add their WhatsApp number:
```sql
UPDATE customers 
SET whatsappNumber = '919876543210'  -- Use format: country_code + number (no + or spaces)
WHERE id = '<customer-id>';
```

### Solution 2: Phone Number Format
Ensure phone numbers are in format: `919876543210` (no +, no spaces, no hyphens)

### Solution 3: WhatsApp API Not Configured
Check if `.env` has proper WhatsApp credentials and restart the server

### Solution 4: Import Error
If you see "Failed to import customerCommunicationService", check:
- `server/services/whatsapp.ts` has no syntax errors
- The export is correct: `export const customerCommunicationService = new CustomerCommunicationService();`

## Next Steps

1. **Run the application** and try assigning a technician
2. **Copy all server logs** related to WhatsApp notification
3. **Share the logs** to identify the exact issue
4. **Check customer data** in the database to verify WhatsApp number exists

## Files Modified for Debugging

1. `server/routes.ts` - Lines 1368-1378, 1395-1403, 1427-1435
2. `server/services/whatsapp.ts` - Lines 4255-4277, 4406-4438
