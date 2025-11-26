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
  sendInteractiveList 
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
    `👋 Hello ${user.name}!\n\n🔧 Employee Code: ${technician?.employeeCode || 'N/A'}\n📍 Status: ${(technician?.status || 'available').toUpperCase()}\n\nWhat would you like to do?`,
    [
      { id: 'view_profile', title: '👤 View Profile' },
      { id: 'view_schedule', title: '📋 View Schedule' },
      { id: 'start_service', title: '🔧 Start Service' },
      { id: 'update_status', title: '📊 Update Status' },
      { id: 'emergency_help', title: '🆘 Emergency' }
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
      message += `   Running for ${elapsed}\n`;
      message += `   Container: ${serviceDetails.container?.containerCode || 'Unknown'}\n\n`;
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
    await sendTextMessage(from, '📋 No services scheduled for today.');
    await sendInteractiveButtons(from, 'What would you like to do?', [
      { id: 'view_schedule', title: '📅 View Schedule' },
      { id: 'back_to_menu', title: '🏠 Main Menu' }
    ]);
    return;
  }
  
  let message = `📋 Today's Schedule - ${formatDate(today)}\n\nYou have ${todayServices.length} service(s) scheduled today:\n\n`;
  
  for (const service of todayServices) {
    const container = service.container || {};
    const customer = service.customer || {};
    const location = container.currentLocation?.address || container.currentLocation?.city || 'Unknown';
    
    message += `🔧 ${service.requestNumber} - ${service.status}\n`;
    message += `├─ Container: ${container.containerCode || 'Unknown'}\n`;
    message += `├─ Customer: ${customer.companyName || 'Unknown'}\n`;
    message += `├─ Location: ${location}\n`;
    message += `├─ Priority: ${service.priority || 'Normal'}\n`;
    message += `├─ Scheduled: ${formatTime(service.scheduledDate)}\n`;
    message += `└─ Issue: ${service.issueDescription?.substring(0, 50) || 'No description'}...\n\n`;
  }
  
  await sendTextMessage(from, message);
  
  // Create buttons for each service
  const buttons = todayServices.slice(0, 3).map((service: any) => ({
    id: `view_service_${service.id}`,
    title: `📄 ${service.requestNumber}`
  }));
  
  // Add active services info
  const activeServices = getActiveServices(session);
  if (activeServices.length > 0) {
    activeServices.forEach((service: any, index: number) => {
      const buttonId = activeServices.length === 1 
        ? 'end_service' 
        : `end_service_${index + 1}`;
      const buttonTitle = activeServices.length === 1
        ? '🛑 End Service'
        : `🛑 End Service ${index + 1}`;
      buttons.push({ id: buttonId, title: buttonTitle });
    });
  }
  
  await sendInteractiveButtons(from, 'Select a service:', buttons);
}

/**
 * Show schedule for previous dates (completed services)
 */
export async function showScheduleForPrevious(from: string, technician: any, storage: any): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Get completed services from last 30 days
  const allServices = await storage.getTechnicianSchedule(technician.id);
  const completedServices = allServices.filter((s: any) => {
    return s.status === 'completed' && new Date(s.endTime || s.actualEndTime) < today;
  }).slice(0, 10); // Limit to 10 most recent
  
  if (completedServices.length === 0) {
    await sendTextMessage(from, '📋 No completed services found in recent history.');
    return;
  }
  
  let message = `📋 Service History\n\nYou have ${completedServices.length} completed services:\n\n`;
  
  for (const service of completedServices) {
    const container = service.container || {};
    const customer = service.customer || {};
    const completedTime = service.endTime || service.actualEndTime;
    
    message += `🔧 ${service.requestNumber} - Completed\n`;
    message += `├─ Container: ${container.containerCode || 'Unknown'}\n`;
    message += `├─ Customer: ${customer.companyName || 'Unknown'}\n`;
    message += `├─ Issue: ${service.issueDescription?.substring(0, 40) || 'No description'}...\n`;
    message += `└─ Completed: ${formatTime(completedTime)}\n\n`;
  }
  
  await sendTextMessage(from, message);
  
  // Create buttons for viewing details
  const buttons = completedServices.slice(0, 3).map((service: any) => ({
    id: `view_service_${service.id}`,
    title: `📄 ${service.requestNumber}`
  }));
  
  await sendInteractiveButtons(from, 'View service details:', buttons);
}

