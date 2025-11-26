/**
 * WhatsApp Technician Service Module - Flow Handlers
 * Complete implementation of all technician WhatsApp flows
 */

import { 
  calculateElapsedTime, 
  calculateDuration, 
  formatDate, 
  formatTime, 
  formatDurationMinutes,
  addActiveService,
  removeActiveService,
  getActiveServices,
  getServiceIdByIndex
} from './whatsapp-technician-core';

import { 
  sendTextMessage, 
  sendInteractiveButtons, 
  sendInteractiveList,
  sendTemplateMessage
} from './whatsapp';

// ============================================================================
// MAIN MENU & WELCOME
// ============================================================================

/**
 * Send technician main menu
 */
export async function sendTechnicianMainMenu(from: string, user: any, storage: any): Promise<void> {
  const technician = await storage.getTechnician(user.id);
  
  await sendInteractiveButtons(
    from,
    `🔧 Welcome to Service Hub!\n\nIdentifying your profile...\n✓ Verified: ${user.name}\nRole: Technician\nID: ${technician?.employeeCode || 'N/A'}\n\nPlease select an option below:`,
    [
      { id: 'view_schedule', title: '📅 View Schedule' }
    ]
  );
}

/**
 * Show active services menu with timers
 */
export async function showActiveServicesMenu(from: string, user: any, session: any, storage: any): Promise<void> {
  const activeServices = getActiveServices(session);
  
  if (activeServices.length === 0) {
    await sendTechnicianMainMenu(from, user, storage);
    return;
  }
  
  let message = `🔧 Welcome back, ${user.name}!\n\nActive Services: ${activeServices.length}\n\n`;
  
  // Fetch service details for each active service
  for (const service of activeServices) {
    const elapsed = calculateElapsedTime(service.startTime);
    const serviceDetails = await storage.getServiceRequest(service.serviceId);
    
    if (serviceDetails) {
      message += `⏱️ ${serviceDetails.requestNumber}\n`;
      message += `   Running for ${elapsed}\n\n`;
    }
  }
  
  const buttons = [
    { id: 'view_schedule', title: '📅 View Schedule' }
  ];
  
  // Add end service buttons for each active service
  activeServices.forEach((service: any, index: number) => {
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

// ============================================================================
// SCHEDULE MANAGEMENT
// ============================================================================

/**
 * Show date selection for schedule
 */
export async function showScheduleDateSelection(from: string, technician: any): Promise<void> {
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

/**
 * Show schedule for today
 */
export async function showScheduleForToday(from: string, technician: any, session: any, storage: any): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Get services scheduled for today
  const allServices = await storage.getTechnicianSchedule(technician.id);
  const todayServices = allServices.filter((s: any) => {
    const scheduled = new Date(s.scheduledDate);
    return scheduled >= today && scheduled < tomorrow;
  });
  
  if (todayServices.length === 0) {
    await sendTextMessage(from, `📋 Today's Schedule - ${formatDate(today)}\n\nYou have 0 service(s) scheduled today.`);
    await sendInteractiveButtons(from, 'What would you like to do?', [
      { id: 'view_schedule', title: '📅 View Schedule' },
      { id: 'back_to_menu', title: '🏠 Main Menu' }
    ]);
    return;
  }
  
  let message = `📋 Today's Schedule - ${formatDate(today)}\n\nYou have ${todayServices.length} service(s) scheduled today:\n\n`;
  
  const rows = [];
  
  for (const service of todayServices) {
    const container = service.container || {};
    const customer = service.customer || {};
    const location = container.currentLocation?.address || container.currentLocation?.city || 'Unknown';
    
    // Add to message text
    message += `🔧 ${service.requestNumber} - [${service.status}]\n`;
    message += `├─ Container: ${container.containerCode || 'Unknown'}\n`;
    message += `├─ Customer: ${customer.companyName || 'Unknown'}\n`;
    message += `├─ Location: ${location}\n`;
    message += `├─ Priority: ${service.priority || 'Normal'}\n`;
    message += `├─ Scheduled: ${formatTime(service.scheduledDate)}\n`;
    message += `└─ Issue: ${service.issueDescription?.substring(0, 30) || 'No description'}...\n\n`;
    
    // Add interactive row
    rows.push({
      id: `view_service_${service.id}`,
      title: `${service.requestNumber}`,
      description: `${container.containerCode || 'No Container'} - ${service.status}`
    });
  }
  
  // Send summary message first
  await sendTextMessage(from, message);
  
  // Then send list to select details
  await sendInteractiveList(
    from,
    "Select a service to view details:",
    "View Details",
    [
      {
        title: "Scheduled Services",
        rows: rows
      }
    ]
  );
  
  // Bottom section active services count
  const activeServices = getActiveServices(session);
  if (activeServices.length > 0) {
    await sendTextMessage(from, `Active Services: ${activeServices.length}`);
  }
}

/**
 * Show schedule for previous dates (Completed)
 */
export async function showScheduleForPrevious(from: string, technician: any, session: any, storage: any): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Get completed services
  const allServices = await storage.getTechnicianSchedule(technician.id);
  const previousServices = allServices.filter((s: any) => {
    const scheduled = new Date(s.scheduledDate);
    return scheduled < today && s.status === 'completed';
  }).slice(0, 10); // Limit to last 10
  
  if (previousServices.length === 0) {
    await sendTextMessage(from, '📋 You have no completed services in history.');
    return;
  }
  
  let message = `📋 Service History\n\nYou have ${previousServices.length} completed services (showing last 10):\n\n`;
  
  const rows = [];
  
  for (const service of previousServices) {
    message += `🔧 ${service.requestNumber} - [Completed]\n`;
    message += `├─ Completed: ${formatTime(service.actualEndTime || service.updatedAt)}\n\n`;
    
    rows.push({
      id: `view_service_${service.id}`,
      title: `${service.requestNumber}`,
      description: `Completed - ${formatDate(service.actualEndTime || service.updatedAt)}`
    });
  }
  
  await sendTextMessage(from, message);
  
  await sendInteractiveList(
    from,
    "Select a service to view details:",
    "View Details",
    [
      {
        title: "Completed Services",
        rows: rows
      }
    ]
  );
}

/**
 * Show schedule for future dates
 */
export async function showScheduleForFuture(from: string, technician: any, session: any, storage: any): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const allServices = await storage.getTechnicianSchedule(technician.id);
  const futureServices = allServices.filter((s: any) => {
    const scheduled = new Date(s.scheduledDate);
    return scheduled >= tomorrow;
  }).slice(0, 10);
  
  if (futureServices.length === 0) {
    await sendTextMessage(from, '📋 You have no upcoming services scheduled.');
    return;
  }
  
  let message = `📅 Future Schedule\n\nYou have ${futureServices.length} upcoming services:\n\n`;
  
  const rows = [];
  
  for (const service of futureServices) {
    message += `🔧 ${service.requestNumber} - [Scheduled]\n`;
    message += `├─ Scheduled: ${formatDate(service.scheduledDate)} ${formatTime(service.scheduledDate)}\n\n`;
    
    rows.push({
      id: `view_service_${service.id}`,
      title: `${service.requestNumber}`,
      description: `${formatDate(service.scheduledDate)}`
    });
  }
  
  await sendTextMessage(from, message);
  
  await sendInteractiveList(
    from,
    "Select a service to view details:",
    "View Details",
    [
      {
        title: "Future Services",
        rows: rows
      }
    ]
  );
}

// ============================================================================
// SERVICE DETAILS & ACTIONS
// ============================================================================

/**
 * Show full service details
 */
export async function showServiceDetails(from: string, serviceId: string, storage: any): Promise<void> {
  const service = await storage.getServiceRequest(serviceId);
  
  if (!service) {
    await sendTextMessage(from, '❌ Service request not found.');
    return;
  }
  
  const container = service.container || {};
  const customer = service.customer || {};
  const location = container.currentLocation?.address || container.currentLocation?.city || 'Unknown';
  
  let message = `📋 Service Request Details\n\n`;
  message += `🆔 Request ID: ${service.requestNumber}\n`;
  message += `📦 Container: ${container.containerCode || 'Unknown'}\n`;
  message += `👤 Customer: ${customer.companyName || 'Unknown'}\n`;
  message += `📞 Contact: ${customer.phone || 'N/A'}\n`;
  message += `📍 Location: ${location}\n`;
  message += `⚠️ Priority: ${service.priority || 'Normal'}\n`;
  message += `📅 Scheduled: ${formatTime(service.scheduledDate)}\n\n`;
  
  message += `🔍 Issue Description:\n${service.issueDescription || 'No description provided'}\n\n`;
  
  message += `📊 Status: ${service.status.toUpperCase()}\n`;
  message += `⏱️ Est. Duration: ${service.estimatedDuration || 0} mins\n`;
  message += `🔧 Required Parts: ${service.requiredParts?.join(', ') || 'None'}\n`;
  
  const buttons = [];
  
  if (service.status === 'scheduled' || service.status === 'pending' || service.status === 'approved') {
    buttons.push({ id: `start_service_${service.id}`, title: '▶️ Start Service' });
  } else if (service.status === 'in_progress') {
    buttons.push({ id: `end_service_direct_${service.id}`, title: '🛑 End Service' });
  }
  
  buttons.push({ id: 'view_schedule', title: '🏠 Back to Schedule' });
  
  await sendInteractiveButtons(from, message, buttons);
}

/**
 * Start a service request
 */
export async function startServiceRequest(from: string, serviceId: string, session: any, storage: any): Promise<void> {
  const service = await storage.getServiceRequest(serviceId);
  
  if (!service) return;
  
  // Update DB
  await storage.updateServiceRequest(serviceId, {
    status: 'in_progress',
    startTime: new Date(), // Actual start time
    startedAt: new Date() // Legacy field support
  });
  
  // Add to active services in session
  await addActiveService(session, serviceId, storage);
  
  // Notify Customer
  if (service.customer && service.customer.whatsappNumber) {
    const technician = await storage.getTechnician(service.assignedTechnicianId);
    const startTime = new Date().toLocaleString('en-IN');
    
    await sendTemplateMessage(
      service.customer.whatsappNumber,
      'service_started_notification', // Assuming template exists, fallback to text if needed
      'en',
      [
        service.requestNumber,
        technician?.user?.name || 'Technician',
        service.container?.containerCode || 'Container',
        startTime
      ]
    ).catch(async () => {
      // Fallback to text if template fails
      await sendTextMessage(
        service.customer.whatsappNumber, 
        `🔔 Service Update\n\nYour service has been started!\n\n🔧 Service Request: ${service.requestNumber}\n👷 Technician: ${technician?.user?.name}\n📦 Container: ${service.container?.containerCode}\n⏰ Started: ${startTime}\n\nWe'll notify you when the service is completed.`
      );
    });
  }
  
  // Confirm to Technician
  await sendTextMessage(
    from, 
    `✅ Service Started Successfully!\n\n⏱️ Timer is now running...\nStarted at: ${new Date().toLocaleTimeString()}\n\n${service.requestNumber} is now IN PROGRESS\n\nTo return to menu, send "Hi"`
  );
}

// ============================================================================
// SERVICE COMPLETION FLOW
// ============================================================================

/**
 * Initiate service completion - Step 1: Duration & Ask for Photos
 */
export async function initiateServiceCompletion(from: string, serviceId: string, session: any, storage: any): Promise<void> {
  const service = await storage.getServiceRequest(serviceId);
  const activeService = getActiveServices(session).find((s: any) => s.serviceId === serviceId);
  
  let durationText = "Unknown";
  let startTime = new Date();
  
  if (activeService) {
    startTime = new Date(activeService.startTime);
    durationText = calculateElapsedTime(activeService.startTime);
  } else if (service.startTime) {
    startTime = new Date(service.startTime);
    durationText = calculateDuration(service.startTime, new Date());
  }
  
  // Update session state for photo upload
  await storage.updateWhatsappSession(session.id, {
    conversationState: {
      ...session.conversationState,
      step: 'upload_before_photos',
      currentServiceId: serviceId,
      serviceStartTime: startTime.toISOString()
    }
  });
  
  const message = `🛑 Ending Service: ${service.requestNumber}\n\n⏱️ Service Duration: ${durationText}\nStarted: ${formatTime(startTime)}\nEnding: ${formatTime(new Date())}\n\n📸 Please upload service documentation:\n\nStep 1: Before/After Photos\n\nPlease upload:\n1️⃣ Before photos (if not uploaded)\n2️⃣ After photos (required)\n\nUpload photos now or click Skip if you have no before photos.`;
  
  await sendInteractiveButtons(from, message, [
    { id: 'skip_before_photos', title: '⏭️ Skip Before Photos' }
  ]);
}

/**
 * Handle photo upload step
 */
export async function handlePhotoUploadStep(from: string, imageUrl: string, session: any, storage: any): Promise<void> {
  const state = session.conversationState;
  const serviceId = state.currentServiceId;
  
  if (!serviceId) return;
  
  const service = await storage.getServiceRequest(serviceId);
  const step = state.step; // 'upload_before_photos' or 'upload_after_photos'
  
  if (step === 'upload_before_photos') {
    // Append to before photos
    const currentPhotos = service.beforePhotos || [];
    await storage.updateServiceRequest(serviceId, {
      beforePhotos: [...currentPhotos, imageUrl]
    });
    
    await sendInteractiveButtons(from, "✅ Before photo received. Upload more or continue.", [
      { id: 'done_before_photos', title: '✅ Done / Next Step' }
    ]);
  } else if (step === 'upload_after_photos') {
    // Append to after photos
    const currentPhotos = service.afterPhotos || [];
    await storage.updateServiceRequest(serviceId, {
      afterPhotos: [...currentPhotos, imageUrl]
    });
    
    await sendInteractiveButtons(from, "✅ After photo received. Upload more or continue.", [
      { id: 'done_after_photos', title: '✅ Done / Next Step' }
    ]);
  }
}

/**
 * Move from Before to After photos
 */
export async function moveToAfterPhotos(from: string, session: any, storage: any): Promise<void> {
  await storage.updateWhatsappSession(session.id, {
    conversationState: {
      ...session.conversationState,
      step: 'upload_after_photos'
    }
  });
  
  await sendTextMessage(from, "📸 Now please upload AFTER photos (Required).");
}

/**
 * Request Signature Upload
 */
export async function requestSignatureUpload(from: string, session: any, storage: any): Promise<void> {
  await storage.updateWhatsappSession(session.id, {
    conversationState: {
      ...session.conversationState,
      step: 'upload_signature'
    }
  });
  
  await sendTextMessage(from, "Step 2: Client Signature/Documents\n\nPlease upload:\n✍️ Document with client signature\n📋 Service completion form\n\nThis is MANDATORY to complete the service.");
}

/**
 * Handle Signature Upload
 */
export async function handleSignatureUpload(from: string, imageUrl: string, session: any, storage: any): Promise<void> {
  const serviceId = session.conversationState.currentServiceId;
  
  await storage.updateServiceRequest(serviceId, {
    signedDocumentUrl: imageUrl
  });
  
  // Move to next step: Invoice
  await requestInvoiceUpload(from, session, storage);
}

/**
 * Request Invoice Upload (Conditional)
 */
export async function requestInvoiceUpload(from: string, session: any, storage: any): Promise<void> {
  await storage.updateWhatsappSession(session.id, {
    conversationState: {
      ...session.conversationState,
      step: 'check_invoice'
    }
  });
  
  await sendInteractiveButtons(
    from,
    "Step 3: Invoice Upload (Conditional)\n\n🧾 Did you purchase any spare parts from a third-party vendor?",
    [
      { id: 'invoice_yes', title: '✅ Yes, Upload Invoice' },
      { id: 'invoice_no', title: '❌ No, Continue' }
    ]
  );
}

/**
 * Handle Invoice Yes/No
 */
export async function handleInvoiceResponse(from: string, hasInvoice: boolean, session: any, storage: any): Promise<void> {
  if (hasInvoice) {
    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        ...session.conversationState,
        step: 'upload_invoice'
      }
    });
    await sendTextMessage(from, "🧾 Please upload the purchase invoice/receipt photo.");
  } else {
    // Finish service
    await completeServiceRequest(from, session, storage);
  }
}

