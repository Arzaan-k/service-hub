# Technician WhatsApp Flow - Implementation Plan

## Current Status Analysis

### ✅ Already Implemented
1. Basic technician authentication and identification
2. `handleTechnicianStartService` - Updates status to 'in_progress', records actualStartTime
3. `handleTechnicianCompleteService` - Updates status to 'completed', calculates duration
4. Basic button handlers for upload_before_photos, complete_service, need_assistance
5. AI intent classification for technician messages
6. Basic schedule viewing

### ❌ Missing Critical Features

#### 1. Multi-Service Tracking System
**Current**: Only tracks one service at a time via `currentServiceId`
**Required**: Track multiple concurrent services with individual timers

**Implementation Needed**:
```typescript
conversationState: {
  activeServices: [
    {
      serviceId: "SR-123",
      startTime: "2025-11-10T10:00:00Z",
      status: "in_progress"
    },
    {
      serviceId: "SR-456",
      startTime: "2025-11-10T11:30:00Z",
      status: "in_progress"
    }
  ]
}
```

#### 2. Enhanced Schedule View with Date Navigation
**Current**: Basic schedule viewing
**Required**: 
- Date selection (Previous / Today / Future)
- Different actions based on date (completed services = view only, today = start service)
- Service list with priority, container, customer info

#### 3. Complete Upload Flow
**Current**: Basic photo upload prompt
**Required**:
- Sequential upload prompts (before photos → after photos → signature → invoice)
- Mandatory signature validation
- Optional invoice upload
- Store multiple photos per category

#### 4. Active Services Display
**Current**: None
**Required**:
- Show all running services with elapsed time
- Dynamic "End Service 1, 2, 3..." buttons
- Return to menu functionality

#### 5. Customer Notifications
**Current**: None
**Required**:
- Notify customer when service starts
- Notify customer when service completes
- Include service details and duration

#### 6. Service Completion Summary
**Current**: Basic completion message
**Required**:
- Detailed summary with all uploaded documents
- Photo count
- Duration breakdown
- Customer feedback request sent confirmation

## Implementation Steps

### Step 1: Database Schema Updates
Add missing columns to service_requests table:
```sql
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS start_time TIMESTAMP;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS end_time TIMESTAMP;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS before_photos JSONB DEFAULT '[]';
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS after_photos JSONB DEFAULT '[]';
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS signed_document_url TEXT;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS vendor_invoice_url TEXT;
```

### Step 2: Update WhatsApp Service Functions

#### A. Multi-Service Tracking
```typescript
// Add to conversation state management
async function addActiveService(session, serviceId) {
  const activeServices = session.conversationState?.activeServices || [];
  activeServices.push({
    serviceId,
    startTime: new Date().toISOString(),
    status: 'in_progress'
  });
  await storage.updateWhatsappSession(session.id, {
    conversationState: {
      ...session.conversationState,
      activeServices
    }
  });
}

async function removeActiveService(session, serviceId) {
  const activeServices = session.conversationState?.activeServices || [];
  const updated = activeServices.filter(s => s.serviceId !== serviceId);
  await storage.updateWhatsappSession(session.id, {
    conversationState: {
      ...session.conversationState,
      activeServices: updated
    }
  });
}

async function showActiveServicesMenu(from, user, session) {
  const activeServices = session.conversationState?.activeServices || [];
  
  if (activeServices.length === 0) {
    await sendTechnicianMainMenu(from, user);
    return;
  }
  
  let message = `🔧 Welcome back, ${user.name}!\n\nActive Services: ${activeServices.length}\n\n`;
  
  for (const service of activeServices) {
    const elapsed = calculateElapsedTime(service.startTime);
    const serviceDetails = await storage.getServiceRequest(service.serviceId);
    message += `⏱️ ${serviceDetails.requestNumber}\n`;
    message += `   Running for ${elapsed}\n`;
    message += `   Container: ${serviceDetails.container?.containerCode}\n\n`;
  }
  
  const buttons = [
    { id: 'view_schedule', title: '📅 View Schedule' }
  ];
  
  // Add end service buttons for each active service
  activeServices.forEach((service, index) => {
    const buttonId = activeServices.length === 1 
      ? 'end_service' 
      : `end_service_${index + 1}`;
    const buttonTitle = activeServices.length === 1
      ? '🛑 End Service'
      : `🛑 End Service ${index + 1}`;
    buttons.push({ id: buttonId, title: buttonTitle });
  });
  
  await sendInteractiveButtons(from, message, buttons);
}
```