/**
 * Show schedule for future dates
 */
export async function showScheduleForFuture(from: string, technician: any, storage: any): Promise<void> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  // Get future scheduled services
  const allServices = await storage.getTechnicianSchedule(technician.id);
  const futureServices = allServices.filter((s: any) => {
    const scheduled = new Date(s.scheduledDate);
    return scheduled >= tomorrow && s.status === 'scheduled';
  }).slice(0, 10);
  
  if (futureServices.length === 0) {
    await sendTextMessage(from, '📅 No services scheduled for future dates.');
    return;
  }
  
  let message = `📅 Future Schedule\n\nYou have ${futureServices.length} service(s) scheduled:\n\n`;
  
  for (const service of futureServices) {
    const container = service.container || {};
    const customer = service.customer || {};
    const location = container.currentLocation?.address || container.currentLocation?.city || 'Unknown';
    
    message += `🔧 ${service.requestNumber} - Scheduled\n`;
    message += `├─ Container: ${container.containerCode || 'Unknown'}\n`;
    message += `├─ Customer: ${customer.companyName || 'Unknown'}\n`;
    message += `├─ Location: ${location}\n`;
    message += `├─ Priority: ${service.priority || 'Normal'}\n`;
    message += `├─ Scheduled: ${formatTime(service.scheduledDate)}\n`;
    message += `└─ Issue: ${service.issueDescription?.substring(0, 50) || 'No description'}...\n\n`;
  }
  
  await sendTextMessage(from, message);
  
  // Create buttons for viewing details
  const buttons = futureServices.slice(0, 3).map((service: any) => ({
    id: `view_service_${service.id}`,
    title: `📄 ${service.requestNumber}`
  }));
  
  await sendInteractiveButtons(from, 'View service details:', buttons);
}

// ============================================================================
// SERVICE DETAIL VIEW
// ============================================================================

/**
 * Show detailed service information
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
  message += `📞 Contact: ${customer.phoneNumber || 'Not available'}\n`;
  message += `📍 Location: ${location}\n`;
  message += `⚠️ Priority: ${service.priority || 'Normal'}\n`;
  message += `📅 Scheduled: ${formatTime(service.scheduledDate)}\n\n`;
  message += `🔍 Issue Description:\n${service.issueDescription || 'No description provided'}\n\n`;
  message += `📊 Status: ${service.status.toUpperCase()}\n`;
  
  if (service.estimatedDuration) {
    message += `⏱️ Estimated Duration: ${service.estimatedDuration} minutes\n`;
  }
  
  const buttons = [];
  
  // Show appropriate buttons based on status
  if (service.status === 'scheduled') {
    buttons.push({ id: `start_service_${serviceId}`, title: '▶️ Start Service' });
  } else if (service.status === 'in_progress') {
    buttons.push({ id: `end_service_for_${serviceId}`, title: '🛑 End Service' });
  }
  
  buttons.push({ id: 'back_to_schedule', title: '🏠 Back to Schedule' });
  
  await sendTextMessage(from, message);
  await sendInteractiveButtons(from, 'What would you like to do?', buttons);
}

// ============================================================================
// SERVICE START FLOW
// ============================================================================

/**
 * Start a service request
 */
