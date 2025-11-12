# Technician WhatsApp Flow - Complete Implementation Guide

## Overview
This document outlines the complete technician WhatsApp flow implementation with dashboard integration, including schedule management, service tracking, photo uploads, and real-time synchronization.

## Implementation Status

### ✅ Already Implemented
- Basic technician authentication
- Text message handling with AI intent classification
- Service list presentation
- Basic service start/end flow
- Photo upload handling (partial)

### 🔨 To Be Implemented
1. **Enhanced Schedule View with Date Navigation**
   - Previous dates (completed services)
   - Today (active + scheduled services)
   - Future dates (scheduled services)
   - Interactive date picker

2. **Multi-Service Tracking System**
   - Track multiple concurrent services
   - Show running timers for each service
   - Dynamic "End Service 1, 2, 3..." buttons

3. **Complete Upload Flow**
   - Before photos
   - After photos
   - Client signature (mandatory)
   - Vendor invoice (optional)
   - Sequential upload prompts

4. **Dashboard Integration**
   - Assigned Services section in technician profile
   - Completed Services section
   - Clickable SR numbers linking to detail pages
   - Photo gallery display with thumbnails
   - Document viewer for signatures/invoices

5. **Service Detail Page Enhancement**
   - Timeline view (scheduled → started → completed)
   - Duration calculation and display
   - Photo galleries with lightbox
   - Document preview
   - Back navigation

## Database Schema Requirements

### Service Requests Table Updates
```sql
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS start_time TIMESTAMP;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS end_time TIMESTAMP;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS before_photos JSONB DEFAULT '[]';
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS after_photos JSONB DEFAULT '[]';
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS signed_document_url TEXT;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS vendor_invoice_url TEXT;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS technician_notes TEXT;
```

### WhatsApp Sessions Table Updates
```sql
-- Conversation state will store:
{
  "activeServices": [
    {
      "serviceId": "SR-123",
      "startTime": "2025-11-10T10:00:00Z",
      "status": "in_progress"
    }
  ],
  "currentServiceId": "SR-123",
  "step": "awaiting_after_photos",
  "uploadedBeforePhotos": ["media_id_1", "media_id_2"],
  "uploadedAfterPhotos": [],
  "awaitingSignature": true
}
```

## Key Functions to Implement

### 1. Schedule Management

#### `handleTechnicianScheduleView(from, technician, storage)`
Shows date selection buttons:
- ⏮️ Previous Dates
- 📍 Today
- ⏭️ Future Dates

#### `showScheduleForDate(from, technician, date, storage)`
Displays services for selected date with appropriate actions:
- **Previous dates**: Completed services, "View Details" only
- **Today**: All services with "Start Service" / "View Details"
- **Future**: Scheduled services, "View Details" only

### 2. Service Tracking

#### `startServiceWithTimer(from, user, serviceId, session, storage)`
```typescript
- Update service status to 'in_progress'
- Record start_time in database
- Add to activeServices in conversation state
- Send confirmation to technician
- Send notification to customer
- Return to menu with active service indicator
```

#### `getActiveServices(session)`
```typescript
- Returns array of currently running services
- Calculates elapsed time for each
- Formats display with running timers
```

#### `showActiveServicesMenu(from, user, session, storage)`
```typescript
- Shows all active services with timers
- Displays "End Service 1", "End Service 2", etc.
- Shows "View Schedule" button
```

### 3. Service Completion Flow

#### `initiateServiceCompletion(from, user, serviceId, session, storage)`
```typescript
Step 1: Calculate duration
Step 2: Request before photos (if not uploaded)
Step 3: Request after photos (mandatory)
Step 4: Request client signature (mandatory)
Step 5: Ask about vendor invoice
Step 6: Complete service and notify customer
```

#### `handlePhotoUpload(from, user, mediaId, session, storage)`
```typescript
- Determine upload type from conversation state
- Store media ID in appropriate array
- Download and save photo to storage
- Update database with photo URL
- Prompt for next upload or continue flow
```

#### `handleSignatureUpload(from, user, mediaId, session, storage)`
```typescript
- Validate document upload
- Save signature document
- Update service request
- Move to invoice prompt
```

#### `completeServiceRequest(from, user, serviceId, session, storage)`
```typescript
- Calculate total duration
- Update service status to 'completed'
- Record end_time
- Remove from activeServices
- Send summary to technician
- Send completion notification to customer
- Request customer feedback
```

### 4. Customer Notifications

#### `notifyCustomerServiceStarted(customerId, serviceId, technicianName)`
```typescript
🔔 Service Update

Your service has been started!

🔧 Service Request: SR-[ID]
👷 Technician: [Name]
📦 Container: [Container ID]
⏰ Started: [Timestamp]

We'll notify you when the service is completed.
```

