# Technician Assignment & Schedule Flow - Complete Fix

## Overview
Fixed the complete end-to-end flow for technician service assignment, schedule display, service completion tracking, and WhatsApp customer notifications across Dashboard, Technician Profile, and WhatsApp.

## Issues Fixed

### 1. **Technician Assignment Flow** ✅
**Problem**: When assigning a technician from the Service Request dashboard, the assigned service wasn't immediately appearing in the technician's profile under "Assigned Services".

**Root Cause**: 
- Missing WebSocket event listeners for real-time updates
- No query invalidation when service requests were assigned

**Solution**:
- Added WebSocket listeners in `dashboard.tsx` for `service_request_assigned`, `service_request_started`, and `service_request_completed` events
- Added WebSocket listeners in `technician-profile.tsx` to invalidate queries when services are assigned/started/completed
- Ensured proper query invalidation for `/api/service-requests`, `/api/technicians/schedules`, and technician-specific queries

### 2. **Service Completion → Service History** ✅
**Problem**: When a technician completes a service, it wasn't automatically moving from "Assigned Services" to "Service History".

**Root Cause**:
- WhatsApp service completion flow wasn't broadcasting WebSocket events
- Missing real-time update mechanism for service status changes

**Solution**:
- Added broadcast events in `whatsapp-technician-flows.ts` when services are started and completed via WhatsApp
- Used `(global as any).broadcast()` to emit `service_request_started` and `service_request_completed` events
- WebSocket listeners automatically refresh the technician profile data when these events occur

### 3. **Technician Schedule Dashboard** ✅
**Problem**: The Technician Schedule section wasn't showing assigned jobs for technicians.

**Root Cause**:
- Bug in `getTechnicianSchedule()` function in `storage.ts` - the date filtering logic was applying `where()` clause twice, causing query conflicts

**Solution**:
- Refactored `getTechnicianSchedule()` to build conditions array first, then apply them once with `and(...conditions)`
- Fixed date filtering to properly filter by scheduled date when provided
- Added WebSocket event listeners to invalidate schedule queries on assignment/completion

### 4. **WhatsApp View Schedule** ✅
**Problem**: When technicians clicked "View Schedule" on WhatsApp, they weren't seeing their assigned jobs for the day.

**Root Cause**:
- Same bug in `getTechnicianSchedule()` function affecting WhatsApp schedule display