export async function startServiceRequest(
  from: string,
  user: any,
  serviceId: string,
  session: any,
  storage: any
): Promise<void> {
  try {
    const service = await storage.getServiceRequest(serviceId);
    
    if (!service) {
      await sendTextMessage(from, '❌ Service request not found.');
      return;
    }
    
    if (service.status === 'in_progress') {
      await sendTextMessage(from, '⚠️ This service is already in progress.');
      return;
    }
    
    // Update service status and record start time
    const startTime = new Date();
    const updatedService = await storage.updateServiceRequest(serviceId, {
      status: 'in_progress',
      startTime: startTime,
      actualStartTime: startTime
    });
    
    // Broadcast the update
    if ((global as any).broadcast) {
      (global as any).broadcast({ type: 'service_request_started', data: updatedService });
    }
    
    // Add to active services
    await addActiveService(session, serviceId, storage);
    
    // Send confirmation to technician
    await sendTextMessage(
      from,
      `✅ Service Started Successfully!\n\n⏱️ Timer is now running...\nStarted at: ${formatTime(startTime)}\n\n${service.requestNumber} is now IN PROGRESS\n\nTo return to menu, send "Hi"`
    );
    
    // Notify customer via WhatsApp
    try {
      const { customerCommunicationService } = await import('./whatsapp');
      await customerCommunicationService.notifyServiceRequestUpdate(serviceId, 'started');
    } catch (notifError) {
      console.error('[WhatsApp] Failed to send customer notification:', notifError);
    }
    
  } catch (error) {
    console.error('[WhatsApp] Error starting service:', error);
    await sendTextMessage(from, '❌ Error starting service. Please try again.');
  }
}

// ============================================================================
// SERVICE COMPLETION FLOW
// ============================================================================

/**
 * Initiate service completion flow
 */
export async function initiateServiceCompletion(
  from: string,
  user: any,
  serviceId: string,
  session: any,
  storage: any
): Promise<void> {
  try {
    const service = await storage.getServiceRequest(serviceId);
    
    if (!service) {
      await sendTextMessage(from, '❌ Service request not found.');
      return;
    }
    
    const startTime = service.startTime || service.actualStartTime;
    const duration = calculateDuration(startTime, new Date());
    
    // Update conversation state to track completion flow
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
      `📸 Step 1: Before/After Photos\n\nPlease upload:\n1️⃣ Before photos (if not uploaded during start)\n2️⃣ After photos (required)\n\nUpload photos now or type "SKIP" if before photos not applicable`
    );
    
    await sendInteractiveButtons(
      from,
      'Upload photos:',
      [
        { id: 'upload_photos_now', title: '📷 Upload Photos' },
        { id: 'skip_before_photos', title: '⏭️ Skip Before Photos' }
      ]
    );
    
  } catch (error) {
    console.error('[WhatsApp] Error initiating service completion:', error);
    await sendTextMessage(from, '❌ Error initiating completion. Please try again.');
  }
}

/**
 * Handle photo upload during completion
 */
export async function handlePhotoUploadStep(
  from: string,
  user: any,
  mediaId: string,
  session: any,
  storage: any
): Promise<void> {
  const step = session.conversationState?.completionStep;
  const serviceId = session.conversationState?.completingServiceId;
  
  if (!serviceId) {
    await sendTextMessage(from, '❌ No active completion flow. Please start service completion first.');
    return;
  }
  
  if (step === 'awaiting_before_photos') {
    const photos = session.conversationState?.uploadedBeforePhotos || [];
    photos.push(mediaId);
    
    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        ...session.conversationState,
        uploadedBeforePhotos: photos
      }
    });
    
    await sendTextMessage(
      from,
      `✅ Before photo received (${photos.length})\n\nSend more photos or type "DONE" to continue to after photos.`
    );
    
  } else if (step === 'awaiting_after_photos') {
    const photos = session.conversationState?.uploadedAfterPhotos || [];
    photos.push(mediaId);
    
    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        ...session.conversationState,
        uploadedAfterPhotos: photos
      }
    });
    
    await sendTextMessage(
      from,
      `✅ After photo received (${photos.length})\n\nSend more photos or type "DONE" to continue to signature upload.`
    );
  }
}

/**
 * Move to after photos step
 */