#### `notifyCustomerServiceCompleted(customerId, serviceId, duration, technicianName)`
```typescript
✅ Service Completed!

Your service has been completed successfully.

🔧 Service Request: SR-[ID]
👷 Technician: [Name]
📦 Container: [Container ID]
⏰ Completed: [Timestamp]
⏱️ Duration: [Duration]

📋 Please provide your feedback:
[Feedback buttons or link]

Thank you for choosing Service Hub!
```

## Dashboard Components to Update

### 1. Technician Profile Page

#### Add Assigned Services Section
```typescript
<Card>
  <CardHeader>
    <CardTitle>Assigned Services</CardTitle>
  </CardHeader>
  <CardContent>
    {assignedServices.length === 0 ? (
      <p>No assigned services.</p>
    ) : (
      <div className="space-y-2">
        {assignedServices.map(service => (
          <Link 
            key={service.id} 
            to={`/service-requests/${service.id}`}
            className="block p-3 border rounded hover:bg-accent"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">🔧 {service.requestNumber}</p>
                <p className="text-sm text-muted-foreground">
                  Status: {service.status}
                </p>
                <p className="text-sm">Container: {service.container?.containerCode}</p>
                {service.startTime && (
                  <p className="text-sm text-green-600">
                    Started: {formatDateTime(service.startTime)}
                  </p>
                )}
              </div>
              <Badge variant={service.status === 'in_progress' ? 'default' : 'secondary'}>
                {service.priority}
              </Badge>
            </div>
          </Link>
        ))}
      </div>
    )}
  </CardContent>
</Card>
```

#### Add Completed Services Section
```typescript
<Card>
  <CardHeader>
    <CardTitle>Completed Services</CardTitle>
  </CardHeader>
  <CardContent>
    {completedServices.length === 0 ? (
      <p>No completed services yet.</p>
    ) : (
      <div className="space-y-2">
        {completedServices.map(service => (
          <Link 
            key={service.id} 
            to={`/service-requests/${service.id}`}
            className="block p-3 border rounded hover:bg-accent"
          >
            <div>
              <p className="font-semibold">🔧 {service.requestNumber}</p>
              <p className="text-sm text-muted-foreground">
                Completed: {formatDateTime(service.endTime)}
              </p>
              <p className="text-sm">
                Duration: {formatDuration(service.durationMinutes)}
              </p>
              <p className="text-sm">Container: {service.container?.containerCode}</p>
            </div>
          </Link>
        ))}
      </div>
    )}
  </CardContent>
</Card>
```

### 2. Service Request Detail Page

#### Add Photo Galleries
```typescript
<div className="grid grid-cols-3 gap-6">
  {/* Before Photos */}
  <div>
    <h3 className="font-semibold mb-2">Before Photos</h3>
    {service.beforePhotos?.length > 0 ? (
      <div className="grid grid-cols-2 gap-2">
        {service.beforePhotos.map((photo, idx) => (
          <div 
            key={idx}
            className="relative aspect-square cursor-pointer hover:opacity-80"
            onClick={() => openLightbox(photo)}
          >
            <img 
              src={photo} 
              alt={`Before ${idx + 1}`}
              className="w-full h-full object-cover rounded"
            />
          </div>
        ))}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">No photos</p>
    )}
  </div>

  {/* After Photos */}
  <div>
    <h3 className="font-semibold mb-2">After Photos</h3>
    {service.afterPhotos?.length > 0 ? (
      <div className="grid grid-cols-2 gap-2">
        {service.afterPhotos.map((photo, idx) => (
          <div 
            key={idx}
            className="relative aspect-square cursor-pointer hover:opacity-80"
            onClick={() => openLightbox(photo)}
          >
            <img 
              src={photo} 
              alt={`After ${idx + 1}`}
              className="w-full h-full object-cover rounded"
            />
          </div>
        ))}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">No photos</p>
    )}
  </div>

  {/* Signed Report */}
  <div>
    <h3 className="font-semibold mb-2">Signed Report</h3>
    {service.signedDocumentUrl ? (
      <div>
        <div 
          className="border rounded p-4 cursor-pointer hover:bg-accent"
          onClick={() => window.open(service.signedDocumentUrl, '_blank')}
        >
          <div className="flex items-center gap-2">
            <FileText className="h-8 w-8" />
            <div>
              <p className="font-medium">✍️ Client Signature</p>
              <p className="text-xs text-muted-foreground">Click to view</p>
            </div>
          </div>
        </div>
        {service.vendorInvoiceUrl && (
          <div 
            className="border rounded p-4 cursor-pointer hover:bg-accent mt-2"
            onClick={() => window.open(service.vendorInvoiceUrl, '_blank')}
          >
            <div className="flex items-center gap-2">
              <Receipt className="h-8 w-8" />
              <div>
                <p className="font-medium">🧾 Vendor Invoice</p>
                <p className="text-xs text-muted-foreground">Click to view</p>
              </div>
            </div>
          </div>
        )}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">No report</p>
    )}
  </div>
</div>
```