**Solution**:
- Fixed `getTechnicianSchedule()` function (same fix as #3)
- WhatsApp handlers in `whatsapp.ts` and `whatsapp-technician-flows.ts` now correctly fetch and display schedules

### 5. **WhatsApp Customer Notifications** ✅
**Problem**: After recent changes, WhatsApp messages were not being sent to customers when:
- Technician is assigned to a service request
- Technician starts working on a service
- Technician completes a service

**Root Cause**:
- WhatsApp technician flows were using local notification functions instead of the centralized `customerCommunicationService`
- Message format didn't match the original working implementation
- **Critical Issue**: System was sending notifications to customer's stored phone number instead of the WhatsApp number that created the request, causing "Recipient phone number not in allowed list" error

**Solution**:
- Updated `whatsapp-technician-flows.ts` to use `customerCommunicationService.notifyServiceRequestUpdate()` for all customer notifications
- Updated message format in `whatsapp.ts` to match exact format from original working flow:
  - **Assigned**: Shows "Service Request Update" with "Technician Assigned" header
  - **Started**: Shows "Service Request Update" with "Service Started" header and exact timestamp (DD/MM/YYYY, HH:MM:SS AM/PM)
  - **Completed**: Shows "Service Completed!" with completion timestamp, duration, and notes
- All timestamps now use Indian locale format (en-IN) with 12-hour format
- **Fixed Notification Routing**: System now sends notifications to the WhatsApp number that originally created the service request (retrieved from `whatsappMessages` table) instead of customer's stored phone number

## Files Modified

### 1. `server/storage.ts`
**Function**: `getTechnicianSchedule()`
- **Lines**: 1168-1226
- **Changes**: 
  - Refactored to build conditions array before applying `where()` clause
  - Fixed date filtering logic to avoid double `where()` application
  - Ensured proper ordering by `scheduledDate`

```typescript
async getTechnicianSchedule(technicianId: string, date?: string): Promise<any[]> {
  // Build the where conditions
  const conditions = [eq(serviceRequests.assignedTechnicianId, technicianId)];
  
  // Add date filter if provided
  if (date) {
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    conditions.push(
      sql`${serviceRequests.scheduledDate} >= ${startOfDay}`,
      sql`${serviceRequests.scheduledDate} <= ${endOfDay}`
    );
  }

  const results = await db
    .select({ /* ... fields ... */ })
    .from(serviceRequests)
    .leftJoin(containers, eq(serviceRequests.containerId, containers.id))
    .leftJoin(customers, eq(serviceRequests.customerId, customers.id))
    .where(and(...conditions))
    .orderBy(serviceRequests.scheduledDate);

  return results;
}
```

### 2. `client/src/pages/dashboard.tsx`
**Lines**: 77-153
- **Changes**:
  - Added WebSocket event listeners for service request lifecycle events
  - Proper cleanup of event listeners in useEffect return
  - Invalidates `/api/service-requests` and `/api/technicians/schedules` queries

```typescript
const onServiceRequestAssigned = () => {
  queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
  queryClient.invalidateQueries({ queryKey: ["/api/technicians/schedules"] });
};

const onServiceRequestStarted = () => {
  queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
  queryClient.invalidateQueries({ queryKey: ["/api/technicians/schedules"] });
};

const onServiceRequestCompleted = () => {
  queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
  queryClient.invalidateQueries({ queryKey: ["/api/technicians/schedules"] });
  queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
};

websocket.on("service_request_assigned", onServiceRequestAssigned);
websocket.on("service_request_started", onServiceRequestStarted);
websocket.on("service_request_completed", onServiceRequestCompleted);
```

### 3. `client/src/pages/technician-profile.tsx`
**Lines**: 16, 102-129
- **Changes**:
  - Added WebSocket import
  - Added WebSocket event listeners for real-time updates
  - Invalidates technician-specific queries when services are assigned/started/completed

```typescript
import { websocket } from "@/lib/websocket";

// WebSocket listeners for real-time updates
useEffect(() => {
  const onServiceRequestAssigned = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/service-requests/technician", technicianId] });
    queryClient.invalidateQueries({ queryKey: ["/api/technicians", technicianId, "schedule"] });
  };

  const onServiceRequestStarted = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/service-requests/technician", technicianId] });
    queryClient.invalidateQueries({ queryKey: ["/api/technicians", technicianId, "schedule"] });
  };

  const onServiceRequestCompleted = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/service-requests/technician", technicianId] });
    queryClient.invalidateQueries({ queryKey: ["/api/technicians", technicianId, "schedule"] });
    queryClient.invalidateQueries({ queryKey: ["/api/technicians", technicianId, "performance"] });
  };

  websocket.on("service_request_assigned", onServiceRequestAssigned);
  websocket.on("service_request_started", onServiceRequestStarted);
  websocket.on("service_request_completed", onServiceRequestCompleted);

  return () => {
    websocket.off("service_request_assigned", onServiceRequestAssigned);
    websocket.off("service_request_started", onServiceRequestStarted);
    websocket.off("service_request_completed", onServiceRequestCompleted);
  };
}, [queryClient, technicianId]);
```

### 4. `server/services/whatsapp-technician-flows.ts`
**Lines**: 341-352, 363-369, 645-662, 721-727
- **Changes**:
  - Added WebSocket broadcast when service is started via WhatsApp
  - Added WebSocket broadcast when service is completed via WhatsApp
  - Replaced local notification functions with `customerCommunicationService.notifyServiceRequestUpdate()`
  - Ensures real-time updates across all connected clients and proper customer notifications

```typescript
// In startServiceRequest()
const updatedService = await storage.updateServiceRequest(serviceId, {
  status: 'in_progress',
  startTime: startTime,
  actualStartTime: startTime
});

// Broadcast the update
if ((global as any).broadcast) {
  (global as any).broadcast({ type: 'service_request_started', data: updatedService });
}

// Notify customer via WhatsApp
try {
  const { customerCommunicationService } = await import('./whatsapp');
  await customerCommunicationService.notifyServiceRequestUpdate(serviceId, 'started');
} catch (notifError) {
  console.error('[WhatsApp] Failed to send customer notification:', notifError);
}

// In completeServiceRequest()
const updatedService = await storage.updateServiceRequest(serviceId, {
  status: 'completed',
  endTime: endTime,
  actualEndTime: endTime,
  durationMinutes: durationMinutes,
  serviceDuration: durationMinutes,
  beforePhotos: beforePhotos,
  afterPhotos: afterPhotos,
  signedDocumentUrl: signatureMediaId ? `whatsapp://media/${signatureMediaId}` : null,
  vendorInvoiceUrl: invoiceMediaId ? `whatsapp://media/${invoiceMediaId}` : null
});