/**
 * Handle Invoice Upload
 */
export async function handleInvoiceUpload(from: string, imageUrl: string, session: any, storage: any): Promise<void> {
  const serviceId = session.conversationState.currentServiceId;
  
  await storage.updateServiceRequest(serviceId, {
    vendorInvoiceUrl: imageUrl
  });
  
  await completeServiceRequest(from, session, storage);
}

/**
 * Complete Service Request - Final Step
 */
export async function completeServiceRequest(from: string, session: any, storage: any): Promise<void> {
  const serviceId = session.conversationState.currentServiceId;
  const service = await storage.getServiceRequest(serviceId);
  const startTimeStr = session.conversationState.serviceStartTime;
  const startTime = new Date(startTimeStr);
  const endTime = new Date();
  
  // Calculate total minutes
  const diffMs = endTime.getTime() - startTime.getTime();
  const durationMinutes = Math.floor(diffMs / 60000);
  
  // Update DB
  await storage.updateServiceRequest(serviceId, {
    status: 'completed',
    endTime: endTime,
    actualEndTime: endTime,
    serviceDuration: durationMinutes,
    durationMinutes: durationMinutes
  });
  
  // Remove from active services
  await removeActiveService(session, serviceId, storage);
  
  // Clear session state
  await storage.updateWhatsappSession(session.id, {
    conversationState: {
      ...session.conversationState,
      step: 'main_menu',
      currentServiceId: null,
      serviceStartTime: null
    }
  });
  
  // Notify Customer
  if (service.customer && service.customer.whatsappNumber) {
    const technician = await storage.getTechnician(service.assignedTechnicianId);
    const durationText = formatDurationMinutes(durationMinutes);
    
    await sendTemplateMessage(
      service.customer.whatsappNumber,
      'service_completed_notification',
      'en',
      [
        service.requestNumber,
        technician?.user?.name || 'Technician',
        service.container?.containerCode || 'Container',
        durationText
      ]
    ).catch(async () => {
      await sendTextMessage(
        service.customer.whatsappNumber,
        `✅ Service Completed!\n\nYour service has been completed successfully.\n\n🔧 Service Request: ${service.requestNumber}\n👷 Technician: ${technician?.user?.name}\n📦 Container: ${service.container?.containerCode}\n⏱️ Duration: ${durationText}\n\n📋 Please provide your feedback using the link below.\n\nThank you for choosing Service Hub!`
      );
    });
  }
  
  // Send Summary to Technician
  const durationText = formatDurationMinutes(durationMinutes);
  let summary = `✅ Service Completed Successfully!\n\n📊 Service Summary:\n━━━━━━━━━━━━━━━━━━━━\n🆔 Request: ${service.requestNumber}\n📦 Container: ${service.container?.containerCode}\n👤 Customer: ${service.customer?.companyName}\n\n⏱️ Service Duration:\n   Started: ${formatTime(startTime)}\n   Completed: ${formatTime(endTime)}\n   Total Time: ${durationText}\n\n📸 Uploaded Documents:\n   ✓ Before Photos: ${(service.beforePhotos?.length || 0)}\n   ✓ After Photos: ${(service.afterPhotos?.length || 0)}\n   ✓ Client Signature: ✓\n   ✓ Invoice: ${service.vendorInvoiceUrl ? 'Yes' : 'No'}\n\n💬 Feedback Request sent to customer\n━━━━━━━━━━━━━━━━━━━━\n\nGreat work! 🎉`;
  
  await sendInteractiveButtons(from, summary, [
    { id: 'back_to_menu', title: '🏠 Return to Menu' },
    { id: 'view_schedule', title: '📅 View Schedule' }
  ]);
}