## API Endpoints to Add/Update

### GET `/api/technicians/:id/assigned-services`
Returns all services assigned to technician that are not completed.

### GET `/api/technicians/:id/completed-services`
Returns all completed services by technician with pagination.

### POST `/api/service-requests/:id/start`
Starts a service request, records start time.

### POST `/api/service-requests/:id/end`
Ends a service request, calculates duration.

### POST `/api/service-requests/:id/upload-photo`
Uploads a photo (before/after) for a service request.

### POST `/api/service-requests/:id/upload-document`
Uploads a document (signature/invoice) for a service request.

## WhatsApp Message Templates

### Service Started Confirmation
```
✅ Service Started Successfully!

⏱️ Timer is now running...
Started at: [HH:MM]

SR-[RequestID] is now IN PROGRESS

To return to menu, send "Hi"
```

### Active Services Display
```
🔧 Welcome back, [Technician Name]!

Active Services: 2

⏱️ SR-1762580269192147
   Running for 1h 23m
   Container: TRI16617292
   
⏱️ SR-1762581018733
   Running for 45m
   Container: BLU2027250

[📅 View Schedule] [🛑 End Service 1] [🛑 End Service 2]
```

### Service Completion Summary
```
✅ Service Completed Successfully!

📊 Service Summary:
━━━━━━━━━━━━━━━━━━━━
🆔 Request: SR-[RequestID]
📦 Container: [Container ID]
👤 Customer: [Customer Name]

⏱️ Service Duration:
   Started: [Start Time]
   Completed: [End Time]
   Total Time: 2h 50m

📸 Uploaded Documents:
   ✓ Before Photos: 2
   ✓ After Photos: 3
   ✓ Client Signature: ✓
   ✓ Invoice: Yes

💬 Feedback Request sent to customer
━━━━━━━━━━━━━━━━━━━━

Great work! 🎉

[🏠 Return to Menu] [📅 View Schedule]
```

## Testing Checklist

### WhatsApp Flow
- [ ] Technician sends "Hi" → Welcome message with buttons
- [ ] Click "View Schedule" → Date selection appears
- [ ] Select "Today" → Shows today's services
- [ ] Click on service → Shows service details
- [ ] Click "Start Service" → Timer starts, customer notified
- [ ] Send "Hi" again → Shows active services with timer
- [ ] Click "End Service" → Upload flow begins
- [ ] Upload before photos → Confirmed
- [ ] Upload after photos → Confirmed
- [ ] Upload signature → Confirmed
- [ ] Choose invoice option → Service completed
- [ ] Receive completion summary → Success

### Dashboard Integration
- [ ] Open Technician Management → See all technicians
- [ ] Click on technician → Open profile
- [ ] See "Assigned Services" section → Shows active services
- [ ] Click on SR number → Navigate to detail page
- [ ] See service details with timeline
- [ ] See "Completed Services" section → Shows history
- [ ] Click on completed SR → See all photos and documents
- [ ] Photos display as thumbnails → Click to enlarge
- [ ] Signature document viewable → Opens in new tab
- [ ] Invoice document viewable → Opens in new tab

### Real-Time Sync
- [ ] Start service on WhatsApp → Status updates in dashboard
- [ ] Upload photos on WhatsApp → Photos appear in dashboard
- [ ] Complete service on WhatsApp → Moves to completed section
- [ ] All data syncs within 2 seconds

## Implementation Priority

1. **Phase 1: Core Service Tracking** (High Priority)
   - Multi-service tracking in conversation state
   - Start/end service with timer
   - Active services display

2. **Phase 2: Upload Flow** (High Priority)
   - Sequential photo upload prompts
   - Signature upload (mandatory)
   - Invoice upload (optional)
   - Completion summary

3. **Phase 3: Dashboard Integration** (Medium Priority)
   - Assigned Services section
   - Completed Services section
   - Clickable SR links

4. **Phase 4: Photo Galleries** (Medium Priority)
   - Thumbnail display
   - Lightbox viewer
   - Document preview

5. **Phase 5: Schedule Enhancement** (Low Priority)
   - Date navigation
   - Calendar view
   - Historical data

## Notes

- All timestamps should be stored in UTC and converted to local time for display
- Photo uploads should be stored in cloud storage (S3/Cloudinary)
- Document URLs should be signed URLs with expiration
- Customer notifications should be sent asynchronously
- Error handling should be robust for network failures during uploads
- Multi-service tracking should handle edge cases (service deleted, technician reassigned)

---

**Last Updated**: November 10, 2025
**Status**: Implementation in progress