export async function moveToAfterPhotos(from: string, session: any, storage: any): Promise<void> {
  await storage.updateWhatsappSession(session.id, {
    conversationState: {
      ...session.conversationState,
      completionStep: 'awaiting_after_photos'
    }
  });
  
  await sendTextMessage(
    from,
    `📸 Now upload AFTER photos\n\nPlease upload photos showing the completed work.\n\nThis is REQUIRED to complete the service.`
  );
  
  await sendInteractiveButtons(
    from,
    'Upload after photos:',
    [{ id: 'upload_after_photos_now', title: '📷 Upload Photos' }]
  );
}

/**
 * Request signature upload
 */
export async function requestSignatureUpload(from: string, session: any, storage: any): Promise<void> {
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

/**
 * Handle signature upload
 */
export async function handleSignatureUpload(
  from: string,
  user: any,
  mediaId: string,
  session: any,
  storage: any
): Promise<void> {
  const serviceId = session.conversationState?.completingServiceId;
  
  if (!serviceId) {
    await sendTextMessage(from, '❌ No active completion flow.');
    return;
  }
  
  // Store signature media ID
  await storage.updateWhatsappSession(session.id, {
    conversationState: {
      ...session.conversationState,
      signatureMediaId: mediaId
    }
  });
  
  await sendTextMessage(from, '✅ Signature document received!');
  
  // Move to invoice prompt
  await requestInvoiceUpload(from, session, storage);
}

/**
 * Request invoice upload
 */
export async function requestInvoiceUpload(from: string, session: any, storage: any): Promise<void> {
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

/**
 * Handle invoice upload
 */
export async function handleInvoiceUpload(
  from: string,
  user: any,
  mediaId: string,
  session: any,
  storage: any
): Promise<void> {
  const serviceId = session.conversationState?.completingServiceId;
  
  if (!serviceId) {
    await sendTextMessage(from, '❌ No active completion flow.');
    return;
  }
  
  // Store invoice media ID
  await storage.updateWhatsappSession(session.id, {
    conversationState: {
      ...session.conversationState,
      invoiceMediaId: mediaId
    }
  });
  
  await sendTextMessage(from, '✅ Invoice received!');
  
  // Complete the service
  await completeServiceRequest(from, user, session, storage);
}

/**
 * Complete service request
 */
export async function completeServiceRequest(
  from: string,
  user: any,
  session: any,
  storage: any
): Promise<void> {
  try {
    const serviceId = session.conversationState?.completingServiceId;
    const beforePhotos = session.conversationState?.uploadedBeforePhotos || [];
    const afterPhotos = session.conversationState?.uploadedAfterPhotos || [];
    const signatureMediaId = session.conversationState?.signatureMediaId;
    const invoiceMediaId = session.conversationState?.invoiceMediaId;
    
    if (!serviceId) {
      await sendTextMessage(from, '❌ No active completion flow.');
      return;
    }
    
    const service = await storage.getServiceRequest(serviceId);
    const startTime = service.startTime || service.actualStartTime;
    const endTime = new Date();
    const durationMs = endTime.getTime() - new Date(startTime).getTime();
    const durationMinutes = Math.floor(durationMs / 60000);
    
    // Update service request with all completion data
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
    
    // Remove from active services
    await removeActiveService(session, serviceId, storage);
    
    // Clear completion state
    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        ...session.conversationState,
        completingServiceId: null,
        completionStep: null,
        uploadedBeforePhotos: [],
        uploadedAfterPhotos: [],
        signatureMediaId: null,
        invoiceMediaId: null
      }
    });
    
    // Send completion summary
    const duration = formatDurationMinutes(durationMinutes);
    const container = service.container || {};
    const customer = service.customer || {};
    
    let summary = `✅ Service Completed Successfully!\n\n`;
    summary += `📊 Service Summary:\n`;
    summary += `━━━━━━━━━━━━━━━━━━━━\n`;
    summary += `🆔 Request: ${service.requestNumber}\n`;
    summary += `📦 Container: ${container.containerCode || 'Unknown'}\n`;
    summary += `👤 Customer: ${customer.companyName || 'Unknown'}\n\n`;
    summary += `⏱️ Service Duration:\n`;
    summary += `   Started: ${formatTime(startTime)}\n`;
    summary += `   Completed: ${formatTime(endTime)}\n`;
    summary += `   Total Time: ${duration}\n\n`;
    summary += `📸 Uploaded Documents:\n`;
    summary += `   ✓ Before Photos: ${beforePhotos.length}\n`;
    summary += `   ✓ After Photos: ${afterPhotos.length}\n`;
    summary += `   ✓ Client Signature: ${signatureMediaId ? '✓' : '✗'}\n`;
    summary += `   ✓ Invoice: ${invoiceMediaId ? 'Yes' : 'No'}\n\n`;
    summary += `💬 Feedback Request sent to customer\n`;
    summary += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    summary += `Great work! 🎉`;
    
    await sendTextMessage(from, summary);
    
    // Send action buttons
    await sendInteractiveButtons(
      from,
      'What would you like to do next?',
      [
        { id: 'back_to_menu', title: '🏠 Return to Menu' },
        { id: 'view_schedule', title: '📅 View Schedule' }
      ]
    );
    
    // Notify customer via WhatsApp
    try {
      const { customerCommunicationService } = await import('./whatsapp');
      await customerCommunicationService.notifyServiceRequestUpdate(serviceId, 'completed');
    } catch (notifError) {
      console.error('[WhatsApp] Failed to send customer notification:', notifError);
    }
    
  } catch (error) {
    console.error('[WhatsApp] Error completing service:', error);
    await sendTextMessage(from, '❌ Error completing service. Please try again.');
  }
}