// Broadcast the completion event
if ((global as any).broadcast) {
  (global as any).broadcast({ type: 'service_request_completed', data: updatedService });
}

// Notify customer via WhatsApp
try {
  const { customerCommunicationService } = await import('./whatsapp');
  await customerCommunicationService.notifyServiceRequestUpdate(serviceId, 'completed');
} catch (notifError) {
  console.error('[WhatsApp] Failed to send customer notification:', notifError);
}
```

### 5. `server/services/whatsapp.ts`
**Function**: `notifyServiceRequestUpdate()`
**Lines**: 4264-4283, 4287-4363, 4417-4441
- **Changes**:
  - **Fixed notification routing**: Now retrieves WhatsApp number from original service request messages instead of customer's stored phone
  - Queries `whatsappMessages` table to find the phone number that created the service request
  - Updated message format for 'assigned' event to match original working flow
  - Updated message format for 'started' event with proper Indian locale timestamp (DD/MM/YYYY, HH:MM:SS AM/PM)
  - Updated message format for 'completed' event with proper timestamp and duration display
  - All timestamps now use `toLocaleString('en-IN')` with 12-hour format
  - Enhanced logging to track which WhatsApp number is being used

**Notification Routing Fix:**
```typescript
// Get the WhatsApp number from the original service request conversation
const whatsappMessages = await this.storage.getWhatsAppMessagesByServiceRequest(serviceRequestId);
console.log(`[WhatsApp] Found ${whatsappMessages.length} WhatsApp messages for this service request`);

// Find the first customer message (incoming message that created the request)
const customerMessage = whatsappMessages.find((msg: any) => 
  msg.recipientType === 'customer' || msg.phoneNumber
);

if (!customerMessage || !customerMessage.phoneNumber) {
  console.log(`[WhatsApp] No customer WhatsApp number found in service request messages, skipping notification`);
  return;
}

const whatsappNumber = customerMessage.phoneNumber;
console.log(`[WhatsApp] Will send notification to original requester: ${whatsappNumber}`);
```

**Message Formats:**
```typescript
case 'assigned':
  message = `🔔 *Service Request Update*\n\n` +
    `✅ *Technician Assigned*\n\n` +
    `📋 Request Number: ${serviceRequest.requestNumber}\n` +
    `📦 Container: ${container?.containerCode || 'Unknown'}\n` +
    `👷 Technician: ${technicianName}\n` +
    `\nYour service request has been assigned to a technician. You'll receive updates as the service progresses.`;
  break;

case 'started':
  const startedTime = serviceRequest.actualStartTime 
    ? new Date(serviceRequest.actualStartTime).toLocaleString('en-IN', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: true 
      })
    : new Date().toLocaleString('en-IN', { /* ... */ });
  message = `🔔 *Service Request Update*\n\n` +
    `🚀 *Service Started*\n\n` +
    `📋 Request Number: ${serviceRequest.requestNumber}\n` +
    `📦 Container: ${container?.containerCode || 'Unknown'}\n` +
    `👷 Technician: ${technicianName}\n` +
    `⏰ Started: ${startedTime}\n` +
    `\nThe technician has started working on your service request.`;
  break;

case 'completed':
  const durationMinutes = serviceRequest.durationMinutes || serviceRequest.serviceDuration 
    || (serviceRequest.actualStartTime && serviceRequest.actualEndTime
    ? Math.round((new Date(serviceRequest.actualEndTime).getTime() - new Date(serviceRequest.actualStartTime).getTime()) / 60000)
    : 0);
  const duration = `${durationMinutes} minutes`;
  
  const completedTime = serviceRequest.actualEndTime 
    ? new Date(serviceRequest.actualEndTime).toLocaleString('en-IN', { /* ... */ })
    : new Date().toLocaleString('en-IN', { /* ... */ });
  
  message = `✅ *Service Completed!*\n\n` +
    `📋 Request Number: ${serviceRequest.requestNumber}\n` +
    `📦 Container: ${container?.containerCode || 'Unknown'}\n` +
    `👷 Technician: ${technicianName}\n` +
    `⏰ Completed: ${completedTime}\n` +
    `⏱️ Duration: ${duration}\n` +
    (serviceRequest.resolutionNotes 
      ? `\n📝 Notes: ${serviceRequest.resolutionNotes}\n`
      : '') +
    `\nThank you for using our service!`;
  break;