#### B. Enhanced Schedule View
```typescript
async function showScheduleDateSelection(from, technician) {
  await sendInteractiveButtons(
    from,
    '📅 Select Date to View Schedule:',
    [
      { id: 'schedule_previous', title: '⏮️ Previous Dates' },
      { id: 'schedule_today', title: '📍 Today' },
      { id: 'schedule_future', title: '⏭️ Future Dates' }
    ]
  );
}

async function showScheduleForToday(from, technician) {
  const today = new Date().toISOString().split('T')[0];
  const services = await storage.getTechnicianSchedule(technician.id, today);
  
  if (services.length === 0) {
    await sendTextMessage(from, '📋 No services scheduled for today.');
    return;
  }
  
  let message = `📋 Today's Schedule - ${formatDate(today)}\n\nYou have ${services.length} service(s) scheduled today:\n\n`;
  
  const buttons = [];
  
  for (const service of services) {
    message += `🔧 ${service.requestNumber} - ${service.status}\n`;
    message += `├─ Container: ${service.container?.containerCode}\n`;
    message += `├─ Customer: ${service.customer?.companyName}\n`;
    message += `├─ Location: ${service.container?.currentLocation?.address || 'Unknown'}\n`;
    message += `├─ Priority: ${service.priority}\n`;
    message += `└─ Issue: ${service.issueDescription}\n\n`;
    
    buttons.push({
      id: `view_service_${service.id}`,
      title: `📄 View ${service.requestNumber}`
    });
  }
  
  await sendTextMessage(from, message);
  await sendInteractiveButtons(from, 'Select a service:', buttons);
}
```

#### C. Complete Upload Flow
```typescript
async function initiateServiceCompletion(from, user, serviceId, session) {
  const service = await storage.getServiceRequest(serviceId);
  const startTime = service.startTime || service.actualStartTime;
  const duration = calculateDuration(startTime, new Date());
  
  await storage.updateWhatsappSession(session.id, {
    conversationState: {
      ...session.conversationState,
      completingServiceId: serviceId,
      completionStep: 'awaiting_before_photos',
      uploadedBeforePhotos: [],
      uploadedAfterPhotos: []
    }
  });
  
  await sendTextMessage(
    from,
    `🛑 Ending Service: ${service.requestNumber}\n\n⏱️ Service Duration: ${duration}\nStarted: ${formatTime(startTime)}\nEnding: ${formatTime(new Date())}\n\n📸 Please upload service documentation:`
  );
  
  await sendTextMessage(
    from,
    `📸 Step 1: Before/After Photos\n\nPlease upload:\n1️⃣ Before photos (if not uploaded during start)\n2️⃣ After photos (required)\n\nUpload photos or type "Skip" if before photos not applicable`
  );
  
  await sendInteractiveButtons(
    from,
    'Upload photos:',
    [
      { id: 'upload_photos_now', title: '📷 Upload Photos' },
      { id: 'skip_before_photos', title: '⏭️ Skip Before Photos' }
    ]
  );
}

async function handlePhotoUploadStep(from, user, mediaId, session) {
  const step = session.conversationState?.completionStep;
  const serviceId = session.conversationState?.completingServiceId;
  
  if (step === 'awaiting_before_photos') {
    const photos = session.conversationState?.uploadedBeforePhotos || [];
    photos.push(mediaId);
    
    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        ...session.conversationState,
        uploadedBeforePhotos: photos
      }
    });
    
    await sendTextMessage(from, `✅ Before photo received (${photos.length})\n\nSend more photos or type "DONE" to continue.`);
    
  } else if (step === 'awaiting_after_photos') {
    const photos = session.conversationState?.uploadedAfterPhotos || [];
    photos.push(mediaId);
    
    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        ...session.conversationState,
        uploadedAfterPhotos: photos
      }
    });
    
    await sendTextMessage(from, `✅ After photo received (${photos.length})\n\nSend more photos or type "DONE" to continue.`);
  }
}

async function requestSignatureUpload(from, session) {
  await storage.updateWhatsappSession(session.id, {
    conversationState: {
      ...session.conversationState,
      completionStep: 'awaiting_signature'
    }
  });
  
  await sendTextMessage(
    from,
    `📄 Step 2: Client Signature\n\nPlease upload:\n✍️ Document with client signature\n📋 Service completion form (if applicable)\n\nThis is MANDATORY to complete the service.`
  );
  
  await sendInteractiveButtons(
    from,
    'Upload signature:',
    [{ id: 'upload_signature_now', title: '📄 Upload Document' }]
  );
}

async function requestInvoiceUpload(from, session) {
  await storage.updateWhatsappSession(session.id, {
    conversationState: {
      ...session.conversationState,
      completionStep: 'awaiting_invoice_choice'
    }
  });
  
  await sendTextMessage(
    from,
    `🧾 Step 3: Third-Party Purchase Invoice\n\nDid you purchase any spare parts from a third-party vendor?`
  );
  
  await sendInteractiveButtons(
    from,
    'Vendor purchase:',
    [
      { id: 'upload_invoice_yes', title: '✅ Yes, Upload Invoice' },
      { id: 'upload_invoice_no', title: '❌ No, Continue' }
    ]
  );
}
```

#### D. Customer Notifications
```typescript
async function notifyCustomerServiceStarted(serviceId) {
  const service = await storage.getServiceRequest(serviceId);
  const customer = service.customer;
  const technician = service.technician;
  
  if (!customer.whatsappNumber) return;
  
  const message = `🔔 Service Update\n\nYour service has been started!\n\n🔧 Service Request: ${service.requestNumber}\n👷 Technician: ${technician.name}\n📦 Container: ${service.container?.containerCode}\n⏰ Started: ${formatTime(new Date())}\n\nWe'll notify you when the service is completed.`;
  
  await sendTextMessage(customer.whatsappNumber, message);
}