// ============================================================================
// CUSTOMER NOTIFICATIONS
// ============================================================================

/**
 * Notify customer when service starts
 */
async function notifyCustomerServiceStarted(service: any, technician: any, storage: any): Promise<void> {
  try {
    const customer = service.customer;
    
    if (!customer || !customer.whatsappNumber) {
      console.log('[WhatsApp] Customer has no WhatsApp number, skipping notification');
      return;
    }
    
    const container = service.container || {};
    
    const message = `🔔 Service Update\n\nYour service has been started!\n\n🔧 Service Request: ${service.requestNumber}\n👷 Technician: ${technician.name}\n📦 Container: ${container.containerCode || 'Unknown'}\n⏰ Started: ${formatTime(new Date())}\n\nWe'll notify you when the service is completed.`;
    
    await sendTextMessage(customer.whatsappNumber, message);
    
  } catch (error) {
    console.error('[WhatsApp] Error notifying customer of service start:', error);
  }
}

/**
 * Notify customer when service completes
 */
async function notifyCustomerServiceCompleted(service: any, technician: any, duration: string, storage: any): Promise<void> {
  try {
    const customer = service.customer;
    
    if (!customer || !customer.whatsappNumber) {
      console.log('[WhatsApp] Customer has no WhatsApp number, skipping notification');
      return;
    }
    
    const container = service.container || {};
    
    const message = `✅ Service Completed!\n\nYour service has been completed successfully.\n\n🔧 Service Request: ${service.requestNumber}\n👷 Technician: ${technician.name}\n📦 Container: ${container.containerCode || 'Unknown'}\n⏰ Completed: ${formatTime(new Date())}\n⏱️ Duration: ${duration}\n\n📋 Please provide your feedback:\n\nThank you for choosing Service Hub!`;
    
    await sendTextMessage(customer.whatsappNumber, message);
    
    // Send feedback request buttons
    await sendInteractiveButtons(
      customer.whatsappNumber,
      'Rate this service:',
      [
        { id: `feedback_${service.id}_5`, title: '⭐⭐⭐⭐⭐ Excellent' },
        { id: `feedback_${service.id}_4`, title: '⭐⭐⭐⭐ Good' },
        { id: `feedback_${service.id}_3`, title: '⭐⭐⭐ Average' }
      ]
    );
    
  } catch (error) {
    console.error('[WhatsApp] Error notifying customer of service completion:', error);
  }
}