```

## Flow Verification

### ✅ Assignment Flow
1. Admin assigns technician from Service Request dashboard (Image 3, 4)
2. Backend broadcasts `service_request_assigned` event
3. Dashboard and Technician Profile listen to WebSocket event
4. Queries are invalidated and data is refetched
5. Service appears in Technician Profile "Assigned Services" (Image 1, 2)
6. Service appears in Technician Schedule dashboard (Image 5)
7. **Customer receives WhatsApp notification** with "Technician Assigned" message (Image 3)

### ✅ Service Start Flow
1. Technician clicks "Start Service" (via WhatsApp or dashboard)
2. Backend broadcasts `service_request_started` event
3. Service status changes to "in_progress"
4. Queries are invalidated and data is refetched
5. **Customer receives WhatsApp notification** with "Service Started" message and exact timestamp (Image 2)

### ✅ Completion Flow
1. Technician completes service (via WhatsApp or dashboard)
2. Backend broadcasts `service_request_completed` event
3. Service status changes to "completed"
4. Queries are invalidated and data is refetched
5. Service moves from "Assigned Services" to "Service History" (Image 2)
6. Technician Schedule dashboard updates to show completion
7. **Customer receives WhatsApp notification** with "Service Completed!" message, timestamp, duration, and notes (Image 1)

### ✅ WhatsApp Schedule Flow
1. Technician clicks "View Schedule" on WhatsApp
2. WhatsApp handler calls `getTechnicianSchedule()` with today's date
3. Fixed function properly filters services by date
4. Technician sees their scheduled jobs for the day
5. Can view Today, Previous, or Future schedules

## Testing Checklist

- [x] Assign service from dashboard → appears in technician profile immediately
- [x] Assign service from dashboard → appears in Technician Schedule dashboard
- [x] **Assign service → customer receives WhatsApp "Technician Assigned" notification**
- [x] **Start service → customer receives WhatsApp "Service Started" notification with timestamp**
- [x] Complete service → moves to Service History in technician profile
- [x] **Complete service → customer receives WhatsApp "Service Completed" notification with timestamp and duration**
- [x] Complete service via WhatsApp → updates dashboard and profile in real-time
- [x] WhatsApp "View Schedule" → shows today's jobs
- [x] WhatsApp "View Schedule" → shows previous completed jobs
- [x] WhatsApp "View Schedule" → shows future scheduled jobs
- [x] Multiple technicians → each sees only their own services
- [x] Real-time updates → all connected clients see changes immediately
- [x] WhatsApp notifications → sent from both dashboard and WhatsApp technician actions

## Key Improvements

1. **Real-time Updates**: All changes now propagate instantly via WebSocket
2. **Data Consistency**: Fixed query logic ensures accurate data retrieval
3. **Multi-channel Support**: Works seamlessly across Dashboard, Profile, and WhatsApp
4. **No Manual Refresh**: Auto-invalidation eliminates need for page refresh
5. **Proper Separation**: Assigned vs Completed services properly categorized
6. **Customer Notifications**: WhatsApp messages sent automatically for all service lifecycle events
7. **Consistent Formatting**: All notifications use standardized format matching original working flow
8. **Proper Timestamps**: Indian locale timestamps with 12-hour format for better readability

## Notes

- The existing refetch interval (30s for technician profile) provides a fallback if WebSocket events are missed
- All WebSocket listeners are properly cleaned up to prevent memory leaks
- The `getTechnicianSchedule` function now works correctly for both date-filtered and unfiltered queries
- Broadcast events use the global broadcast function to ensure all connected clients receive updates
- WhatsApp notifications are sent via `customerCommunicationService` which handles message formatting, logging, and error handling
- Customer WhatsApp notifications work from both dashboard actions (admin assigns/starts/completes) and WhatsApp technician actions
- All notification failures are logged but don't break the main flow
- Messages are stored in the database for audit trail via `createWhatsappMessage()`
- **Critical Fix**: Notifications are now sent to the WhatsApp number that created the service request (from `whatsappMessages` table), not the customer's stored phone number. This ensures messages reach the correct person and avoids "Recipient phone number not in allowed list" errors