async function notifyCustomerServiceCompleted(serviceId, duration) {
  const service = await storage.getServiceRequest(serviceId);
  const customer = service.customer;
  const technician = service.technician;
  
  if (!customer.whatsappNumber) return;
  
  const message = `✅ Service Completed!\n\nYour service has been completed successfully.\n\n🔧 Service Request: ${service.requestNumber}\n👷 Technician: ${technician.name}\n📦 Container: ${service.container?.containerCode}\n⏰ Completed: ${formatTime(new Date())}\n⏱️ Duration: ${duration}\n\n📋 Please provide your feedback:\n[Feedback buttons or link]\n\nThank you for choosing Service Hub!`;
  
  await sendTextMessage(customer.whatsappNumber, message);
  
  // Send feedback request buttons
  await sendInteractiveButtons(
    customer.whatsappNumber,
    'Rate this service:',
    [
      { id: `feedback_${serviceId}_5`, title: '⭐⭐⭐⭐⭐ Excellent' },
      { id: `feedback_${serviceId}_4`, title: '⭐⭐⭐⭐ Good' },
      { id: `feedback_${serviceId}_3`, title: '⭐⭐⭐ Average' }
    ]
  );
}
```

### Step 3: Dashboard Integration

#### A. Add API Endpoints
```typescript
// server/routes.ts

// Get assigned services for technician
app.get('/api/technicians/:id/assigned-services', async (req, res) => {
  const { id } = req.params;
  const services = await storage.getServiceRequestsByTechnician(id, ['scheduled', 'in_progress']);
  res.json(services);
});

// Get completed services for technician
app.get('/api/technicians/:id/completed-services', async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const services = await storage.getServiceRequestsByTechnician(id, ['completed'], {
    page: Number(page),
    limit: Number(limit),
    orderBy: 'end_time',
    order: 'DESC'
  });
  res.json(services);
});
```

#### B. Update Technician Profile Page
Create new components in `client/src/pages/technician-profile.tsx`:
- AssignedServicesCard
- CompletedServicesCard
- Each service request is clickable link to detail page

#### C. Enhance Service Request Detail Page
Update `client/src/pages/service-request-detail.tsx`:
- Add photo galleries with thumbnails
- Add document viewer for signature/invoice
- Add timeline view
- Add duration display

## Testing Plan

### Phase 1: Multi-Service Tracking
1. Start Service 1 → Verify added to activeServices
2. Send "Hi" → Verify shows active service with timer
3. Start Service 2 → Verify both services tracked
4. Send "Hi" → Verify shows both services with "End Service 1" and "End Service 2" buttons
5. End Service 1 → Verify removed from activeServices, Service 2 still active

### Phase 2: Upload Flow
1. Click "End Service" → Verify before photos prompt
2. Upload 2 before photos → Verify confirmation messages
3. Type "DONE" → Verify moves to after photos
4. Upload 3 after photos → Verify confirmation messages
5. Type "DONE" → Verify signature prompt
6. Upload signature → Verify invoice prompt
7. Click "Yes" → Verify invoice upload prompt
8. Upload invoice → Verify completion summary

### Phase 3: Customer Notifications
1. Start service → Verify customer receives notification
2. Complete service → Verify customer receives completion notification with feedback buttons

### Phase 4: Dashboard Integration
1. Open technician profile → Verify "Assigned Services" section visible
2. Verify active services listed with correct status
3. Click on SR number → Verify navigates to detail page
4. Verify "Completed Services" section visible
5. Click on completed SR → Verify all photos and documents visible

## Timeline

- **Day 1-2**: Database schema updates + Multi-service tracking
- **Day 3-4**: Complete upload flow + Customer notifications
- **Day 5-6**: Dashboard integration + Photo galleries
- **Day 7**: Testing and bug fixes

## Priority Order

1. **Critical (Must Have)**:
   - Multi-service tracking
   - Complete upload flow with signature
   - Customer notifications

2. **High (Should Have)**:
   - Enhanced schedule view
   - Dashboard assigned/completed services sections

3. **Medium (Nice to Have)**:
   - Photo galleries with lightbox
   - Advanced date navigation
   - Service history analytics

---

**Status**: Ready for implementation
**Last Updated**: November 10, 2025
