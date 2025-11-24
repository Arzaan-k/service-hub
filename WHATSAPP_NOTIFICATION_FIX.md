# WhatsApp Notification Routing Fix

## Problem
WhatsApp notifications for technician assignment, service start, and service completion were failing with error:
```
(#131030) Recipient phone number not in allowed list
```

This happened because the system was trying to send notifications to the customer's stored phone number in the database (`customer.whatsappNumber` or `customer.phone`), which was different from the WhatsApp number that originally created the service request.

## Root Cause
When a service request is created via WhatsApp:
1. Customer A (e.g., `918218994855`) creates the request via WhatsApp ✅
2. System stores the request under Customer B (e.g., `Aspiro Pharma Ltd` with phone `+000519080073`)
3. When notifications are sent, system tries to send to Customer B's stored number (`+000519080073`) ❌
4. But only Customer A's number (`918218994855`) is in the WhatsApp allowed list
5. Result: Notification fails with "Recipient phone number not in allowed list"

## Solution
Modified the notification system to **always send to the WhatsApp number that created the service request**, not the customer's stored phone number.

### Changes Made

**File: `server/services/whatsapp.ts`**
**Function: `notifyServiceRequestUpdate()`**

#### Before:
```typescript
// Get customer's stored WhatsApp number
const customer = await this.storage.getCustomer(serviceRequest.customerId);
const whatsappNumber = customer.whatsappNumber || customer.phone;
```

#### After:
```typescript
// Get the WhatsApp number from the original service request conversation
const whatsappMessages = await this.storage.getWhatsAppMessagesByServiceRequest(serviceRequestId);

// Find the first customer message (incoming message that created the request)
const customerMessage = whatsappMessages.find((msg: any) => 
  msg.recipientType === 'customer' || msg.phoneNumber
);

const whatsappNumber = customerMessage.phoneNumber;
```

## How It Works

1. **Service Request Creation** (via WhatsApp)
   - Customer sends message from `918218994855`
   - System creates service request and stores WhatsApp messages
   - Each message includes the `phoneNumber` field

2. **Technician Assignment** (from Dashboard)
   - Admin assigns technician
   - System looks up WhatsApp messages for this service request
   - Finds the original customer's phone number (`918218994855`)
   - Sends "Technician Assigned" notification to that number ✅

3. **Service Started**
   - Technician starts service
   - System uses same WhatsApp number from original request
   - Sends "Service Started" notification ✅

4. **Service Completed**
   - Technician completes service
   - System uses same WhatsApp number from original request
   - Sends "Service Completed" notification ✅

## Benefits

1. **No More "Not in Allowed List" Errors**: Always sends to the number that's already in conversation
2. **Correct Recipient**: Notifications go to the person who actually requested the service
3. **No Configuration Needed**: Works automatically without adding numbers to allowed list
4. **Maintains Conversation Thread**: All messages for a service request go to the same WhatsApp number

## Message Formats (Unchanged)

### Technician Assigned
```
🔔 Service Request Update

✅ Technician Assigned

📋 Request Number: SR-XXXXX
📦 Container: CGMU2991560
👷 Technician: Shruti

Your service request has been assigned to a technician. You'll receive updates as the service progresses.
```

### Service Started
```
🔔 Service Request Update

🚀 Service Started

📋 Request Number: SR-XXXXX
📦 Container: CGMU2991560
👷 Technician: Shruti
⏰ Started: 24/11/2025, 10:27:42 am

The technician has started working on your service request.
```

### Service Completed
```
✅ Service Completed!

📋 Request Number: SR-XXXXX
📦 Container: CGMU2991560
👷 Technician: Shruti
⏰ Completed: 24/11/2025, 10:28:34 am
⏱️ Duration: 1 minutes

📝 Notes: completed

Thank you for using our service!
```

## Testing

### Test Scenario 1: Service Request via WhatsApp
1. Customer sends service request from WhatsApp number `918218994855`
2. Service request is created and linked to customer
3. Admin assigns technician from dashboard
4. **Expected**: Customer receives "Technician Assigned" message on `918218994855` ✅

### Test Scenario 2: Service Lifecycle
1. Service request created via WhatsApp from `918218994855`
2. Technician assigned → notification sent to `918218994855` ✅
3. Technician starts service → notification sent to `918218994855` ✅
4. Technician completes service → notification sent to `918218994855` ✅

### Test Scenario 3: Multiple Service Requests
1. Customer A creates request from `918218994855`
2. Customer B creates request from `919876543210`
3. Both get assigned to same technician
4. **Expected**: 
   - Customer A gets notifications on `918218994855` ✅
   - Customer B gets notifications on `919876543210` ✅

## Logging

Enhanced logging helps track the notification flow:

```
[WhatsApp] Starting notification for service request <ID>, type: assigned
[WhatsApp] Service request found: SR-XXXXX, customerId: <customer-id>
[WhatsApp] Found 13 WhatsApp messages for this service request
[WhatsApp] Will send notification to original requester: 918218994855
[WhatsApp] Sending message to 918218994855: 🔔 *Service Request Update*...
📤 Attempting to send WhatsApp message to: 918218994855 Text: 🔔 *Service Request Update*...
✅ WhatsApp text send success: {...}
[WhatsApp] Message sent successfully
✅ WhatsApp notification sent for service request <ID> (assigned)
```

## Important Notes

1. **No Changes to Other Flows**: All other functionality remains unchanged
2. **Backward Compatible**: Works with existing service requests that have WhatsApp messages
3. **Fallback Handling**: If no WhatsApp messages found, notification is skipped (logs the reason)
4. **Database Logging**: All sent messages are still logged to `whatsapp_messages` table

## Files Modified

- `server/services/whatsapp.ts` (Lines 4264-4283, 4417-4441)

## Summary

The fix ensures that all WhatsApp notifications (technician assigned, service started, service completed) are sent to the **same WhatsApp number that created the service request**, rather than the customer's stored phone number. This eliminates the "Recipient phone number not in allowed list" error and ensures notifications reach the correct person who actually requested the service.
