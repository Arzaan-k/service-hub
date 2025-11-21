import { config } from "dotenv";
config(); // Load environment variables

import axios from "axios";

// Import WhatsApp helper functions
import {
  sendTextMessage,
  sendInteractiveButtons,
  sendInteractiveList,
  sendImageMessage,
  sendVideoMessage,
  sendTemplateMessage,
  sendListMessage,
  authorizeWhatsAppMessage,
  updateWhatsAppTemplate,
  handleWebhook as handleWebhookHelper
} from './whatsapp-helpers';
// Re-export helpers so other modules can import from './whatsapp'
export {
  sendTextMessage,
  sendInteractiveButtons,
  sendInteractiveList,
  sendImageMessage,
  sendVideoMessage,
  sendTemplateMessage,
  sendListMessage,
  authorizeWhatsAppMessage,
  updateWhatsAppTemplate,
  // Additional helpers used by routes.ts
  formatAlertMessage,
  formatServiceScheduleMessage,
  sendMediaMessage,
  sendFlowMessage,
  formatCriticalAlertMessage,
  formatInvoiceMessage,
  formatFeedbackRequestMessage,
  sendTechnicianSchedule,
  sendServiceStartPrompt,
  sendServiceCompletePrompt,
  sendCustomerFeedbackRequest
} from './whatsapp-helpers';

// Import technician flow handlers
import {
  sendTechnicianMainMenu,
  showActiveServicesMenu,
  showScheduleDateSelection,
  showScheduleForToday,
  showScheduleForPrevious,
  showScheduleForFuture,
  showServiceDetails,
  startServiceRequest,
  initiateServiceCompletion,
  handlePhotoUploadStep,
  moveToAfterPhotos,
  requestSignatureUpload,
  handleSignatureUpload,
  requestInvoiceUpload,
  handleInvoiceUpload,
  completeServiceRequest
} from './whatsapp-technician-flows';

import {
  getActiveServices,
  getServiceIdByIndex
} from './whatsapp-technician-core';

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v20.0";
const WHATSAPP_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID || "";
const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WABA_ID || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "";
const WHATSAPP_TOKEN = process.env.CLOUD_API_ACCESS_TOKEN || "";
console.log('WHATSAPP_TOKEN in whatsapp.ts:', WHATSAPP_TOKEN ? 'SET' : 'NOT SET');

let RESOLVED_WABA_ID: string | null = WHATSAPP_BUSINESS_ACCOUNT_ID || null;

async function resolveWabaId(): Promise<string> {
  if (RESOLVED_WABA_ID) return RESOLVED_WABA_ID;
  if (!WHATSAPP_TOKEN) throw new Error("CLOUD_API_ACCESS_TOKEN is not set");

  // Prefer explicit business account id from env if present
  if (WHATSAPP_BUSINESS_ACCOUNT_ID) {
    RESOLVED_WABA_ID = WHATSAPP_BUSINESS_ACCOUNT_ID;
    return RESOLVED_WABA_ID;
  }

  // Try resolving via phone number id if available
  if (WHATSAPP_PHONE_NUMBER_ID) {
    try {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}?fields=whatsapp_business_account`;
      const resp = await axios.get(url, { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } });
  const id = resp.data?.whatsapp_business_account?.id;
      if (id) {
  RESOLVED_WABA_ID = id;
  return id;
      }
    } catch (e) {
      console.warn('[whatsapp] Could not auto-resolve WABA ID; set WABA_ID to avoid this warning');
    }
  }

  throw new Error('Unable to resolve WhatsApp Business Account ID. Set WABA_ID environment variable.');
}

const WHATSAPP_MESSAGES_URL = `https://graph.facebook.com/${GRAPH_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

function ensureWhatsAppConfig() {
  if (!WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error('WA_PHONE_NUMBER_ID is not configured');
  }
  if (!WHATSAPP_TOKEN) {
    throw new Error('CLOUD_API_ACCESS_TOKEN is not configured');
  }
}

function cleanPhone(number: string): string {
  return String(number || '').replace(/\D/g, '');
}

// Test number helpers (role-flow testing; production-safe)
// Allow configuration via env WHATSAPP_TEST_NUMBERS=comma,separated,digits
// Removed 918218994855 to use real data for Crystal Group
const DEFAULT_TEST_NUMBERS = ['917021307474', '7021307474'];
const ROLE_TEST_NUMBERS = new Set(
  (process.env.WHATSAPP_TEST_NUMBERS || '')
    .split(',')
    .map(s => s.trim())
    .filter(s => s)
    .map(cleanPhone)
    .filter(Boolean)
    .concat(DEFAULT_TEST_NUMBERS)
);
function isRoleTestNumber(input: string): boolean {
  return ROLE_TEST_NUMBERS.has(cleanPhone(input));
}

// ========================================
// ADDITIONAL HELPER FUNCTIONS
// ========================================

/**
 * Get progress indicator for client service request flow
 * Shows step number, progress bar, and emoji
 */
function getProgressIndicator(step: string): string {
  const steps: Record<string, { current: number; total: number; emoji: string; title: string }> = {
    'awaiting_container_number': { current: 1, total: 8, emoji: '📦', title: 'Container Selection' },
    'awaiting_error_code': { current: 2, total: 8, emoji: '⚠️', title: 'Error Code' },
    'awaiting_description': { current: 3, total: 8, emoji: '📝', title: 'Issue Description' },
    'awaiting_photos': { current: 4, total: 8, emoji: '📸', title: 'Photo Upload' },
    'awaiting_videos': { current: 5, total: 8, emoji: '🎥', title: 'Video Upload' },
    'awaiting_company_name': { current: 6, total: 8, emoji: '🏢', title: 'Company Name' },
    'awaiting_onsite_contact': { current: 7, total: 8, emoji: '📞', title: 'Onsite Contact' },
    'awaiting_site_address': { current: 8, total: 8, emoji: '📍', title: 'Site Address' }
  };

  const info = steps[step];
  if (!info) return '';

  const progressBar = '▓'.repeat(info.current) + '░'.repeat(info.total - info.current);
  return `${info.emoji} *Step ${info.current}/${info.total}: ${info.title}*\n${progressBar}\n\n`;
}

async function sendRealClientMenu(to: string, user?: any, customer?: any, selectedContainers?: any[]): Promise<void> {
  try {
    console.log(`[WhatsApp] sendRealClientMenu called for ${to}`);
    
    // Fetch customer data if not provided
    if (user && !customer) {
      const { storage } = await import('../storage');
      customer = await storage.getCustomerByUserId(user.id);
    }
    
    // Build message with selected containers if provided
    let message = '';
    
    if (selectedContainers && selectedContainers.length > 0) {
      // Show selected containers
      const containerCodes = selectedContainers.map((sc: any) => sc.containerCode).join(', ');
      message = `📦 *Selected:* ${containerCodes}\n\nHow can I help you today?`;
    } else {
      // Build personalized greeting (fallback for when no containers selected)
      let greeting = '👋 *Welcome to Service Hub!*';
      if (user && customer) {
        const userName = user.name || user.username || 'there';
        const companyName = customer.companyName || '';
        greeting = `👋 *Welcome ${userName}!*`;
        if (companyName) {
          greeting += `\n🏢 *${companyName}*`;
        }
      }
      message = `${greeting}\n\nHow can I help you today?`;
    }
    
    await sendInteractiveButtons(
      to,
      message,
      [
        { id: 'request_service', title: '🔧 Request Service' },
        { id: 'status', title: '📊 Check Status' }
      ]
    );
    console.log(`[WhatsApp] sendInteractiveButtons completed for ${to}`);
  } catch (error: any) {
    console.error(`[WhatsApp] Error in sendRealClientMenu for ${to}:`, error);
    console.error(`[WhatsApp] Error response:`, error.response?.data);
    console.error(`[WhatsApp] Error message:`, error.message);
    
    // Fallback: Send simple text message with instructions
    console.log(`[WhatsApp] Falling back to text message menu`);
    
    let message = '';
    if (selectedContainers && selectedContainers.length > 0) {
      const containerCodes = selectedContainers.map((sc: any) => sc.containerCode).join(', ');
      message = `📦 *Selected:* ${containerCodes}\n\nHow can I help you today?`;
    } else {
      let greeting = '👋 *Welcome to Service Hub!*';
      if (user && customer) {
        const userName = user.name || user.username || 'there';
        const companyName = customer.companyName || '';
        greeting = `👋 *Welcome ${userName}!*`;
        if (companyName) {
          greeting += `\n🏢 *${companyName}*`;
        }
      }
      message = `${greeting}\n\nHow can I help you today?`;
    }
    
    await sendTextMessage(
      to,
      `${message}\n\nReply with:\n• *service* - Request Service\n• *status* - Check Status`
    );
  }
}

async function showContainerStatus(from: string, containerId: string, storage: any): Promise<void> {
  try {
    const container = await storage.getContainer(containerId);
    if (!container) {
      await sendTextMessage(from, '❌ Container not found.');
      return;
    }

    const location = (container.currentLocation as any)?.address || (container.currentLocation as any)?.city || 'Unknown';
    const statusMessage = `📦 *Container Status*\n\n` +
      `🔖 Code: ${container.containerCode}\n` +
      `📍 Location: ${location}\n` +
      `📊 Status: ${container.status}\n` +
      `🏷️ Type: ${container.type}\n` +
      `💚 Health: ${container.healthScore || 'N/A'}%`;

    await sendTextMessage(from, statusMessage);
  } catch (error) {
    console.error('[WhatsApp] Error in showContainerStatus:', error);
    await sendTextMessage(from, '❌ Error fetching container status.');
  }
}

async function handleRealClientStatusCheck(from: string, user: any, session: any): Promise<void> {
  const { storage } = await import('../storage');
  
  try {
    const customer = await storage.getCustomerByUserId(user.id);
    if (!customer) {
      await sendTextMessage(from, '❌ Customer profile not found.');
      return;
    }

    const containers = await storage.getContainersByCustomer(customer.id);
    
    if (containers.length === 0) {
      await sendTextMessage(from, '📦 No containers assigned to your account.');
      return;
    }

    const rows = containers.map((c: any) => {
      const location = (c.currentLocation as any)?.address || (c.currentLocation as any)?.city || 'Unknown';
      return {
        id: `status_container_${c.id}`,
        title: c.containerCode,
        description: `${c.status} | ${location}`.substring(0, 72)
      };
    });

    await sendInteractiveList(
      from,
      `📊 *Container Status*\n\nYou have ${containers.length} container(s).\n\nSelect a container to view details:`,
      'View Status',
      [{ title: 'Your Containers', rows }]
    );
  } catch (error) {
    console.error('[WhatsApp] Error in handleRealClientStatusCheck:', error);
    await sendTextMessage(from, '❌ Error loading status.');
  }
}

async function handlePhotoChoice(wantsPhotos: boolean, from: string, user: any, session: any): Promise<void> {
  const { storage } = await import('../storage');
  
  try {
    const conversationState = session.conversationState || {};
    
    if (wantsPhotos) {
      await storage.updateWhatsappSession(session.id, {
        conversationState: {
          ...conversationState,
          step: 'awaiting_photos',
          beforePhotos: []
        }
      });

      await sendTextMessage(
        from,
        `📸 *Please send your photos now.*\n\nYou can send multiple images. When done, type *DONE* to submit the service request.`
      );
    } else {
      await createServiceRequestFromWhatsApp(from, user, session);
    }
  } catch (error) {
    console.error('[WhatsApp] Error in handlePhotoChoice:', error);
    await sendTextMessage(from, '❌ Error processing choice. Please try again.');
  }
}

const handleWebhook = handleWebhookHelper;

// Mock data for dedicated test flows
const MOCK_CONTAINERS = [
  {
    id: 'TEST001',
    type: 'refrigerated',
    status: 'active',
    location: 'Los Angeles',
    issue: 'Cooling system check',
    technician: 'John Doe',
    eta: '2 hours'
  },
  {
    id: 'TEST002',
    type: 'dry',
    status: 'active',
    location: 'Los Angeles',
    issue: 'Door seal integrity test',
    technician: 'Jane Smith',
    eta: '3 hours'
  },
  {
    id: 'TEST003',
    type: 'refrigerated',
    status: 'active',
    location: 'Los Angeles',
    issue: 'Sensor calibration review',
    technician: 'Mike Johnson',
    eta: '90 minutes'
  }
];

const MOCK_TECHNICIAN_JOBS = [
  {
    id: 'TEST001',
    label: 'Service TEST001 – 10:00 AM',
    type: 'Service',
    location: 'Los Angeles',
    status: 'Scheduled',
    client: 'ACME Logistics'
  },
  {
    id: 'TEST002',
    label: 'Inspect TEST002 – 2:30 PM',
    type: 'Inspection',
    location: 'Los Angeles',
    status: 'Scheduled',
    client: 'Harbor Traders'
  },
  {
    id: 'TEST003',
    label: 'Repair TEST003 – 5:00 PM',
    type: 'Repair',
    location: 'Los Angeles',
    status: 'Scheduled',
    client: 'Fresh Foods Inc'
  }
];

async function sendTestRoleSelectionMenu(to: string): Promise<void> {
  await sendInteractiveButtons(
    to,
    '🧪 Select role to test WhatsApp flow:',
    [
      { id: 'test_role_technician', title: '🔧 Technician' },
      { id: 'test_role_client', title: '🏢 Client' }
    ]
  );
}

async function sendTestClientMenu(to: string): Promise<void> {
  await sendInteractiveButtons(
    to,
    '🏢 Client Mode\n\nSelect an option to continue:',
    [
      { id: 'test_client_request_service', title: '🧰 Request Service' },
      { id: 'test_client_status', title: '📊 Status' },
      { id: 'switch_role', title: '🔄 Switch Role' }
    ]
  );
}

async function sendTestTechnicianMenu(to: string): Promise<void> {
  await sendInteractiveButtons(
    to,
    '🔧 Technician Mode\n\nSelect an option to continue:',
    [
      { id: 'test_tech_view_schedule', title: '📋 View Schedule' },
      { id: 'test_tech_start_service', title: '🧰 Start Service' },
      { id: 'switch_role', title: '🔄 Switch Role' }
    ]
  );
}

async function promptMockContainerSelection(to: string): Promise<void> {
  await sendInteractiveButtons(
    to,
    '🔧 Service Request\n\nWhich container needs service?',
    [
      { id: 'test_client_select_container', title: '📦 Select Container' }
    ]
  );
}

async function sendMockContainerList(to: string): Promise<void> {
  const bodyLines = ['📦 Select Container', ''];
  for (const c of MOCK_CONTAINERS) {
    bodyLines.push(`${c.id} – ${c.type}`);
    bodyLines.push(`Status: ${c.status} | Location: ${c.location}`);
    bodyLines.push('');
  }
  await sendInteractiveButtons(
    to,
    bodyLines.join('\n'),
    [
      { id: 'test_container_TEST001', title: 'TEST001' },
      { id: 'test_container_TEST002', title: 'TEST002' },
      { id: 'test_container_TEST003', title: 'TEST003' }
    ]
  );
}

function getMockContainerDetail(containerId: string) {
  return MOCK_CONTAINERS.find(container => container.id === containerId);
}

async function sendMockScheduleButtons(to: string): Promise<void> {
  await sendInteractiveButtons(
    to,
    '📅 Today\'s Schedule\n\nSelect a job to view details:',
    MOCK_TECHNICIAN_JOBS.map(job => ({
      id: `test_job_${job.id}`,
      title: job.label
    }))
  );
}

function getMockTechnicianJob(jobId: string) {
  return MOCK_TECHNICIAN_JOBS.find(job => job.id === jobId);
}

// ========================================
// REAL CLIENT MODE FUNCTIONS (Dashboard Integration)
// ========================================

/**
 * Handle real client service request flow - fetches actual containers from database
 */
async function handleRealClientRequestService(from: string, user: any, session: any): Promise<void> {
  const { storage } = await import('../storage');

  try {
    console.log(`[WhatsApp] handleRealClientRequestService - user: ${user.name} (${user.id}), phone: ${user.phoneNumber || from}`);

    let customer = await storage.getCustomerByUserId(user.id);
    if (!customer) {
      console.error(`[WhatsApp] Customer profile not found for user ${user.id}`);

      // Use the 'from' number (which is already the WhatsApp number) instead of user.phoneNumber
      const phoneToLookup = from || user.phoneNumber;
      console.log(`[WhatsApp] Attempting to find customer by phone number: ${phoneToLookup}`);

      // Generate all possible phone number variations using our normalization function
      const phoneVariations = normalizePhoneNumber(phoneToLookup);
      console.log(`[WhatsApp] Trying ${phoneVariations.length} phone variations for customer lookup:`, phoneVariations);

      // Try to find customer by phone number using all variations
      const allCustomers = await storage.getAllCustomers();
      for (const variation of phoneVariations) {
        customer = allCustomers.find((c: any) => {
          if (!c.phoneNumber) return false;
          const customerPhoneVariations = normalizePhoneNumber(c.phoneNumber);
          return customerPhoneVariations.includes(variation);
        });

        if (customer) {
          console.log(`[WhatsApp] ✅ Found customer by phone variation "${variation}": ${customer.companyName} (${customer.id})`);
          break;
        }
      }

      if (!customer) {
        console.error(`[WhatsApp] No customer found for any phone variation of ${phoneToLookup}`);
        await sendTextMessage(
          from,
          '❌ *Customer profile not found*\n\n' +
          'Please contact support to link your WhatsApp number with your account.\n\n' +
          `Your number: ${from}`
        );
        return;
      }
    }

    console.log(`[WhatsApp] Found customer: ${customer.companyName} (${customer.id})`);
    
    const containers = await storage.getContainersByCustomer(customer.id);
    console.log(`[WhatsApp] Fetched ${containers.length} containers for customer ${customer.id}`);
    console.log(`[WhatsApp] Container details:`, containers.map((c: any) => ({
      id: c.id,
      code: c.containerCode,
      status: c.status,
      currentCustomerId: c.currentCustomerId
    })));
    
    // Show all containers assigned to client, regardless of status
    // (deployed, sold, maintenance, etc. are all valid statuses)
    if (containers.length === 0) {
      console.error(`[WhatsApp] No containers found for customer ${customer.id} (${customer.companyName})`);
      await sendTextMessage(from, '❌ No containers assigned to your account. Please contact support.');
      return;
    }

    console.log(`[WhatsApp] Proceeding with ${containers.length} containers`);

    // Check if containers are already selected from initial verification
    const existingState = session.conversationState || {};
    const existingSelectedContainers = existingState.selectedContainers || [];

    // If containers already selected from verification, proceed directly to error code
    if (existingSelectedContainers.length > 0) {
      console.log(`[WhatsApp] Containers already selected from verification: ${existingSelectedContainers.length}`);
      
      // Get container codes for display
      const containerCodes = existingSelectedContainers.map((sc: any) => sc.containerCode);
      
      // Update session to error code step
      await storage.updateWhatsappSession(session.id, {
        conversationState: {
          ...existingState,
          flow: 'real_service_request',
          step: 'awaiting_error_code',
          customerId: customer.id
        }
      });
      
      // Send error code prompt with selected containers
      await sendTextMessage(
        from,
        `${getProgressIndicator('awaiting_error_code')}` +
        `📦 *Selected Container(s):*\n${containerCodes.join(', ')}\n\n` +
        `❓ *What error code are you seeing?*\n\n` +
        `Type the error code (e.g., E407), or reply *NA* if no error code.`
      );
      
      // Send reference videos to help client identify error codes
      await sendTextMessage(
        from,
        `🎥 *Reference Videos:*\nHere are helpful videos showing where to find error codes on different container types:`
      );

      // Video 1: Carrier Unit
      await sendVideoMessage(
        from,
        'https://res.cloudinary.com/dsnzo163t/video/upload/v1763700758/How_to_check_alarm_in_carrier_unit_bxqqzg.mp4',
        '🎥 How to check alarm in Carrier unit'
      );

      // Video 2: Thermoking MP-4000 Unit
      await sendVideoMessage(
        from,
        'https://res.cloudinary.com/dsnzo163t/video/upload/v1/How_to_check_alaram_in_mp_4000_unit_tharmoking_njc1pe.mp4',
        '🎥 How to check alarm in MP-4000 unit (Thermoking)'
      );

      // Video 3: Daikin Unit
      await sendVideoMessage(
        from,
        'https://res.cloudinary.com/dsnzo163t/video/upload/v1/How_to_check_return_temperature_supply_temperature_alarm_in_daikin_unit_nwaxew.mp4',
        '🎥 How to check return/supply temperature alarm in Daikin unit'
      );
      
      return;
    }

    // No containers selected yet - show container selection
    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        flow: 'real_service_request',
        step: 'awaiting_container_selection',
        customerId: customer.id,
        selectedContainers: []
      }
    });

    // Build message
    let message = '🔧 *Service Request*\n\n';
    message += 'Which container needs service?\n\n*Select a container from the list below.*';

    // Filter out already selected containers and mark them in the list
    const rows = containers.map((c: any) => {
      const isSelected = existingSelectedContainers.includes(c.id);
      const location = (c.currentLocation as any)?.address || (c.currentLocation as any)?.city || 'Unknown';
      const prefix = isSelected ? '✅ ' : '';
      return {
        id: `select_container_${c.id}`,
        title: `${prefix}${c.containerCode}`,
        description: `${c.type} | ${c.status} | ${location}`.substring(0, 72)
      };
    });

    await sendInteractiveList(
      from,
      message,
      'Select Container',
      [{ title: 'Your Containers', rows }]
    );
    
    // Send reference image for container ID location
    await sendImageMessage(
      from,
      'https://i.ibb.co/9ZQY5Qy/container-id-reference.jpg',
      '📍 *Container ID Location Reference*\n\nIf you don\'t know where the container ID is located, please refer to the image above.'
    );
    
    // Send instruction message
    await sendTextMessage(
      from,
      '📌 *Tip:* After selecting a container, you can add more containers or proceed with the request.'
    );
  } catch (error) {
    console.error('[WhatsApp] Error in handleRealClientRequestService:', error);
    await sendTextMessage(from, '❌ Error loading containers. Please try again.');
  }
}

/**
 * Handle container selection for service request (supports multi-select)
 */
async function handleContainerSelection(containerId: string, from: string, user: any, session: any): Promise<void> {
  const { storage } = await import('../storage');
  
  try {
    const container = await storage.getContainer(containerId);
    if (!container) {
      await sendTextMessage(from, '❌ Container not found.');
      return;
    }

    const conversationState = session.conversationState || {};
    const selectedContainers = conversationState.selectedContainers || [];
    
    // Add container to selection if not already selected
    if (!selectedContainers.includes(containerId)) {
      selectedContainers.push(containerId);
    }

    // Update session with selected container(s)
    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        ...conversationState,
        selectedContainers,
        step: 'awaiting_more_containers'
      }
    });

    // Get container codes for display
    const containerCodes = [];
    for (const cId of selectedContainers) {
      const c = await storage.getContainer(cId);
      if (c) containerCodes.push(c.containerCode);
    }

    // Ask if they want to add more containers or proceed
    await sendTextMessage(
      from,
      `✅ *Container Added*\n\n📦 Selected: ${containerCodes.join(', ')}\n\n*Would you like to add more containers or proceed?*`
    );
    
    await sendInteractiveButtons(
      from,
      'Choose an option:',
      [
        { id: 'add_more_containers', title: '➕ Add More' },
        { id: 'proceed_with_selection', title: '✅ Proceed' }
      ]
    );
  } catch (error) {
    console.error('[WhatsApp] Error in handleContainerSelection:', error);
    await sendTextMessage(from, '❌ Error processing selection. Please try again.');
  }
}

/**
 * Handle error code input from client
 */
async function handleErrorCodeInput(errorCode: string, from: string, user: any, session: any): Promise<void> {
  const { storage } = await import('../storage');
  
  try {
    const conversationState = session.conversationState || {};
    
    // Update session with error code
    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        ...conversationState,
        errorCode: errorCode,
        step: 'awaiting_description'
      }
    });

    // If error code is NA, send reference videos
    if (errorCode.toUpperCase() === 'NA') {
      await sendTextMessage(
        from,
        `✅ No error code noted.\n\n🎥 *Here are reference videos to help identify error codes:*`
      );
      
      // Video 1: Carrier Unit
      await sendVideoMessage(
        from,
        'https://res.cloudinary.com/dsnzo163t/video/upload/v1763700758/How_to_check_alarm_in_carrier_unit_bxqqzg.mp4',
        '🎥 How to check alarm in Carrier unit'
      );

      // Video 2: Thermoking MP-4000 Unit
      await sendVideoMessage(
        from,
        'https://res.cloudinary.com/dsnzo163t/video/upload/v1/How_to_check_alaram_in_mp_4000_unit_tharmoking_njc1pe.mp4',
        '🎥 How to check alarm in MP-4000 unit (Thermoking)'
      );

      // Video 3: Daikin Unit
      await sendVideoMessage(
        from,
        'https://res.cloudinary.com/dsnzo163t/video/upload/v1/How_to_check_return_temperature_supply_temperature_alarm_in_daikin_unit_nwaxew.mp4',
        '🎥 How to check return/supply temperature alarm in Daikin unit'
      );
    } else {
      await sendTextMessage(
        from,
        `✅ Error code received: *${errorCode}*`
      );
    }

    await sendTextMessage(
      from,
      `${getProgressIndicator('awaiting_description')}` +
      `📝 *Please describe what's happening with the container.*\n\n` +
      `Keep it brief (2-3 sentences).`
    );
  } catch (error) {
    console.error('[WhatsApp] Error in handleErrorCodeInput:', error);
    await sendTextMessage(from, '❌ Error processing error code. Please try again.');
  }
}

async function handleIssueDescriptionInput(description: string, from: string, user: any, session: any): Promise<void> {
  const { storage } = await import('../storage');
  
  try {
    const conversationState = session.conversationState || {};
    
    // Update session with description and move to photo upload (mandatory)
    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        ...conversationState,
        issueDescription: description,
        step: 'awaiting_photos',
        beforePhotos: []
      }
    });

    await sendTextMessage(
      from,
      `${getProgressIndicator('awaiting_photos')}` +
      `✅ Description received.\n\n` +
      `📸 *Please attach photos of the issue.*\n\n` +
      `⚠️ *Photo upload is mandatory.*\n\n` +
      `Send one or more photos, then type *DONE* to continue.`
    );
  } catch (error) {
    console.error('[WhatsApp] Error in handleIssueDescriptionInput:', error);
    await sendTextMessage(from, '❌ Error processing description. Please try again.');
  }
}

async function handlePhotoUpload(mediaId: string, from: string, user: any, session: any): Promise<void> {
  const { storage } = await import('../storage');
  
  try {
    const conversationState = session.conversationState || {};
    const beforePhotos = conversationState.beforePhotos || [];
    
    // Store media ID with wa: prefix for consistency with media endpoint
    beforePhotos.push(`wa:${mediaId}`);
    
    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        ...conversationState,
        beforePhotos
      }
    });

    await sendTextMessage(
      from,
      `✅ Photo ${beforePhotos.length} received.\n\nSend more photos or type *DONE* to continue.`
    );
  } catch (error) {
    console.error('[WhatsApp] Error in handlePhotoUpload:', error);
    await sendTextMessage(from, '❌ Error processing photo. Please try again.');
  }
}

async function handleVideoUpload(mediaId: string, from: string, user: any, session: any): Promise<void> {
  const { storage } = await import('../storage');
  
  try {
    const conversationState = session.conversationState || {};
    const videos = conversationState.videos || [];
    
    // Store video media ID with wa: prefix for consistency with media endpoint
    videos.push(`wa:${mediaId}`);
    
    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        ...conversationState,
        videos
      }
    });

    await sendTextMessage(
      from,
      `✅ Video ${videos.length} received.\n\nSend more videos or type *DONE* to submit the request.`
    );
  } catch (error) {
    console.error('[WhatsApp] Error in handleVideoUpload:', error);
    await sendTextMessage(from, '❌ Error processing video. Please try again.');
  }
}

function buildPreferredContactDateRows(days = 5): Array<{ id: string; title: string; description: string }> {
  const rows: Array<{ id: string; title: string; description: string }> = [];
  const today = new Date();

  for (let i = 0; i < days; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const iso = date.toISOString().split('T')[0];
    const friendly = date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });

    let description = 'Choose this date';
    if (i === 0) description = 'Today';
    if (i === 1) description = 'Tomorrow';

    rows.push({
      id: `contact_date_${iso}`,
      title: friendly,
      description
    });
  }

  rows.push({
    id: 'contact_date_no_preference',
    title: 'No Preference',
    description: 'I can talk anytime'
  });

  return rows;
}

async function promptPreferredContactDate(from: string, user: any): Promise<void> {
  const rows = buildPreferredContactDateRows();
  await sendInteractiveList(
    from,
    `📅 *Preferred Contact Date*\n\n${user?.name ? `${user.name}, ` : ''}when should our technician call you to discuss the issue?`,
    'Select Date',
    [{ title: 'Available Dates', rows }]
  );

  await sendTextMessage(
    from,
    'If none of the dates above work, reply with your preferred date/time (e.g., "2025-11-20 3 PM") or type *No preference*.'
  );
}

function formatPreferredContactDisplay(value: string | undefined | null): string {
  if (!value) return 'Not provided';

  const lower = value.toLowerCase();
  if (lower === 'no preference') {
    return 'No preference';
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  return value;
}

async function finalizePreferredContactSelection(rawValue: string, from: string, user: any, session: any): Promise<void> {
  const { storage } = await import('../storage');
  const conversationState = session.conversationState || {};
  const normalizedValue = rawValue?.toLowerCase() === 'no preference' ? 'No preference' : rawValue;
  const updatedState = {
    ...conversationState,
    preferredContactDate: normalizedValue,
    step: 'preferred_contact_captured'
  };

  await storage.updateWhatsappSession(session.id, {
    conversationState: updatedState
  });
  session.conversationState = updatedState;

  const display = formatPreferredContactDisplay(normalizedValue);
  await sendTextMessage(
    from,
    normalizedValue.toLowerCase() === 'no preference'
      ? '📅 Noted! A technician will reach out as soon as possible.'
      : `📅 Great! We'll have a technician call you on *${display}*.`
  );

  await createServiceRequestFromWhatsApp(from, user, session);
}

async function createServiceRequestFromWhatsApp(from: string, user: any, session: any): Promise<void> {
  const { storage } = await import('../storage');

  try {
    const conversationState = session.conversationState || {};
    const {
      issueDescription,
      errorCode,
      beforePhotos,
      selectedContainers,
      videos,
      customerId: sessionCustomerId,
      preferredContactDate,
      companyName,
      onsiteContact,
      siteAddress
    } = conversationState;

    console.log('[WhatsApp] Creating service request from WhatsApp:', {
      userId: user.id,
      phoneNumber: from,
      sessionCustomerId,
      selectedContainers,
      errorCode,
      photoCount: beforePhotos?.length || 0,
      videoCount: videos?.length || 0,
      preferredContactDate
    });

    // Determine the correct customer ID from the selected container (primary source of truth)
    let customerId = sessionCustomerId;
    
    if (selectedContainers && selectedContainers.length > 0) {
      const firstContainer = selectedContainers[0];
      // Handle both object format (new) and potential string format (old/fallback)
      if (typeof firstContainer === 'object' && firstContainer.customerId) {
        customerId = firstContainer.customerId;
        console.log(`[WhatsApp] Using customer ID from selected container: ${customerId}`);
      }
    }

    if (!preferredContactDate) {
      console.warn('[WhatsApp] Preferred contact date missing, prompting user before creating request');
      const updatedState = {
        ...conversationState,
        step: 'awaiting_preferred_contact'
      };
      await storage.updateWhatsappSession(session.id, {
        conversationState: updatedState
      });
      session.conversationState = updatedState;
      await promptPreferredContactDate(from, user);
      return;
    }

    // Detailed validation with specific error messages
    if (!customerId) {
      console.error('[WhatsApp] CRITICAL: Missing customerId in conversation state:', JSON.stringify(conversationState, null, 2));
      await sendTextMessage(
        from,
        `❌ *Customer information missing*\n\n` +
        `This might be a technical issue. Please try again:\n\n` +
        `1. Type *hi* to restart\n` +
        `2. Select "Request Service"\n\n` +
        `If the problem persists, please contact support.`
      );
      return;
    }

    if (!selectedContainers || selectedContainers.length === 0) {
      console.error('[WhatsApp] No containers selected. State:', conversationState);
      await sendTextMessage(from, '❌ No containers selected. Please type *hi* to start again.');
      return;
    }

    if (!beforePhotos || beforePhotos.length === 0) {
      console.error('[WhatsApp] No photos uploaded. State:', conversationState);
      await sendTextMessage(
        from,
        `❌ *Photo upload is mandatory*\n\n` +
        `Please type *hi* to start again and make sure to upload at least one photo.`
      );
      return;
    }

    // Get all container details
    // Handle both old format (array of IDs) and new format (array of objects with {id, containerCode, customerId})
    const containerNames = [];
    const validContainers = [];

    for (const item of selectedContainers) {
      // Check if item is an object (new format) or string (old format)
      const containerId = typeof item === 'object' ? item.id : item;
      const containerCode = typeof item === 'object' ? item.containerCode : null;
      
      const container = await storage.getContainer(containerId);
      if (!container) {
        console.warn(`[WhatsApp] Container ${containerId} not found, skipping`);
        continue;
      }
      containerNames.push(containerCode || container.containerCode || containerId);
      validContainers.push(container);
    }

    if (validContainers.length === 0) {
      console.error('[WhatsApp] No valid containers found');
      await sendTextMessage(
        from,
        `❌ *Could not create service request*\n\n` +
        `Selected containers may not be valid. Please contact support.`
      );
      return;
    }

    // Create SINGLE service request with first container as primary
    // List all other containers in the description
    const primaryContainer = validContainers[0];
    const otherContainers = validContainers.slice(1);

    let fullDescription = issueDescription || 'Service requested via WhatsApp';

    // Add error code if provided
    if (errorCode && errorCode.toUpperCase() !== 'NA') {
      fullDescription += `\n\nError Code: ${errorCode}`;
    }

    // Add all container codes if multiple containers
    if (validContainers.length > 1) {
      fullDescription += `\n\n📦 Multiple Containers: ${containerNames.join(', ')}`;
      fullDescription += `\n\nPrimary Container: ${primaryContainer.containerCode}`;
      fullDescription += `\nAdditional Containers: ${otherContainers.map(c => c.containerCode).join(', ')}`;
    }

    // Add site information
    if (companyName) {
      fullDescription += `\n\n🏢 Company Name: ${companyName}`;
    }
    if (onsiteContact) {
      fullDescription += `\n📞 Onsite Contact: ${onsiteContact}`;
    }
    if (siteAddress) {
      fullDescription += `\n📍 Site Address: ${siteAddress}`;
    }

    if (preferredContactDate) {
      fullDescription += `\n\n☎️ Preferred Technician Call: ${formatPreferredContactDisplay(preferredContactDate)}`;
    }

    console.log(`[WhatsApp] Creating SINGLE service request for ${validContainers.length} container(s):`, {
      primaryContainerId: primaryContainer.id,
      allContainers: containerNames.join(', '),
      customerId,
      errorCode,
      descriptionLength: fullDescription.length
    });

    const serviceRequest = await storage.createServiceRequest({
      requestNumber: `SR-${Date.now()}${Math.floor(Math.random() * 1000)}`,
      containerId: primaryContainer.id,
      customerId: customerId,
      priority: 'normal',
      status: 'pending',
      issueDescription: fullDescription,
      clientUploadedPhotos: beforePhotos || [], // Client's uploaded photos during service request creation
      clientUploadedVideos: videos || [], // Client's uploaded videos during service request creation
      createdBy: user.id,
      createdAt: new Date(),
      requestedAt: new Date()
    });

    console.log(`[WhatsApp] ✅ Service request created successfully: ${serviceRequest.requestNumber} for ${validContainers.length} container(s)`);

    // Save the created service request ID for linking future messages
    const firstServiceRequestId = serviceRequest.id;
    const createdRequests = [serviceRequest];

    // Link all recent WhatsApp messages from this user to the service request
    // This retroactively links photos/videos that were uploaded during the request creation
    if (firstServiceRequestId) {
      try {
        const recentMessages = await storage.getRecentWhatsAppMessages(user.id, 20);

        // Update messages using storage methods to avoid import issues
        const messagesToUpdate = recentMessages.filter(msg => !msg.relatedEntityId);

        if (messagesToUpdate.length > 0) {
          // Use SQL to update messages directly through storage
          const { neon } = await import('@neondatabase/serverless');
          const dbSql = neon(process.env.DATABASE_URL!);

          for (const msg of messagesToUpdate) {
            await dbSql`
              UPDATE whatsapp_messages
              SET related_entity_type = 'ServiceRequest',
                  related_entity_id = ${firstServiceRequestId}
              WHERE id = ${msg.id}
            `;
          }
          console.log(`[WhatsApp] ✅ Linked ${messagesToUpdate.length} messages to service request ${firstServiceRequestId}`);
        }
      } catch (linkError) {
        console.error('[WhatsApp] Error linking messages to service request:', linkError);
        // Don't fail the whole flow if linking fails
      }
    }

    // Update conversation state - keep track of last created service request
    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        lastCreatedServiceRequestId: firstServiceRequestId
      }
    });

    // Send detailed confirmation
    const photoCount = beforePhotos?.length || 0;
    const videoCount = videos?.length || 0;

    // Build confirmation message with all collected information
    let confirmationMessage = `✅ *Service Request Created Successfully!*\n\n` +
      `📋 *Request Number:* ${serviceRequest.requestNumber}\n` +
      `📦 *Container${validContainers.length > 1 ? 's' : ''}:* ${containerNames.join(', ')}\n` +
      `⚠️ *Error Code:* ${errorCode || 'None'}\n`;
    
    // Add site information if provided
    if (companyName) {
      confirmationMessage += `🏢 *Company:* ${companyName}\n`;
    }
    if (onsiteContact) {
      confirmationMessage += `📞 *Onsite Contact:* ${onsiteContact}\n`;
    }
    if (siteAddress) {
      confirmationMessage += `📍 *Site Address:* ${siteAddress}\n`;
    }
    
    confirmationMessage += `📸 *Photos:* ${photoCount}\n` +
      `🎥 *Videos:* ${videoCount}\n\n` +
      `✅ *What happens next?*\n` +
      `• Our team will review your request\n` +
      `• A technician will be assigned\n` +
      `• You'll receive updates via WhatsApp\n\n` +
      `Type *hi* to return to menu or *status* to check progress.`;

    await sendTextMessage(from, confirmationMessage);

    console.log('[WhatsApp] ✅ Service request flow completed successfully');

    // Don't show menu again - user can type 'hi' if needed (as mentioned in confirmation)

  } catch (error: any) {
    console.error('[WhatsApp] CRITICAL ERROR in createServiceRequestFromWhatsApp:', {
      function: 'createServiceRequestFromWhatsApp',
      userId: user.id,
      phoneNumber: from,
      customerId: session.conversationState?.customerId,
      selectedContainers: session.conversationState?.selectedContainers,
      errorMessage: error.message,
      errorStack: error.stack,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
    });

    const errorRef = `ERR-${Date.now()}`;
    await sendTextMessage(
      from,
      `❌ *Error creating service request*\n\n` +
      `Reference: ${errorRef}\n\n` +
      `📞 Please contact support with this reference number.\n` +
      `We'll help you complete your request.\n\n` +
      `Type *hi* to return to menu.`
    );
  }
}


// Helper function to handle client container status requests
async function handleClientContainerStatus(from: string, customer: any, storage: any): Promise<void> {
  // Check if this is the test number and add mock containers if none exist
  const isTestNumber = typeof from === 'string' && isRoleTestNumber(from);
  let containers = await storage.getContainersByCustomer(customer.id);

  // For test number, add mock containers if none exist
  if (isTestNumber && (!containers || containers.length === 0)) {
    console.log('🧪 Adding mock containers for client status testing');

    // Create mock containers
    const mockContainers = [
      { code: 'CNT-TEST-001', type: 'refrigerated', status: 'active', issue: 'Temperature fluctuations' },
      { code: 'CNT-TEST-002', type: 'dry', status: 'active', issue: 'Door sensor fault' },
      { code: 'CNT-TEST-003', type: 'special', status: 'maintenance', issue: 'Power supply issues' }
    ];

    for (const mock of mockContainers) {
      let container = await storage.getContainerByCode(mock.code);
      if (!container) {
        container = await storage.createContainer({
          containerCode: mock.code,
          type: mock.type,
          status: mock.status,
          hasIot: true,
          currentCustomerId: customer.id,
          currentLocation: { lat: 28.6139, lng: 77.2090, address: 'Test Location' },
          healthScore: Math.floor(Math.random() * 40) + 60 // 60-100
        });

        // Create some mock alerts for variety
        if (mock.issue !== 'Door sensor fault') {
          await storage.createAlert({
            alertCode: `TEST-${Date.now()}`,
            containerId: container.id,
            severity: mock.status === 'maintenance' ? 'high' : 'medium',
            status: 'open',
            title: mock.issue,
            description: `Test alert for ${mock.issue}`,
            errorCode: 'TEST_001',
            detectedAt: new Date(),
            source: 'simulation'
          });
        }
      }
    }

    // Re-fetch containers
    containers = await storage.getContainersByCustomer(customer.id);
  }

  const containersByStatus = containers.reduce((acc: any, container: any) => {
    acc[container.status] = (acc[container.status] || 0) + 1;
    return acc;
  }, {});

      const alerts = await storage.getOpenAlerts();
  const criticalAlerts = alerts.filter((alert: any) => alert.severity === 'critical' && 
    containers.some((c: any) => c.id === alert.containerId));

  let statusMessage = `📊 *Container Status for ${customer.companyName}*\n\n`;
  statusMessage += `📦 Total Containers: ${containers.length}\n\n`;
  
  Object.entries(containersByStatus).forEach(([status, count]) => {
    const emoji = getStatusEmoji(status);
    statusMessage += `${emoji} ${status.charAt(0).toUpperCase() + status.slice(1)}: ${count}\n`;
  });

  if (criticalAlerts.length > 0) {
    statusMessage += `\n🚨 Critical Alerts: ${criticalAlerts.length}\n`;
  }

  statusMessage += `\n📅 Last Updated: ${new Date().toLocaleString()}`;

  await sendTextMessage(from, statusMessage);
}

// Helper function to handle client service requests
async function handleClientServiceRequests(from: string, customer: any, user: any, session: any, storage: any): Promise<void> {
  const serviceRequests = await storage.getServiceRequestsByCustomer(customer.id);
  const pendingRequests = serviceRequests.filter((sr: any) => 
    ['pending', 'approved', 'scheduled', 'in_progress'].includes(sr.status));
  const recentCompleted = serviceRequests.filter((sr: any) => sr.status === 'completed')
    .sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 3);

  let message = `🔧 *Service Requests for ${customer.companyName}*\n\n`;
  
  if (pendingRequests.length > 0) {
    message += `⏳ Active Requests: ${pendingRequests.length}\n`;
    pendingRequests.slice(0, 3).forEach((sr: any) => {
      message += `• ${sr.requestNumber} - ${sr.status.toUpperCase()}\n`;
    });
  }

  if (recentCompleted.length > 0) {
    message += `\n✅ Recent Completed: ${recentCompleted.length}\n`;
    recentCompleted.forEach((sr: any) => {
      message += `• ${sr.requestNumber} - Completed\n`;
    });
  }

  message += `\nWould you like to create a new service request?`;

  await sendInteractiveButtons(from, message, [
    { id: 'create_service_request', title: '➕ New Request' },
    { id: 'view_request_details', title: '👁️ View Details' }
  ]);
}

// Helper function to handle client invoices
async function handleClientInvoices(from: string, customer: any, storage: any): Promise<void> {
      const invoices = await storage.getInvoicesByCustomer(customer.id);
      const pendingInvoices = invoices.filter((inv: any) => inv.paymentStatus === 'pending');
  const overdueInvoices = invoices.filter((inv: any) => inv.paymentStatus === 'overdue');
  const totalPending = pendingInvoices.reduce((sum: number, inv: any) => sum + parseFloat(inv.totalAmount), 0);

  let message = `💰 *Invoice Summary for ${customer.companyName}*\n\n`;
  
  if (overdueInvoices.length > 0) {
    message += `🚨 Overdue Invoices: ${overdueInvoices.length}\n`;
  }

      if (pendingInvoices.length > 0) {
    message += `⏳ Pending Invoices: ${pendingInvoices.length}\n`;
    message += `💳 Total Pending: ₹${totalPending.toFixed(2)}\n\n`;
    
    message += `Recent Pending:\n`;
    pendingInvoices.slice(0, 3).forEach((inv: any) => {
      message += `• ${inv.invoiceNumber} - ₹${inv.totalAmount}\n`;
    });
      } else {
    message += `✅ All invoices are up to date!\n`;
  }

  message += `\n📊 Payment Terms: ${customer.paymentTerms.toUpperCase()}`;

  await sendTextMessage(from, message);
}

// Helper function to handle client alerts
async function handleClientAlerts(from: string, customer: any, storage: any): Promise<void> {
  const containers = await storage.getContainersByCustomer(customer.id);
  const containerIds = containers.map((c: any) => c.id);
  const alerts = await storage.getOpenAlerts();
  const clientAlerts = alerts.filter((alert: any) => containerIds.includes(alert.containerId));
  
  const alertsByType = clientAlerts.reduce((acc: any, alert: any) => {
    acc[alert.alertType] = (acc[alert.alertType] || 0) + 1;
    return acc;
  }, {});

  let message = `🚨 *Active Alerts for ${customer.companyName}*\n\n`;
  
  if (clientAlerts.length === 0) {
    message += `✅ No active alerts for your containers!`;
  } else {
    message += `Total Alerts: ${clientAlerts.length}\n\n`;
    
    Object.entries(alertsByType).forEach(([type, count]) => {
      const emoji = getAlertEmoji(type);
      message += `${emoji} ${type.charAt(0).toUpperCase() + type.slice(1)}: ${count}\n`;
    });
    
    const criticalAlerts = clientAlerts.filter((a: any) => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      message += `\n🆘 Critical Issues Requiring Immediate Attention: ${criticalAlerts.length}`;
    }
  }

  await sendTextMessage(from, message);
}

// Helper function to handle container tracking
async function handleClientContainerTracking(from: string, customer: any, storage: any): Promise<void> {
  const containers = await storage.getContainersByCustomer(customer.id);
  const activeContainers = containers.filter((c: any) => c.status === 'active');
  
  let message = `📍 *Container Tracking for ${customer.companyName}*\n\n`;
  
  if (activeContainers.length === 0) {
    message += `No active containers to track.`;
  } else {
    message += `Active Containers: ${activeContainers.length}\n\n`;
    
    for (const container of activeContainers.slice(0, 5)) {
      message += `📦 ${container.containerCode}\n`;
      if (container.currentLocation) {
        message += `   📍 Last Location: Available\n`;
      } else {
        message += `   📍 Location: Not Available\n`;
      }
      message += `   📊 Status: ${container.status}\n\n`;
    }
    
    if (activeContainers.length > 5) {
      message += `... and ${activeContainers.length - 5} more containers`;
    }
  }

  await sendTextMessage(from, message);
}

// Helper function to handle service history
async function handleClientServiceHistory(from: string, customer: any, storage: any): Promise<void> {
  const serviceRequests = await storage.getServiceRequestsByCustomer(customer.id);
  const completedServices = serviceRequests.filter((sr: any) => sr.status === 'completed')
    .sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 10);

  let message = `📋 *Service History for ${customer.companyName}*\n\n`;
  
  if (completedServices.length === 0) {
    message += `No completed services found.`;
  } else {
    message += `Recent Services (${completedServices.length}):NN`;
    
    completedServices.forEach((sr: any, index: number) => {
      message += `${index + 1}. ${sr.requestNumber}\n`;
      message += `   📅 ${new Date(sr.completedAt).toLocaleDateString()}\n`;
      message += `   💰 Cost: ₹${sr.totalCost || 'TBD'}\n\n`;
    });
  }

  await sendTextMessage(from, message);
}

// Helper function to get status emojis
function getStatusEmoji(status: string): string {
  const emojis: { [key: string]: string } = {
    'active': '🟢',
    'in_service': '🔧',
    'maintenance': '⚠️',
    'retired': '🔴',
    'in_transit': '🚚',
    'for_sale': '💰',
    'sold': '✅'
  };
  return emojis[status] || '⚪';
}

// Helper function to get alert emojis
function getAlertEmoji(type: string): string {
  const emojis: { [key: string]: string } = {
    'temperature': '🌡️',
    'power': '🔋',
    'connectivity': '📶',
    'door': '🚪',
    'error': '❌',
    'warning': '⚠️',
    'info': 'ℹ️',
    'system': '⚙️'
  };
  return emojis[type] || '🚨';
}

// Handle technician text messages with enhanced role-based features
async function handleTechnicianTextMessage(text: string, from: string, user: any, roleData: any, session: any): Promise<void> {
  const { storage } = await import('../storage');
  const conversationState = session.conversationState || {};
  const technician = roleData; // roleData is the technician data for technicians

  // NEW: Handle "DONE" during photo upload flow
  if (text.toUpperCase() === 'DONE' && conversationState.completingServiceId) {
    const completionStep = conversationState.completionStep;
    
    if (completionStep === 'awaiting_before_photos') {
      await moveToAfterPhotos(from, session, storage);
      return;
    }
    
    if (completionStep === 'awaiting_after_photos') {
      await requestSignatureUpload(from, session, storage);
      return;
    }
  }

  // NEW: Handle "SKIP" during before photos
  if (text.toUpperCase() === 'SKIP' && conversationState.completionStep === 'awaiting_before_photos') {
    await moveToAfterPhotos(from, session, storage);
    return;
  }

  // NEW: Handle "Hi" to show active services or main menu
  if (text.toLowerCase() === 'hi' || text.toLowerCase() === 'hello') {
    const activeServices = getActiveServices(session);
    if (activeServices.length > 0) {
      await showActiveServicesMenu(from, user, session, storage);
    } else {
      await sendTechnicianMainMenu(from, user, storage);
    }
    return;
  }

  // Check for awaiting date input
  if (conversationState.awaiting_date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateRegex.test(text)) {
      await handleTechnicianScheduleForDate(from, technician, storage, text);
      await storage.updateWhatsappSession(session.id, {
        conversationState: { ...conversationState, awaiting_date: false }
      });
      return;
    } else {
      await sendTextMessage(from, '❌ Invalid date format. Please use YYYY-MM-DD format (e.g., 2025-10-25)');
      return;
    }
  }

  const { classifyTechnicianIntent } = await import('./gemini');

  // AI-guided strict-but-flexible intent classification
  const todays = await storage.getTechnicianSchedule(technician.id, new Date().toISOString());
  const ai = await classifyTechnicianIntent(text, {
    hasActiveSelection: Boolean(session.conversationState?.currentServiceId),
    todaysServices: (todays || []).map((r: any) => ({ id: r.id, requestNumber: r.requestNumber })),
    step: session.conversationState?.step
  });

  // Map intents to actions; fallback to rule keywords
  switch (ai.intent) {
    case 'view_profile': {
      await sendTextMessage(from, `👤 Profile\n\nName: ${user.name}\nCode: ${technician.employeeCode}\nStatus: ${technician.status}`);
      return;
    }
    case 'view_schedule': {
      await handleTechnicianSchedule(from, technician, storage);
      return;
    }
    case 'start_service':
    case 'select_service': {
      await presentTechnicianServiceList(from, technician, storage, session);
      return;
    }
    case 'confirm_start_service': {
      await startService(from, user, session.conversationState);
      return;
    }
    case 'upload_before_photos': {
      await setAwaitingUploadStep('awaiting_before_photos', from, session, storage);
      return;
    }
    case 'upload_after_photos': {
      await setAwaitingUploadStep('awaiting_after_photos', from, session, storage);
      return;
    }
    case 'upload_report':
    case 'upload_photos': {
      await setAwaitingUploadStep('awaiting_report', from, session, storage);
      return;
    }
    case 'complete_service': {
      await completeService(from, user, session.conversationState);
      return;
    }
    case 'back': {
      // Clear current selection and return to main menu
      await storage.updateWhatsappSession(session.id, { conversationState: {} });
    await sendInteractiveButtons(
        from,
        `👋 Hello ${user.name}!\n\n🔧 Employee Code: ${technician.employeeCode}\n📍 Status: ${technician.status.toUpperCase()}\n\nWhat would you like to do?`,
        [
        { id: 'view_profile', title: '👤 View Profile' },
          { id: 'view_schedule', title: '📋 View Schedule' },
          { id: 'start_service', title: '🔧 Start Service' },
        { id: 'update_status', title: '📊 Update Status' },
          { id: 'emergency_help', title: '🆘 Emergency' }
        ]
      );
      return;
    }
    case 'help':
      // fallthrough to keyword help below
      break;
    case 'unknown':
    default:
      break;
  }

  // Keyword fallback
  if (text.includes('schedule') || text.includes('today')) {
    await handleTechnicianSchedule(from, technician, storage);
  } else if (text.includes('performance') || text.includes('stats')) {
    await handleTechnicianPerformance(from, technician, storage);
  } else if (text.includes('location') || text.includes('route')) {
    await handleTechnicianLocation(from, technician, storage);
  } else if (text.includes('inventory') || text.includes('parts')) {
    await handleTechnicianInventory(from, technician, storage);
  } else if (text.includes('help')) {
    await sendInteractiveButtons(
      from,
      '🤖 *Technician Commands*\n\n• "schedule" - View daily schedule\n• "start service" - Choose job to start\n• "upload before/after" - Add photos\n• "complete" - Complete service',
      [
        { id: 'view_schedule', title: '📋 Today\'s Schedule' },
        { id: 'start_service', title: '🔧 Start Service' },
        { id: 'upload_photos', title: '📸 Upload Docs' },
        { id: 'complete_service', title: '✅ Complete' }
      ]
    );
  } else {
    // For any unrecognized text, send main menu
    await sendInteractiveButtons(
      from,
      `👋 Hello ${user.name}!\n\n🔧 Employee Code: ${technician.employeeCode}\n📍 Status: ${technician.status.toUpperCase()}\n\nWhat would you like to do?`,
      [
        { id: 'check_schedule', title: '📅 View Schedule' },
        { id: 'start_service', title: '🔧 Start Service' },
        { id: 'complete_service', title: '✅ Complete Service' },
        { id: 'report_issue', title: '🚨 Report Issue' }
      ]
    );
  }
}

// Present today's services to select from; supports backtracking
async function presentTechnicianServiceList(from: string, technician: any, storage: any, session: any): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const todayRequests = await storage.getTechnicianSchedule(technician.id, today);

  if (!todayRequests || todayRequests.length === 0) {
    await sendTextMessage(from, '✅ No services scheduled today.');
    return;
  }

  const listItems = todayRequests.slice(0, 10).map((req: any, idx: number) => ({
    id: `select_service_${req.id}`,
    title: `${idx + 1}. ${req.requestNumber || req.id}`,
    description: (req.issueDescription || 'Service')
  }));

  await storage.updateWhatsappSession(session.id, {
    conversationState: {
      ...(session.conversationState || {}),
      flow: 'tech_service',
      step: 'awaiting_service_selection',
      selectableServiceIds: todayRequests.map((r: any) => r.id)
    }
  });

  await sendListMessage(
    from,
    'Select the service to begin:',
    'Select Service',
    listItems
  );
}

async function setAwaitingUploadStep(step: 'awaiting_before_photos' | 'awaiting_after_photos' | 'awaiting_report', from: string, session: any, storage: any): Promise<void> {
  await storage.updateWhatsappSession(session.id, {
    conversationState: {
      ...(session.conversationState || {}),
      step
    }
  });
  const label = step === 'awaiting_before_photos' ? 'before photos' : step === 'awaiting_after_photos' ? 'after photos' : 'signed report (image or PDF)';
  await sendTextMessage(from, `📎 Please upload ${label} now.`);
}

// Helper function to handle technician schedule
async function handleTechnicianSchedule(from: string, technician: any, storage: any): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  await handleTechnicianScheduleForDate(from, technician, storage, today);
}

// Helper function to handle technician schedule for specific date
async function handleTechnicianScheduleForDate(from: string, technician: any, storage: any, date: string): Promise<void> {
  // Check if this is the test number and show mock schedule
  const isTestNumber = typeof from === 'string' && isRoleTestNumber(from);
  let schedule = await storage.getScheduledServicesByTechnician(technician.id, date);

  // For test number, add mock services if none exist
  if (isTestNumber && (!schedule || schedule.length === 0)) {
    console.log('🧪 Adding mock services to schedule for testing');

    // Get or create test customer
    let customer = await storage.getCustomerByUserId(technician.userId);
    if (!customer) {
      customer = await storage.createCustomer({
        userId: technician.userId,
        companyName: 'Test Company',
        contactPerson: 'Test Contact',
        email: 'test@example.com',
        phone: from.replace(/\D/g, ''),
        whatsappNumber: from.replace(/\D/g, ''),
        customerTier: 'standard',
        paymentTerms: 'net30',
        billingAddress: 'Test Address',
        status: 'active'
      });
    }

    // Create mock containers and service requests
    const mockServices = [
      { id: 'SR-MOCK-001', issue: 'Temperature sensor showing anomalies in refrigeration unit', container: 'CNT-1001', time: '09:00' },
      { id: 'SR-MOCK-002', issue: 'Door status indicator not responding correctly', container: 'CNT-1002', time: '11:00' },
      { id: 'SR-MOCK-003', issue: 'Intermittent power supply affecting container operations', container: 'CNT-1003', time: '14:00' }
    ];

    for (const mock of mockServices) {
      // Create container if it doesn't exist
      let container = await storage.getContainerByCode(mock.container);
      if (!container) {
        container = await storage.createContainer({
          containerCode: mock.container,
          type: 'refrigerated',
          status: 'active',
          hasIot: true,
          currentCustomerId: customer.id,
          currentLocation: { lat: 28.6139, lng: 77.2090, address: 'Test Location' }
        });
      }

      // Create service request if it doesn't exist
      let serviceRequest = await storage.getServiceRequest(mock.id);
      if (!serviceRequest) {
        serviceRequest = await storage.createServiceRequest({
          requestNumber: mock.id,
          containerId: container.id,
          customerId: customer.id,
          issueDescription: mock.issue,
          priority: 'normal',
          status: 'scheduled',
          assignedTechnicianId: technician.id,
          createdBy: technician.userId,
          scheduledDate: new Date(date),
          scheduledTimeWindow: `${mock.time}:00-${parseInt(mock.time) + 2}:00`
        });

        // Create scheduled service
        await storage.createScheduledService({
          serviceRequestId: serviceRequest.id,
          technicianId: technician.id,
          scheduledDate: new Date(date),
          sequenceNumber: parseInt(mock.id.split('-')[2]),
          estimatedStartTime: new Date(`${date}T${mock.time}:00:00Z`),
          estimatedEndTime: new Date(`${date}T${parseInt(mock.time) + 2}:00:00Z`),
          estimatedTravelTime: 30,
          estimatedServiceDuration: 90,
          routeOrder: parseInt(mock.id.split('-')[2]),
          totalDistance: 15.5,
          optimizationScore: 0.95,
          status: 'scheduled'
        });
      }
    }

    // Re-fetch the schedule to get the newly created services
    schedule = await storage.getScheduledServicesByTechnician(technician.id, date);
  }

  const nextService = await storage.getNextScheduledService(technician.id);
  
  let message = `📋 *Schedule for ${new Date(date).toLocaleDateString()}*\n\n`;
  message += `👤 ${technician.employeeCode} - ${technician.status.toUpperCase()}\n\n`;
  
  if (schedule.length === 0) {
    message += `✅ No scheduled services for this date!\n`;
  } else {
    message += `📋 Services: ${schedule.length}\n\n`;
    
    schedule.forEach((service: any, index: number) => {
      message += `${index + 1}. ${service.serviceRequest?.requestNumber || 'Service'}\n`;
      message += `   🕐 Time: ${new Date(service.estimatedStartTime).toLocaleTimeString()}\n`;
      message += `   📍 Location: Available in app\n`;
      message += `   ⏱️ Duration: ${service.estimatedServiceDuration}min\n`;
      message += `   📊 Status: ${service.status.toUpperCase()}\n\n`;
    });

    // Show service list for selection
    const listItems = schedule.slice(0, 10).map((req: any, idx: number) => ({
      id: `select_service_${req.serviceRequestId || req.id}`,
      title: `${idx + 1}. ${req.serviceRequest?.requestNumber || req.serviceRequestId || req.id}`,
      description: (req.serviceRequest?.issueDescription || 'Service').substring(0, 50)
    }));

    await sendInteractiveList(
      from,
      message + 'Select a service to view details and start/end:',
      'Select Service',
      [{ title: 'Scheduled Services', rows: listItems }]
    );
    return;
  }

  if (nextService && nextService.scheduledDate !== date) {
    message += `⏭️ Next Service: ${new Date(nextService.scheduledDate).toLocaleDateString()}`;
  }

  await sendTextMessage(from, message);
}

// Helper function to handle technician performance
async function handleTechnicianPerformance(from: string, technician: any, storage: any): Promise<void> {
  const performance = await storage.getTechnicianPerformance(technician.id);
  
  let message = `📊 *Performance Stats*\n\n`;
  message += `👤 ${technician.employeeCode}\n`;
  message += `⭐ Rating: ${technician.averageRating ? technician.averageRating.toFixed(1) : 'N/A'}/5\n`;
  message += `✅ Jobs Completed: ${technician.totalJobsCompleted || 0}\n`;
  message += `🎯 Experience: ${technician.experienceLevel}\n`;
  message += `🛠️ Skills: ${technician.skills?.join(', ') || 'Not specified'}\n\n`;
  
  if (performance) {
    message += `📈 This Month:\n`;
    message += `• Services: ${performance.servicesThisMonth || 0}\n`;
    message += `• Avg Response Time: ${performance.avgResponseTime || 'N/A'}\n`;
    message += `• Customer Satisfaction: ${performance.customerSatisfaction || 'N/A'}%\n`;
  }
  
  message += `\n📅 Last Updated: ${new Date().toLocaleString()}`;

  await sendTextMessage(from, message);
}

// Helper function to handle technician location
async function handleTechnicianLocation(from: string, technician: any, storage: any): Promise<void> {
  let message = `📍 *Location & Route Information*\n\n`;
  message += `👤 ${technician.employeeCode}\n`;
  
  if (technician.baseLocation) {
    message += `🏠 Base Location: Configured\n`;
  } else {
    message += `🏠 Base Location: Not set\n`;
  }
  
  if (technician.serviceAreas && technician.serviceAreas.length > 0) {
    message += `🗺️ Service Areas: ${technician.serviceAreas.join(', ')}\n`;
  } else {
    message += `🗺️ Service Areas: Not configured\n`;
  }
  
  const today = new Date().toISOString().split('T')[0];
  const todaySchedule = await storage.getScheduledServicesByTechnician(technician.id, today);
  
  if (todaySchedule.length > 0) {
    message += `\n📋 Today's Route:\n`;
    todaySchedule.forEach((service: any, index: number) => {
      message += `${index + 1}. ${service.estimatedStartTime ? new Date(service.estimatedStartTime).toLocaleTimeString() : 'TBD'}\n`;
    });
    
    const totalDistance = todaySchedule.reduce((sum: number, s: any) => sum + (parseFloat(s.totalDistance) || 0), 0);
    message += `\n📏 Total Distance: ${totalDistance.toFixed(1)} km`;
  }

  await sendTextMessage(from, message);
}

// Helper function to handle technician inventory
async function handleTechnicianInventory(from: string, technician: any, storage: any): Promise<void> {
  // Get inventory items that might be relevant to the technician
  const inventory = await storage.getAllInventoryItems();
  const lowStockItems = inventory.filter((item: any) => item.quantityInStock <= item.reorderLevel);
  
  let message = `📦 *Inventory Status*\n\n`;
  
  if (lowStockItems.length > 0) {
    message += `⚠️ Low Stock Items: ${lowStockItems.length}\n\n`;
    lowStockItems.slice(0, 5).forEach((item: any) => {
      message += `• ${item.partName}\n`;
      message += `  Stock: ${item.quantityInStock}/${item.reorderLevel}\n`;
      message += `  Price: ₹${item.unitPrice}\n\n`;
    });
    
    if (lowStockItems.length > 5) {
      message += `... and ${lowStockItems.length - 5} more items\n\n`;
    }
  } else {
    message += `✅ All inventory levels are adequate\n\n`;
  }
  
  message += `💡 Use the mobile app to request parts for specific jobs.`;

  await sendTextMessage(from, message);
}

// Handle interactive messages (button clicks, list selections)
async function handleInteractiveMessage(message: any, user: any, roleData: any, session: any): Promise<void> {
              const interactiveData = message.interactive;
  const from = message.from;

              if (interactiveData.type === 'button_reply') {
                const buttonId = interactiveData.button_reply.id;
    await handleButtonClick(buttonId, from, user, roleData, session);
  } else if (interactiveData.type === 'list_reply') {
    const listId = interactiveData.list_reply.id;
    await handleListSelection(listId, from, user, roleData, session);
  }
}


// Handle button clicks based on user role and context
async function handleButtonClick(buttonId: string, from: string, user: any, roleData: any, session: any): Promise<void> {
  const { storage } = await import('../storage');

  // Update conversation state based on button click
  const conversationState = session.conversationState || {};
  // Testing override: let the special number choose or switch roles and access mock flows
  const isTestNumber = typeof from === 'string' && isRoleTestNumber(from);
  if (isTestNumber) {
    if (buttonId === 'switch_role') {
      await storage.updateWhatsappSession(session.id, {
        conversationState: { ...(conversationState || {}), testingRole: null, testFlow: null, testSelectedContainer: null }
      });
      await sendTextMessage(from, '🧪 Role cleared. Please select a new role to test:');
      await sendTestRoleSelectionMenu(from);
      return;
    }

    if (buttonId === 'test_role_technician' || buttonId === 'test_role_client') {
      const testingRole = buttonId === 'test_role_technician' ? 'technician' : 'client';
      await storage.updateWhatsappSession(session.id, {
        conversationState: { ...(conversationState || {}), testingRole, testFlow: null, testSelectedContainer: null }
      });
      await sendTextMessage(from, `🧪 Testing as ${testingRole}.`);
      if (testingRole === 'technician') {
        await sendTestTechnicianMenu(from);
      } else {
        await sendTestClientMenu(from);
      }
      return;
    }

    if (buttonId === 'test_client_request_service') {
      await storage.updateWhatsappSession(session.id, {
        conversationState: { ...(conversationState || {}), testFlow: 'client_request', testSelectedContainer: null }
      });
      await promptMockContainerSelection(from);
      return;
    }

    // Map non-test client button IDs to REAL flow (not test/mock)
    if (buttonId === 'request_service') {
      await handleRealClientRequestService(from, user, session);
      return;
    }

    if (buttonId === 'test_client_select_container') {
      await storage.updateWhatsappSession(session.id, {
        conversationState: { ...(conversationState || {}), testFlow: 'client_select_container' }
      });
      await sendMockContainerList(from);
      return;
    }

    if (buttonId === 'test_client_status') {
      await storage.updateWhatsappSession(session.id, {
        conversationState: { ...(conversationState || {}), testFlow: 'client_status' }
      });
      const statusMessage = ['📊 *Mock Container Status*', ''].concat(
        MOCK_CONTAINERS.map(container => `• ${container.id} – ${container.type}\n  Status: ${container.status}\n  Location: ${container.location}`)
      ).join('\n');
      await sendTextMessage(from, statusMessage);
      await sendTestClientMenu(from);
      return;
    }

    // Handle real client status check (non-test)
    if (buttonId === 'status' || buttonId === 'check_status') {
      await handleRealClientStatusCheck(from, user, session);
      return;
    }

    if (buttonId === 'test_tech_view_schedule') {
      await storage.updateWhatsappSession(session.id, {
        conversationState: { ...(conversationState || {}), testFlow: 'technician_schedule' }
      });
      await sendMockScheduleButtons(from);
      return;
    }

    // Map non-test technician IDs to test flow for convenience
    if (buttonId === 'view_schedule' || buttonId === 'check_schedule') {
      await storage.updateWhatsappSession(session.id, {
        conversationState: { ...(conversationState || {}), testFlow: 'technician_schedule' }
      });
      await sendMockScheduleButtons(from);
      return;
    }

    if (buttonId === 'test_tech_start_service') {
      await storage.updateWhatsappSession(session.id, {
        conversationState: { ...(conversationState || {}), testFlow: 'technician_start_service' }
      });
      await sendTextMessage(from, '🧰 Select a job from today\'s schedule to view service details.');
      await sendMockScheduleButtons(from);
      return;
    }

    if (buttonId === 'start_service') {
      await storage.updateWhatsappSession(session.id, {
        conversationState: { ...(conversationState || {}), testFlow: 'technician_start_service' }
      });
      await sendTextMessage(from, '🧰 Select a job from today\'s schedule to view service details.');
      await sendMockScheduleButtons(from);
      return;
    }

    if (buttonId.startsWith('test_job_')) {
      const jobId = buttonId.replace('test_job_', '');
      const job = getMockTechnicianJob(jobId);
      if (job) {
        await storage.updateWhatsappSession(session.id, {
          conversationState: { ...(conversationState || {}), testFlow: 'technician_job_detail', testSelectedJob: jobId }
        });
        const jobMessage = `🧾 Job Details: ${job.id}\n- Type: ${job.type}\n- Location: ${job.location}\n- Status: ${job.status}\n- Client: ${job.client}`;
        await sendTextMessage(from, jobMessage);
        await sendTestTechnicianMenu(from);
      }
      return;
    }

    if (buttonId.startsWith('test_container_')) {
      const containerId = buttonId.replace('test_container_', '');
      const c = getMockContainerDetail(containerId);
      if (c) {
        const detailMsg = `🧾 Service Details for ${c.id}\n- Issue: ${c.issue}\n- Status: Pending\n- Technician Assigned: ${c.technician}\n- ETA: ${c.eta}`;
        await sendTextMessage(from, detailMsg);
        await sendTestClientMenu(from);
      }
      return;
    }
  }

  // Handle REAL container selection for service request (non-test)
  // This is used when selecting containers during service request flow
  if (buttonId.startsWith('select_container_')) {
    const containerId = buttonId.replace('select_container_', '');
    await handleContainerSelection(containerId, from, user, session);
    return;
  }

  // Handle REAL container selection for status check (non-test)
  if (buttonId.startsWith('status_container_')) {
    const containerId = buttonId.replace('status_container_', '');
    const { storage } = await import('../storage');
    await showContainerStatus(from, containerId, storage);
    return;
  }

  // Handle photo attachment choice buttons
  if (buttonId === 'attach_photos_yes') {
    await handlePhotoChoice(true, from, user, session);
    return;
  }

  if (buttonId === 'attach_photos_no') {
    await handlePhotoChoice(false, from, user, session);
    return;
  }

  // Handle multi-container selection buttons during container verification
  if (buttonId === 'add_more_containers') {
    // Ask for another container number
    const { storage } = await import('../storage');
    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        ...conversationState,
        step: 'awaiting_container_number'
      }
    });
    await sendTextMessage(from, '📦 Please enter the next container number:');
    return;
  }
  
  // Handle proceed with containers button during container verification
  if (buttonId === 'proceed_with_containers') {
    const { storage } = await import('../storage');
    const selectedContainers = conversationState.selectedContainers || [];
    
    if (selectedContainers.length === 0) {
      await sendTextMessage(from, '❌ No containers selected. Please start again by sending "hi".');
      return;
    }
    
    // Get first customer ID from selected containers
    const firstCustomerId = selectedContainers[0]?.customerId;
    const customer = firstCustomerId ? await storage.getCustomer(firstCustomerId) : null;
    
    // Update session to clear container verification flow
    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        ...conversationState,
        flow: null,
        step: null,
        verifiedCustomerId: firstCustomerId
      }
    });
    
    // Show client menu with selected containers
    await sendRealClientMenu(from, user, customer, selectedContainers);
    return;
  }

  // Handle remove last container button
  if (buttonId === 'remove_last_container') {
    const { storage } = await import('../storage');
    const selectedContainers = conversationState.selectedContainers || [];
    
    if (selectedContainers.length > 1) {
      // Remove the last container
      const removedContainer = selectedContainers.pop();
      console.log(`[WhatsApp] Removed container: ${removedContainer.containerCode}`);
      
      // Update session
      await storage.updateWhatsappSession(session.id, {
        conversationState: {
          ...conversationState,
          selectedContainers: selectedContainers
        }
      });
      
      // Show updated list with buttons
      const containerList = selectedContainers.map((c: any) => c.containerCode).join(', ');
      const containerCount = selectedContainers.length;
      
      const buttons = [
        { id: 'add_more_containers', title: '➕ Add More' },
        { id: 'proceed_with_containers', title: '✅ Proceed' }
      ];
      
      if (containerCount > 1) {
        buttons.push({ id: 'remove_last_container', title: '🗑️ Remove Last' });
      }
      
      await sendInteractiveButtons(
        from,
        `🗑️ *Container Removed*\n\n📦 *Selected (${containerCount}):* ${containerList}\n\nWould you like to add more containers or proceed?`,
        buttons
      );
    } else {
      await sendTextMessage(from, '⚠️ Cannot remove the only container. Type *RESTART* to start over.');
    }
    return;
  }

  if (buttonId === 'proceed_with_selection') {
    // Proceed to error code input (used during service request flow)
    const { storage } = await import('../storage');
    const conversationState = session.conversationState || {};
    const selectedContainers = conversationState.selectedContainers || [];

    console.log('[WhatsApp] Proceeding with container selection:', {
      userId: user.id,
      phoneNumber: from,
      selectedContainers,
      customerId: conversationState.customerId,
      flow: conversationState.flow
    });

    if (selectedContainers.length === 0) {
      console.warn('[WhatsApp] No containers selected when proceeding');
      await sendTextMessage(from, '❌ No containers selected. Please start again.');
      await sendRealClientMenu(from, user);
      return;
    }

    // Get container codes for display
    const containerCodes = [];
    for (const sc of selectedContainers) {
      // selectedContainers now contains objects with {id, containerCode, customerId}
      containerCodes.push(sc.containerCode);
    }

    // IMPORTANT: Update to error code step while PRESERVING all existing state
    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        ...conversationState, // Preserve customerId, flow, and all other state
        step: 'awaiting_error_code'
      }
    });

    console.log('[WhatsApp] Updated session to awaiting_error_code step');

    await sendTextMessage(
      from,
      `${getProgressIndicator('awaiting_error_code')}` +
      `📦 *Selected Container(s):*\n${containerCodes.join(', ')}\n\n` +
      `❓ *What error code are you seeing?*\n\n` +
      `Type the error code (e.g., E407), or reply *NA* if no error code.`
    );

    // Send reference videos to help client identify error codes
    await sendTextMessage(
      from,
      `🎥 *Reference Videos:*\nHere are helpful videos showing where to find error codes on different container types:`
    );

    // Video 1: Carrier Unit
    await sendVideoMessage(
      from,
      'https://res.cloudinary.com/dsnzo163t/video/upload/v1763700758/How_to_check_alarm_in_carrier_unit_bxqqzg.mp4',
      '🎥 How to check alarm in Carrier unit'
    );

    // Video 2: Thermoking MP-4000 Unit
    await sendVideoMessage(
      from,
      'https://res.cloudinary.com/dsnzo163t/video/upload/v1/How_to_check_alaram_in_mp_4000_unit_tharmoking_njc1pe.mp4',
      '🎥 How to check alarm in MP-4000 unit (Thermoking)'
    );

    // Video 3: Daikin Unit
    await sendVideoMessage(
      from,
      'https://res.cloudinary.com/dsnzo163t/video/upload/v1/How_to_check_return_temperature_supply_temperature_alarm_in_daikin_unit_nwaxew.mp4',
      '🎥 How to check return/supply temperature alarm in Daikin unit'
    );

    return;
  }

  if (user.role === 'client' || (isTestNumber && session.conversationState?.testingRole === 'client')) {
    await handleClientButtonClick(buttonId, from, user, session, conversationState);
  } else if (user.role === 'technician' || (isTestNumber && session.conversationState?.testingRole === 'technician')) {
    await handleTechnicianButtonClick(buttonId, from, user, session, conversationState);
  }
}

  // Handle client button interactions
async function handleClientButtonClick(buttonId: string, from: string, user: any, session: any, conversationState: any): Promise<void> {
  const { storage } = await import('../storage');

  // Handle initial "hi" message for clients
  if (buttonId === 'client_greeting') {
    const customer = await storage.getCustomerByUserId(user.id);
    if (customer) {
      await sendInteractiveButtons(
        from,
        `👋 Hello ${customer.contactPerson}!\n\n🏢 ${customer.companyName}\n\nHow can I help you today?`,
        [
          { id: 'check_container_details', title: '📦 Check Container Details' },
          { id: 'request_service', title: '🔧 Request Service' },
          { id: 'check_service_status', title: '📋 Check Service Status' },
          { id: 'check_container_status', title: '📊 Check Container Status' }
        ]
      );
    }
    return;
  }

  switch (buttonId) {
    case 'check_container_status':
      const customer = await storage.getCustomerByUserId(user.id);
      if (customer) {
        const containers = await storage.getContainersByCustomer(customer.id);
        const activeContainers = containers.filter((c: any) => c.status === 'active');
        const alerts = await storage.getOpenAlerts();
        const customerAlerts = alerts.filter((a: any) => containers.some((c: any) => c.id === a.containerId));

        const message = `📊 *Container Status Summary*

📦 Total Containers: ${containers.length}
✅ Active: ${activeContainers.length}
🚨 Alerts: ${customerAlerts.length}

Select an option below:`;

        await sendInteractiveButtons(
          from,
          message,
          [
            { id: 'view_containers', title: 'View Containers' },
            { id: 'view_alerts', title: 'View Alerts' },
            { id: 'request_service', title: 'Request Service' }
          ]
        );
      }
      break;

    case 'check_container_details':
      // Show detailed container list
      const customerDetails = await storage.getCustomerByUserId(user.id);
      if (customerDetails) {
        const containers = await storage.getContainersByCustomer(customerDetails.id);
        const activeContainers = containers.filter((c: any) => c.status === 'active');

        if (activeContainers.length === 0) {
          await sendTextMessage(from, '❌ No active containers found. Please contact support.');
          return;
        }

        const containerOptions = activeContainers.map((container: any) => ({
          id: `detail_${container.id}`,
          title: `${container.containerCode} - ${container.type}`,
          description: `Status: ${container.status} | Location: ${container.currentLocation?.address || 'Unknown'}`
        }));

        await sendInteractiveList(
          from,
          '📦 *Select Container for Details*',
          'Choose Container',
          [{ title: 'Active Containers', rows: containerOptions }]
        );
      }
      break;

    case 'check_service_status':
      // Show service status
      const customerService = await storage.getCustomerByUserId(user.id);
      if (customerService) {
        const serviceRequests = await storage.getServiceRequestsByCustomer(customerService.id);
        const pendingRequests = serviceRequests.filter((sr: any) => 
          ['pending', 'approved', 'scheduled', 'in_progress'].includes(sr.status));
        const recentCompleted = serviceRequests.filter((sr: any) => sr.status === 'completed')
          .sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
          .slice(0, 3);

        let message = `📋 *Service Status for ${customerService.companyName}*\n\n`;
        
        if (pendingRequests.length > 0) {
          message += `⏳ Active Services: ${pendingRequests.length}\n`;
          pendingRequests.slice(0, 3).forEach((sr: any) => {
            message += `• ${sr.requestNumber} - ${sr.status.toUpperCase()}\n`;
          });
        }

        if (recentCompleted.length > 0) {
          message += `\n✅ Recent Completed: ${recentCompleted.length}\n`;
          recentCompleted.forEach((sr: any) => {
            message += `• ${sr.requestNumber} - Completed\n`;
          });
        }

        if (pendingRequests.length === 0 && recentCompleted.length === 0) {
          message += `No service requests found.`;
        }

        await sendTextMessage(from, message);
      }
      break;

    case 'view_containers':
      const customerContainers = await storage.getCustomerByUserId(user.id);
      if (customerContainers) {
        const containers = await storage.getContainersByCustomer(customerContainers.id);
        const activeContainers = containers.filter((c: any) => c.status === 'active');

        if (activeContainers.length === 0) {
          await sendTextMessage(from, '❌ No active containers found. Please contact support.');
          return;
        }

        const containerOptions = activeContainers.map((container: any) => ({
          id: container.id,
          title: `${container.containerCode} - ${container.type}`,
          description: `Status: ${container.status} | Location: ${container.currentLocation?.address || 'Unknown'}`
        }));

        await sendInteractiveList(
          from,
          '📦 *Select Container to View Details*',
          'Choose Container',
          [{ title: 'Active Containers', rows: containerOptions }]
        );
      }
      break;

    case 'view_alerts':
      const customerAlerts = await storage.getCustomerByUserId(user.id);
      if (customerAlerts) {
        const containers = await storage.getContainersByCustomer(customerAlerts.id);
        const containerIds = containers.map((c: any) => c.id);
        const alerts = await storage.getAllAlerts();
        const openAlerts = alerts.filter((a: any) => !a.resolvedAt && containerIds.includes(a.containerId));

        if (openAlerts.length === 0) {
          await sendTextMessage(from, '✅ No active alerts found. All systems operational.');
          return;
        }

        const alertOptions = openAlerts.map((alert: any) => ({
          id: alert.id,
          title: `${alert.title} (${alert.severity})`,
          description: `${alert.description.substring(0, 50)}...`
        }));

        await sendInteractiveList(
          from,
          '🚨 *Active Alerts*',
          'Select Alert',
          [{ title: 'Open Alerts', rows: alertOptions }]
        );
      }
      break;

    case 'request_service':
      await handleRealClientRequestService(from, user, session);
      break;

    case 'check_invoices':
      const customerInvoices = await storage.getCustomerByUserId(user.id);
      if (customerInvoices) {
        const invoices = await storage.getInvoicesByCustomer(customerInvoices.id);
        const pendingInvoices = invoices.filter((inv: any) => inv.paymentStatus === 'pending');

        if (pendingInvoices.length > 0) {
          const totalAmount = pendingInvoices.reduce((sum: number, inv: any) => sum + parseFloat(inv.totalAmount), 0);
          await sendInteractiveButtons(
            from,
            `💳 *Payment Status*

You have ${pendingInvoices.length} pending invoice(s)
Total amount: ₹${totalAmount.toFixed(2)}

What would you like to do?`,
            [
              { id: 'view_invoices', title: 'View Invoices' },
              { id: 'pay_now', title: 'Pay Now' },
              { id: 'contact_support', title: 'Contact Support' }
            ]
          );
        } else {
          await sendTextMessage(from, '✅ All payments are up to date!');
        }
      }
      break;

    case 'view_invoices':
      const customerForInvoices = await storage.getCustomerByUserId(user.id);
      if (customerForInvoices) {
        const invoices = await storage.getInvoicesByCustomer(customerForInvoices.id);
        const pendingInvoices = invoices.filter((inv: any) => inv.paymentStatus === 'pending');

        if (pendingInvoices.length > 0) {
          const invoiceOptions = pendingInvoices.map((invoice: any) => ({
            id: invoice.id,
            title: `Invoice #${invoice.invoiceNumber}`,
            description: `₹${invoice.totalAmount} - Due: ${new Date(invoice.dueDate).toLocaleDateString()}`
          }));

          await sendInteractiveList(
            from,
            '💳 *Pending Invoices*',
            'Select Invoice',
            [{ title: 'Pending Invoices', rows: invoiceOptions }]
          );
        }
      }
      break;

    case 'track_request':
      await sendTextMessage(from, '📋 *Request Tracking*\n\nTrack your service requests in your dashboard or use the "service" command.');
      break;

    case 'new_request':
      await handleRealClientRequestService(from, user, session);
      break;

    case 'help':
      await sendInteractiveButtons(
        from,
        '🤖 *WhatsApp Help*\n\nAvailable commands:\n• "status" - Check container status\n• "service" - Request service\n• "invoice" - Check billing\n• "help" - This help menu\n\nNeed more help?',
        [
          { id: 'contact_human', title: 'Contact Support' },
          { id: 'main_menu', title: 'Main Menu' }
        ]
      );
      break;

    case 'contact_human':
      await sendTextMessage(from, '📞 *Contact Support*\n\nPhone: +1-800-CONTAINER\nEmail: support@containergenie.com\n\nOur team is available 24/7 for urgent issues.');
      break;

    case 'main_menu':
      await sendInteractiveButtons(
        from,
        '🏠 *Main Menu*\n\nWhat can I help you with today?',
        [
          { id: 'check_status', title: 'Check Status' },
          { id: 'request_service', title: 'Request Service' },
          { id: 'check_invoices', title: 'Check Invoices' },
          { id: 'help', title: 'Help' }
        ]
      );
      break;

    case 'approve_service':
      if (conversationState.serviceRequestId) {
        await approveServiceRequest(conversationState.serviceRequestId, from, user);
      }
      break;

    case 'schedule_later':
      if (conversationState.serviceRequestId) {
        await scheduleServiceLater(conversationState.serviceRequestId, from, user);
      }
      break;

    case 'rate_5':
    case 'rate_4':
    case 'rate_3':
    case 'rate_2':
    case 'rate_1':
      if (conversationState.feedbackRequestId) {
        const rating = buttonId.split('_')[1];
        await submitFeedback(conversationState.feedbackRequestId, user.id, parseInt(rating), from);
      }
      break;

    // Service request priority buttons
    case 'priority_urgent':
    case 'priority_high':
    case 'priority_normal':
    case 'priority_low':
      if (conversationState.flow === 'service_request') {
        await serviceRequestViaWhatsApp.handlePrioritySelectionById(buttonId, from, user, session);
      } else {
        await sendTextMessage(from, 'No active service request flow. Please start a new request.');
      }
      break;

    default:
      await sendInteractiveButtons(
        from,
        '🤔 *Command Not Recognized*\n\nI didn\'t understand that command. Please use the buttons below or type "help" for assistance.',
        [
          { id: 'main_menu', title: 'Main Menu' },
          { id: 'help', title: 'Help' }
        ]
      );
  }
}

// Handle technician button interactions
async function handleTechnicianButtonClick(buttonId: string, from: string, user: any, session: any, conversationState: any): Promise<void> {
  const { storage } = await import('../storage');

  // Handle initial "hi" message for technicians
  if (buttonId === 'technician_greeting') {
    const technician = await storage.getTechnicianByUserId(user.id);
    if (technician) {
      // Check for active services
      const activeServices = getActiveServices(session);
      if (activeServices.length > 0) {
        await showActiveServicesMenu(from, user, session, storage);
      } else {
        await sendTechnicianMainMenu(from, user, storage);
      }
    }
    return;
  }

  // Handle start service with location proof requirement
  if (buttonId === 'start_service_with_proof' && conversationState.currentServiceId) {
    await sendTextMessage(from, '📍 *Location Proof Required*\n\nPlease send a photo proving you have arrived at the container location. This photo will be stored with the service record.');
    await storage.updateWhatsappSession(session.id, {
      conversationState: { ...conversationState, step: 'awaiting_location_proof' }
    });
    return;
  }

  // NEW: Handle schedule navigation
  if (buttonId === 'view_schedule') {
    const technician = await storage.getTechnicianByUserId(user.id);
    if (technician) {
      await showScheduleDateSelection(from, technician);
    }
    return;
  }

  if (buttonId === 'schedule_today') {
    const technician = await storage.getTechnicianByUserId(user.id);
    if (technician) {
      await showScheduleForToday(from, technician, session, storage);
    }
    return;
  }

  if (buttonId === 'schedule_previous') {
    const technician = await storage.getTechnicianByUserId(user.id);
    if (technician) {
      await showScheduleForPrevious(from, technician, storage);
    }
    return;
  }

  if (buttonId === 'schedule_future') {
    const technician = await storage.getTechnicianByUserId(user.id);
    if (technician) {
      await showScheduleForFuture(from, technician, storage);
    }
    return;
  }

  // NEW: Handle service detail view
  if (buttonId.startsWith('view_service_')) {
    const serviceId = buttonId.replace('view_service_', '');
    await showServiceDetails(from, serviceId, storage);
    return;
  }

  // NEW: Handle service start
  if (buttonId.startsWith('start_service_')) {
    const serviceId = buttonId.replace('start_service_', '');
    await startServiceRequest(from, user, serviceId, session, storage);
    return;
  }

  // NEW: Handle service end (single or multiple)
  if (buttonId === 'end_service') {
    const activeServices = getActiveServices(session);
    if (activeServices.length === 1) {
      await initiateServiceCompletion(from, user, activeServices[0].serviceId, session, storage);
    } else {
      await sendTextMessage(from, '❌ Please specify which service to end.');
    }
    return;
  }

  if (buttonId.startsWith('end_service_')) {
    const match = buttonId.match(/end_service_(\d+)/);
    if (match) {
      const index = parseInt(match[1]) - 1;
      const serviceId = getServiceIdByIndex(session, index);
      if (serviceId) {
        await initiateServiceCompletion(from, user, serviceId, session, storage);
      } else {
        await sendTextMessage(from, '❌ Service not found.');
      }
    }
    return;
  }

  if (buttonId.startsWith('end_service_for_')) {
    const serviceId = buttonId.replace('end_service_for_', '');
    await initiateServiceCompletion(from, user, serviceId, session, storage);
    return;
  }

  // NEW: Handle upload flow buttons
  if (buttonId === 'upload_photos_now' || buttonId === 'upload_after_photos_now') {
    await sendTextMessage(from, '📸 Please send your photos now. Type "DONE" when finished.');
    return;
  }

  if (buttonId === 'skip_before_photos') {
    await moveToAfterPhotos(from, session, storage);
    return;
  }

  if (buttonId === 'upload_signature_now') {
    await sendTextMessage(from, '📄 Please send the signed document now.');
    return;
  }

  if (buttonId === 'upload_invoice_yes') {
    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        ...conversationState,
        completionStep: 'awaiting_invoice'
      }
    });
    await sendTextMessage(from, '🧾 Please send the vendor invoice now.');
    return;
  }

  if (buttonId === 'upload_invoice_no') {
    await completeServiceRequest(from, user, session, storage);
    return;
  }

  // NEW: Handle back to menu
  if (buttonId === 'back_to_menu') {
    const activeServices = getActiveServices(session);
    if (activeServices.length > 0) {
      await showActiveServicesMenu(from, user, session, storage);
    } else {
      await sendTechnicianMainMenu(from, user, storage);
    }
    return;
  }

  if (buttonId === 'back_to_schedule') {
    const technician = await storage.getTechnicianByUserId(user.id);
    if (technician) {
      await showScheduleDateSelection(from, technician);
    }
    return;
  }

  switch (buttonId) {
    case 'check_schedule':
      const technician = await storage.getTechnicianByUserId(user.id);
      if (technician) {
        await showScheduleDateSelection(from, technician);
      }
      break;

    case 'view_profile':
      {
        const technician = await storage.getTechnicianByUserId(user.id);
        if (technician) {
          await sendTextMessage(
            from,
            `👤 Profile\n\nName: ${user.name}\nCode: ${technician.employeeCode}\nStatus: ${technician.status}\nSkills: ${Array.isArray(technician.skills) ? technician.skills.join(', ') : 'N/A'}`
          );
        }
      }
      break;

    case 'acknowledge_schedule':
      await acknowledgeSchedule(from, user, conversationState);
      break;

    case 'start_travel':
      await startTravel(from, user, conversationState);
      break;

    case 'arrived_at_location':
      await confirmArrival(from, user, conversationState);
      break;

    case 'start_service':
      if (conversationState.currentServiceId) {
        await sendTextMessage(from, '📍 *Location Proof Required*\n\nPlease send a photo proving you have arrived at the container location. This photo will be stored with the service record.');
        await storage.updateWhatsappSession(session.id, {
          conversationState: { ...conversationState, step: 'awaiting_location_proof' }
        });
      } else {
        // Present a mock list of services for testing
        const mockServices = [
          { id: 'SR-MOCK-001', title: 'Reefer cooling issue', container: 'CNT-1001', description: 'Temperature sensor showing anomalies in refrigeration unit' },
          { id: 'SR-MOCK-002', title: 'Door sensor fault', container: 'CNT-1002', description: 'Door status indicator not responding correctly' },
          { id: 'SR-MOCK-003', title: 'Power fluctuations', container: 'CNT-1003', description: 'Intermittent power supply affecting container operations' }
        ];
        const listItems = mockServices.map((s, idx) => ({ id: `select_service_${s.id}`, title: `${idx + 1}. ${s.id}`, description: `${s.title} • ${s.container}` }));
        await sendListMessage(from, 'Select service to start:', 'Select Service', [{ title: 'Services', rows: listItems }]);
        await storage.updateWhatsappSession(session.id, {
          conversationState: { ...conversationState, selectableServiceIds: mockServices.map(s => s.id), step: 'awaiting_service_selection' }
        });
      }
      break;

    case 'complete_service':
      // Gate completion: require at least one before, one after, and report present
      if (!conversationState?.currentServiceId) {
        await sendTextMessage(from, '❌ No active service selected.');
        break;
      }
      {
        const service = await storage.getServiceRequest(conversationState.currentServiceId);
        const hasBefore = Array.isArray(service?.beforePhotos) && service!.beforePhotos!.length > 0;
        const hasAfter = Array.isArray(service?.afterPhotos) && service!.afterPhotos!.length > 0;
        const hasReport = typeof service?.resolutionNotes === 'string' && service!.resolutionNotes!.toString().toLowerCase().includes('report');
        if (!hasBefore || !hasAfter || !hasReport) {
          await sendInteractiveButtons(
            from,
            '⛔ Completion requires before photos, after photos, and a signed report. Please upload the missing items.',
            [
              { id: 'upload_photos', title: '📸 Upload Docs' },
              { id: 'back', title: '⬅️ Back' }
            ]
          );
          break;
        }
      }
      await completeService(from, user, conversationState);
      break;

    case 'end_service':
      if (conversationState.currentServiceId) {
        await sendTextMessage(from, '📸 *Service Completion*\n\nPlease send photos of the completed work and a signed report. These will be stored with the service record.');
        await storage.updateWhatsappSession(session.id, {
          conversationState: { ...conversationState, step: 'awaiting_completion_photos' }
        });
      } else {
        await sendTextMessage(from, '❌ No service selected. Please select a service first.');
      }
      break;

    case 'upload_photos':
      await requestPhotoUpload(from, user, conversationState);
      break;

    case 'missing_parts':
      await reportMissingParts(from, user, conversationState);
      break;

    case 'need_help':
      await requestHelp(from, user, conversationState);
      break;

    case 'start_travel_next':
      await startNextService(from, user, conversationState);
      break;

    case 'reschedule_service':
      await rescheduleService(from, user, conversationState);
      break;

    case 'skip_service':
      await skipService(from, user, conversationState);
      break;

    case 'back':
      await storage.updateWhatsappSession(session.id, { conversationState: {} });
      await sendInteractiveButtons(
        from,
        'Back to main menu.',
        [
          { id: 'view_schedule', title: '📋 View Schedule' },
          { id: 'start_service', title: '🔧 Start Service' },
          { id: 'upload_photos', title: '📸 Upload Docs' },
          { id: 'complete_service', title: '✅ Complete' }
        ]
      );
      break;

    case 'submit_timesheet':
      await submitTimesheet(from, user, conversationState);
      break;

    case 'report_issues':
      await reportEndOfDayIssues(from, user, conversationState);
      break;

    case 'end_day':
      await endDay(from, user, conversationState);
      break;

    default:
      await sendInteractiveButtons(
        from,
        '❓ *Command Not Recognized*\n\nPlease use the workflow buttons or type "help" for assistance.',
        [
          { id: 'help', title: 'Help' },
          { id: 'main_menu', title: 'Main Menu' }
        ]
      );
  }
}

// Handle list selections
async function handleListSelection(listId: string, from: string, user: any, roleData: any, session: any): Promise<void> {
  const conversationState = session.conversationState || {};
  // Handle container selection for service request (real client flow)
  if (listId.startsWith('select_container_')) {
    const containerId = listId.replace('select_container_', '');
    await handleContainerSelection(containerId, from, user, session);
    return;
  }

  // Handle container selection for status check (real client flow)
  if (listId.startsWith('status_container_')) {
    const containerId = listId.replace('status_container_', '');
    const { storage } = await import('../storage');
    await showContainerStatus(from, containerId, storage);
    return;
  }

  if (listId.startsWith('contact_date_')) {
    const selection = listId.replace('contact_date_', '');
    const value = selection === 'no_preference' ? 'No preference' : selection;
    await finalizePreferredContactSelection(value, from, user, session);
    return;
  }

  // Technician service selection via list (skip SR-MOCK selections here; handled below)
  if (user.role === 'technician' && listId.startsWith('select_service_') && !listId.includes('SR-MOCK-')) {
    const { storage } = await import('../storage');
    const serviceId = listId.replace('select_service_', '');

    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        ...conversationState,
        currentServiceId: serviceId,
        step: 'service_selected'
      }
    });

    // Show service details and start/end options
    const service = await storage.getServiceRequest(serviceId);
    if (service) {
      const container = await storage.getContainer(service.containerId);
      const message = `🔧 *Service Details*

📋 Request: ${service.requestNumber}
📦 Container: ${container?.containerCode || 'Unknown'}
📍 Location: ${(container as any)?.currentLocation?.address || 'Unknown'}
🔧 Issue: ${service.issueDescription}
⏰ Scheduled: ${service.scheduledDate ? new Date(service.scheduledDate).toLocaleDateString() : 'Not scheduled'}
📊 Status: ${service.status.toUpperCase()}

What would you like to do?`;

      await sendInteractiveButtons(
        from,
        message,
        [
          { id: 'start_service', title: '🔧 Start Service' },
          { id: 'end_service', title: '✅ End Service' },
          { id: 'back', title: '⬅️ Back' }
        ]
      );
    } else {
      await sendTextMessage(from, '❌ Service not found. Please try again.');
    }
    return;
  }

  // Handle service request container selection (client flow)
  if (conversationState.flow === 'service_request' && conversationState.step === 'awaiting_container_selection') {
    await serviceRequestViaWhatsApp.handleContainerListSelection(listId, from, user, session);
    return;
  }

  // Technician: handle mock service selection IDs
  if ((user.role === 'technician' || (session.conversationState as any)?.testingRole === 'technician') && listId.startsWith('select_service_')) {
    const { storage } = await import('../storage');
    const serviceId = listId.replace('select_service_', '');

    // For mock services, create real service requests in the database
    if (serviceId.startsWith('SR-MOCK-')) {
      const isTestNumber = typeof from === 'string' && isRoleTestNumber(from);
      if (isTestNumber) {
        const mockData = {
          'SR-MOCK-001': { issue: 'Temperature sensor showing anomalies in refrigeration unit', container: 'CNT-1001' },
          'SR-MOCK-002': { issue: 'Door status indicator not responding correctly', container: 'CNT-1002' },
          'SR-MOCK-003': { issue: 'Intermittent power supply affecting container operations', container: 'CNT-1003' }
        }[serviceId];

        if (mockData) {
          // Get or create test customer for mock services
          let customer = await storage.getCustomerByUserId(user.id);
          if (!customer) {
            customer = await storage.createCustomer({
              userId: user.id,
              companyName: 'Test Company',
              contactPerson: 'Test Contact',
              email: 'test@example.com',
              phone: from.replace(/\D/g, ''),
              whatsappNumber: from.replace(/\D/g, ''),
              customerTier: 'standard',
              paymentTerms: 'net30',
              billingAddress: 'Test Address',
              status: 'active'
            });
          }

          // Create or get test container
          let container = await storage.getContainerByCode(mockData.container);
          if (!container) {
            container = await storage.createContainer({
              containerCode: mockData.container,
              type: 'refrigerated',
              status: 'active',
              hasIot: true,
              currentCustomerId: customer.id,
              currentLocation: { lat: 28.6139, lng: 77.2090, address: 'Test Location' }
            });
          }

          // Create the mock service request
          const serviceRequest = await storage.createServiceRequest({
            requestNumber: serviceId,
            containerId: container.id,
            customerId: customer.id,
            issueDescription: mockData.issue,
            priority: 'normal',
            status: 'scheduled',
            assignedTechnicianId: user.id, // Assign to test technician
            createdBy: user.id,
            scheduledDate: new Date(),
            scheduledTimeWindow: '10:00-12:00'
          });

          console.log('🧪 Created mock service request:', serviceId);
        }
      }
    }

    await storage.updateWhatsappSession(session.id, {
      conversationState: { ...(session.conversationState || {}), currentServiceId: serviceId, step: 'service_selected' }
    });

    await sendInteractiveButtons(
      from,
      'Service selected. What would you like to do?',
      [
        { id: 'start_service', title: '🔧 Start Service' },
        { id: 'upload_photos', title: '📸 Upload Docs' },
        { id: 'complete_service', title: '✅ Complete' },
        { id: 'back', title: '⬅️ Back' }
      ]
    );
    return;
  }

  await sendTextMessage(from, `Selected option: ${listId}`);
}

// Handle media messages (photos, videos, documents) with role-based handling
async function handleMediaMessageLegacy(message: any, user: any, roleData: any, session: any): Promise<void> {
  const from = message.from;

  const { storage } = await import('../storage');

  // WhatsApp media payload structure varies by type
  const mediaType = message.type; // 'image' | 'video' | 'document'
  const media = (message as any)[mediaType];
  const mediaId = media?.id || media?.media_id;
  const caption = media?.caption || '';

  // Handle CLIENT photo uploads during real service request flow
  if (user.role === 'client' && session.conversationState?.flow === 'real_service_request') {
    if (session.conversationState?.step === 'awaiting_photos' && mediaId) {
      await handlePhotoUpload(mediaId, from, user, session);
      return;
    }
    
    // Handle video uploads
    if (session.conversationState?.step === 'awaiting_videos' && message.type === 'video') {
      const videoId = message.video?.id;
      if (videoId) {
        await handleVideoUpload(videoId, from, user, session);
        return;
      }
    }
  }
  // NEW: Handle technician completion flow photo uploads
  if (user.role === 'technician' && session.conversationState?.completingServiceId) {
    const completionStep = session.conversationState?.completionStep;
    
    if (completionStep === 'awaiting_before_photos' || completionStep === 'awaiting_after_photos') {
      await handlePhotoUploadStep(from, user, mediaId, session, storage);
      return;
    }
    
    if (completionStep === 'awaiting_signature') {
      await handleSignatureUpload(from, user, mediaId, session, storage);
      return;
    }
    
    if (completionStep === 'awaiting_invoice') {
      await handleInvoiceUpload(from, user, mediaId, session, storage);
      return;
    }
  }

  // If technician is in a specific upload step, attach to current service
  if (user.role === 'technician' && session.conversationState?.currentServiceId) {
    const step = session.conversationState?.step;
    const serviceId = session.conversationState.currentServiceId as string;

    // For MVP, we store the WhatsApp media ID strings in beforePhotos/afterPhotos arrays
    // A separate job or admin can exchange IDs for CDN links if needed.
    const service = await storage.getServiceRequest(serviceId);
    if (!service) {
      await sendTextMessage(from, '❌ Service not found. Please select the service again.');
      return;
    }

    const beforePhotos = Array.isArray(service.beforePhotos) ? service.beforePhotos.slice() : [];
    const afterPhotos = Array.isArray(service.afterPhotos) ? service.afterPhotos.slice() : [];
    const locationProofPhotos = Array.isArray(service.locationProofPhotos) ? service.locationProofPhotos.slice() : [];

    // Handle location proof photos for technicians starting service
    if (step === 'awaiting_location_proof') {
      if (mediaId) locationProofPhotos.push(`wa:${mediaId}`);
      await storage.updateServiceRequest(serviceId, { locationProofPhotos });
      await sendTextMessage(from, '✅ Location proof photo saved. You can now start the service.');
      
      // Show service start options
      const container = await storage.getContainer(service.containerId);
      const message = `🔧 *Service Details*
      
📋 Request: ${service.requestNumber}
📦 Container: ${container?.containerCode || 'Unknown'}
📍 Location: ${(container as any)?.currentLocation?.address || 'Unknown'}
🔧 Issue: ${service.issueDescription}
⏰ Scheduled: ${service.scheduledDate ? new Date(service.scheduledDate).toLocaleDateString() : 'Not scheduled'}
📊 Status: ${service.status.toUpperCase()}

Ready to start service?`;

      await sendInteractiveButtons(
        from,
        message,
        [
          { id: 'start_service', title: '🔧 Start Service' },
          { id: 'back', title: '⬅️ Back' }
        ]
      );
      
      // Update session state
      await storage.updateWhatsappSession(session.id, {
        conversationState: { ...session.conversationState, step: 'service_started' }
      });
      return;
    }

    if (step === 'awaiting_before_photos') {
      if (mediaId) beforePhotos.push(`wa:${mediaId}`);
      await storage.updateServiceRequest(serviceId, { beforePhotos });
      await sendTextMessage(from, '✅ Before photo saved. Send more or choose "Upload Docs" to continue.');
      return;
    }

    if (step === 'awaiting_after_photos') {
      if (mediaId) afterPhotos.push(`wa:${mediaId}`);
      await storage.updateServiceRequest(serviceId, { afterPhotos });
      await sendTextMessage(from, '✅ After photo saved. Send more or choose "Complete" to finalize.');
      return;
    }

    if (step === 'awaiting_report') {
      // Save report as a text note containing media reference; UI can render link via proxy
      const existing = typeof service.resolutionNotes === 'string' ? service.resolutionNotes : '';
      const reportNote = `${existing}\nReport: ${mediaType.toUpperCase()} wa:${mediaId} ${caption}`.trim();
      await storage.updateServiceRequest(serviceId, { resolutionNotes: reportNote });
      await sendTextMessage(from, '✅ Report received. You can now complete the service.');
      return;
    }
  }

  // Default acknowledgements
  if (user.role === 'client') {
    await sendTextMessage(from, '📷 Media received! Mention the request number to attach it to a service.');
  } else if (user.role === 'technician') {
    await sendTextMessage(from, '📷 Media received! Use the buttons to attach to a selected service.');
  } else {
    await sendTextMessage(from, '📎 Media received.');
  }
}

// Complete Service Request Flow via WhatsApp (PRD Section 4.4.1)
export class ServiceRequestViaWhatsApp {
  private storage: any;

  constructor() {
    this.initializeStorage();
  }

  private async initializeStorage() {
    const { storage } = await import('../storage');
    this.storage = storage;
  }

  // Handle service request priority selection (PRD 4.4.1.3)
  async handlePrioritySelection(buttonId: string, from: string, user: any, session: any): Promise<void> {
    const conversationState = session.conversationState || {};
    const cleanPhone = from.startsWith('+') ? from.slice(1) : from;

    try {
      // Map button IDs to priorities
      const priorityMap: Record<string, string> = {
        'priority_urgent': 'urgent',
        'priority_high': 'high',
        'priority_normal': 'normal',
        'priority_low': 'low'
      };

      const priority = priorityMap[buttonId];
      if (!priority) {
        await sendTextMessage(from, 'Invalid priority selection. Please try again.');
        return;
      }

      // Create service request
      const serviceRequest = await this.storage.createServiceRequest({
        requestNumber: `SR-${Date.now()}`,
        containerId: conversationState.selectedContainerId,
        customerId: user.id,
        issueDescription: conversationState.issueDescription,
        priority: priority,
        status: 'pending',
        createdBy: user.id,
        createdAt: new Date(),
      });

      // Send confirmation with next steps
      const message = `✅ *Service Request Created!*

📋 Request #${serviceRequest.requestNumber}
🔥 Priority: ${priority.toUpperCase()}
🔧 Issue: ${conversationState.issueDescription}
📦 Container: ${conversationState.containerInfo.containerCode}

Our team will review and assign a technician. You'll receive updates via WhatsApp.

What would you like to do next?`;

      await sendInteractiveButtons(
        from,
        message,
        [
          { id: 'track_request', title: 'Track Request' },
          { id: 'new_request', title: 'New Request' },
          { id: 'help', title: 'Get Help' }
        ]
      );

      // Clear conversation state
      await this.storage.updateWhatsappSession(session.id, {
        conversationState: {},
      });

      // Log the service request creation
      await this.storage.createAuditLog({
        userId: user.id,
        action: 'service_request_created_via_whatsapp',
        entityType: 'service_request',
        entityId: serviceRequest.id,
        source: 'whatsapp',
        timestamp: new Date(),
      });

    } catch (error) {
      console.error('Error creating service request:', error);
      await sendTextMessage(from, '❌ Error creating service request. Please try again or contact support.');
    }
  }

  // Initiate service request flow for clients
  async initiateServiceRequestFlow(from: string, user: any, session: any): Promise<void> {
    // Update conversation state
    await this.storage.updateWhatsappSession(session.id, {
      conversationState: {
        step: 'awaiting_container_selection',
        userId: user.id,
        flow: 'service_request'
      },
    });

    const customer = await this.storage.getCustomerByUserId(user.id);
    if (customer) {
      const containers = await this.storage.getContainersByCustomer(customer.id);
      const activeContainers = containers.filter((c: any) => c.status === 'active');

      if (activeContainers.length === 0) {
        await sendTextMessage(from, '❌ No active containers found. Please contact support to activate containers.');
        return;
      }

      if (activeContainers.length === 1) {
        // Single container - skip selection and go to issue description
        await this.handleContainerSelection(activeContainers[0].id, from, user, session);
      } else {
        // Multiple containers - show selection
        const containerOptions = activeContainers.map((container: any) => ({
          id: container.id,
          title: `${container.containerCode} - ${container.type}`,
          description: `Status: ${container.status} | Location: ${container.currentLocation?.address || 'Unknown'}`,
        }));

        await sendInteractiveList(
          from,
          '🔧 *Service Request*\n\nWhich container needs service?',
          'Select Container',
          [{ title: 'Containers', rows: containerOptions }]
        );
      }
    }
  }

  // Handle container selection
  async handleContainerSelection(containerId: string, from: string, user: any, session: any): Promise<void> {
    const container = await this.storage.getContainer(containerId);
    if (!container) {
      await sendTextMessage(from, '❌ Container not found. Please try again.');
      return;
    }

    // Update conversation state
    await this.storage.updateWhatsappSession(session.id, {
      conversationState: {
        step: 'awaiting_issue_description',
        userId: user.id,
        flow: 'service_request',
        selectedContainerId: containerId,
        containerInfo: container
      },
    });

    // Send issue description prompt
    const message = `📦 *Container Selected: ${container.containerCode}*\n\n🔧 Please describe the issue you\'re experiencing:\n\n• What seems to be the problem?\n• When did it start?\n• Any error messages or unusual behavior?\n\nType your description or use voice note.`;

    await sendTextMessage(from, message);
  }

  // Handle issue description text input
  async handleIssueDescription(description: string, from: string, user: any, session: any): Promise<void> {
    const conversationState = session.conversationState || {};

    if (conversationState.step !== 'awaiting_issue_description') {
      await sendTextMessage(from, '❌ Invalid step. Please start a new service request.');
      return;
    }

    // Update conversation state
    await this.storage.updateWhatsappSession(session.id, {
      conversationState: {
        step: 'awaiting_priority_selection',
        userId: user.id,
        flow: 'service_request',
        selectedContainerId: conversationState.selectedContainerId,
        issueDescription: description,
        containerInfo: conversationState.containerInfo
      },
    });

    // Send priority selection
    const message = `📋 *Issue Description Received*\n\n"${description}"\n\n🔥 Select service priority:`;

    await sendInteractiveButtons(
      from,
      message,
      [
        { id: 'priority_urgent', title: '🚨 Urgent (Critical)' },
        { id: 'priority_high', title: '⚠️ High (24h)' },
        { id: 'priority_normal', title: '📅 Normal (72h)' },
        { id: 'priority_low', title: '⏰ Low (Scheduled)' }
      ]
    );
  }

  // Handle priority selection (by priority id) and create service request
  async handlePrioritySelectionById(priority: string, from: string, user: any, session: any): Promise<void> {
    const conversationState = session.conversationState || {};

    if (conversationState.step !== 'awaiting_priority_selection') {
      await sendTextMessage(from, '❌ Invalid step. Please start a new service request.');
      return;
    }

    try {
      // Create service request
      const serviceRequest = await this.storage.createServiceRequest({
        requestNumber: `SR-${Date.now()}`,
        containerId: conversationState.selectedContainerId,
        customerId: user.id,
        issueDescription: conversationState.issueDescription,
        priority: priority.replace('priority_', ''),
        status: 'pending',
        createdBy: user.id,
        createdAt: new Date(),
      });

      // Send confirmation message
      const message = `✅ *Service Request Created!*\n\n📋 Request #${serviceRequest.requestNumber}\n🔧 Issue: ${conversationState.issueDescription}\n🔥 Priority: ${priority.replace('priority_', '').toUpperCase()}\n📦 Container: ${conversationState.containerInfo.containerCode}\n\nOur team will review and schedule this service. You\'ll receive updates via WhatsApp.`;

      await sendTextMessage(from, message);

      // Clear conversation state
      await this.storage.updateWhatsappSession(session.id, {
        conversationState: {},
      });

      // Log the service request creation
      await this.storage.createAuditLog({
        userId: user.id,
        action: 'service_request_created_via_whatsapp',
        entityType: 'service_request',
        entityId: serviceRequest.id,
        source: 'whatsapp',
        timestamp: new Date(),
      });

  } catch (error) {
      console.error('Error creating service request:', error);
      await sendTextMessage(from, '❌ Error creating service request. Please try again or contact support.');
    }
  }

  // Handle container selection from list
  async handleContainerListSelection(containerId: string, from: string, user: any, session: any): Promise<void> {
    await this.handleContainerSelection(containerId, from, user, session);
  }

  // Handle all service request flow steps
  async handleServiceRequestFlow(message: any, user: any, session: any): Promise<void> {
    const conversationState = session.conversationState || {};
    const text = message.text?.body?.trim();

    switch (conversationState.step) {
      case 'awaiting_container_selection':
        // This shouldn't happen as container selection is handled via interactive messages
        break;

      case 'awaiting_issue_description':
        await this.handleIssueDescription(text, message.from, user, session);
        break;

      case 'awaiting_priority_selection':
        // Priority is handled via button clicks, not text
        await sendTextMessage(message.from, 'Please use the priority buttons to continue.');
        break;

      default:
        await sendTextMessage(message.from, 'Service request flow not active. Type "service" to start a new request.');
    }
  }
}

// Global instance for easy access
export const serviceRequestViaWhatsApp = new ServiceRequestViaWhatsApp();

// Legacy function (kept for backward compatibility)
async function initiateServiceRequestFlow(from: string, user: any, session: any): Promise<void> {
  await serviceRequestViaWhatsApp.initiateServiceRequestFlow(from, user, session);
}

// Additional technician workflow functions for complete PRD compliance
async function startNextService(from: string, user: any, conversationState: any): Promise<void> {
  const { storage } = await import('../storage');

  const nextService = await storage.getNextScheduledService(user.id);
  if (nextService) {
    const serviceReq = nextService.serviceRequestId ? await storage.getServiceRequest(nextService.serviceRequestId) : undefined;
    const container = serviceReq?.containerId ? await storage.getContainer(serviceReq.containerId) : undefined;
    const message = `🔄 *Next Service*

📦 Container: ${container?.containerCode || 'TBD'}
📍 Location: ${typeof container?.currentLocation === 'object' && container?.currentLocation && (container as any).currentLocation.address ? (container as any).currentLocation.address : 'Unknown'}
🔧 Issue: ${serviceReq?.issueDescription || 'TBD'}

Ready to proceed?`;

    await sendInteractiveButtons(
      from,
      message,
      [
        { id: 'start_travel_next', title: 'Start Travel' },
        { id: 'reschedule_service', title: 'Reschedule' },
        { id: 'skip_service', title: 'Skip Service' }
      ]
    );
  } else {
    await sendTextMessage(from, '✅ All services completed for today!');
  }
}

async function rescheduleService(from: string, user: any, conversationState: any): Promise<void> {
  await sendTextMessage(from, '📅 *Service Rescheduled*\n\nPlease contact your coordinator to reschedule this service.');
}

async function skipService(from: string, user: any, conversationState: any): Promise<void> {
  await sendTextMessage(from, '⏭️ *Service Skipped*\n\nService has been marked as skipped. Coordinator will follow up.');
}

async function submitTimesheet(from: string, user: any, conversationState: any): Promise<void> {
  const message = `📊 *Daily Timesheet*

Please submit your completed timesheet:

• Total services: [Count]
• Total travel time: [Time]
• Total work time: [Time]

Upload your timesheet or contact your supervisor.`;

  await sendInteractiveButtons(
    from,
    message,
    [
      { id: 'upload_timesheet', title: 'Upload Timesheet' },
      { id: 'contact_supervisor', title: 'Contact Supervisor' }
    ]
  );
}

async function reportEndOfDayIssues(from: string, user: any, conversationState: any): Promise<void> {
  await sendTextMessage(from, '📝 *End of Day Report*\n\nPlease report any issues or concerns from today\'s services.');
}

async function endDay(from: string, user: any, conversationState: any): Promise<void> {
  const message = `🏁 *Day Complete!*

✅ All services completed
📋 Timesheet submitted
🔧 Equipment checked

Great job today! See you tomorrow.`;

  await sendTextMessage(from, message);
}

// Handle service request text input
async function handleServiceRequestText(text: string, from: string, user: any, session: any): Promise<void> {
  // This would handle text-based service requests
  await sendTextMessage(from, 'Please use the interactive buttons for service requests.');
}

// Approve service request
async function approveServiceRequest(serviceRequestId: string, from: string, user: any): Promise<void> {
  const { storage } = await import('../storage');

  const serviceRequest = await storage.getServiceRequest(serviceRequestId);
  if (serviceRequest && serviceRequest.customerId === user.id) {
    await storage.updateServiceRequest(serviceRequestId, { status: 'approved' });
    await sendInteractiveButtons(
      from,
      '✅ *Service Request Approved!*\n\nOur team will schedule this service shortly. You\'ll receive updates via WhatsApp.',
      [
        { id: 'track_request', title: 'Track Request' },
        { id: 'new_request', title: 'New Request' }
      ]
    );
  } else {
    await sendTextMessage(from, '❌ Service request not found or not authorized.');
  }
}

// Schedule service later
async function scheduleServiceLater(serviceRequestId: string, from: string, user: any): Promise<void> {
  const { storage } = await import('../storage');

  const serviceRequest = await storage.getServiceRequest(serviceRequestId);
  if (serviceRequest && serviceRequest.customerId === user.id) {
    await storage.updateServiceRequest(serviceRequestId, { status: 'pending' });
    await sendInteractiveButtons(
      from,
      '⏰ *Service Request Noted*\n\nWe\'ll schedule this service when convenient for you. Our team will be in touch.',
      [
        { id: 'track_request', title: 'Track Request' },
        { id: 'new_request', title: 'New Request' }
      ]
    );
  } else {
    await sendTextMessage(from, '❌ Service request not found or not authorized.');
  }
}

// Submit feedback
async function submitFeedback(feedbackRequestId: string, userId: string, rating: number, from: string): Promise<void> {
  const { storage } = await import('../storage');

  const feedback = await storage.getFeedback(feedbackRequestId);
  if (feedback && feedback.customerId === userId) {
    await storage.updateFeedback(feedbackRequestId, {
      rating,
      submittedAt: new Date(),
    });

    const messages = {
      5: '🌟 Thank you for the excellent rating! We appreciate your feedback.',
      4: '⭐ Thank you for the positive feedback! We\'ll keep up the good work.',
      3: '👍 Thanks for your feedback! We\'ll work on improving.',
      2: '😔 Sorry to hear that. We\'ll reach out to make things right.',
      1: '😞 We\'re sorry for the poor experience. Our team will contact you immediately.',
    };

    await sendTextMessage(from, messages[rating as keyof typeof messages] || 'Thank you for your feedback!');
  }
}

// Enhanced Technician Workflow Functions (PRD Section 4.6.2)
export async function initiateTechnicianWorkflow(technician: any, scheduledServices: any[]): Promise<any> {
  const { storage } = await import('../storage');

  // Send schedule with interactive buttons
  const message = await formatTechnicianScheduleMessage(scheduledServices);

  return await sendInteractiveButtons(
    technician.phoneNumber,
    message,
    [
      { id: 'acknowledge_schedule', title: 'Acknowledge Schedule' },
      { id: 'view_details', title: 'View Details' },
      { id: 'report_issue', title: 'Report Issue' }
    ]
  );
}

export async function handleTechnicianAcknowledge(technicianId: string, from: string): Promise<void> {
  const { storage } = await import('../storage');

  // Update technician status and acknowledge schedule
  await storage.updateTechnician(technicianId, { status: 'available' });

  // Send confirmation and next steps
  await sendTextMessage(from, '✅ Schedule acknowledged successfully!\n\nYour schedule is confirmed. You\'ll receive travel notifications when it\'s time to start.');

  // Log the acknowledgment
  await storage.createAuditLog({
    userId: technicianId,
    action: 'schedule_acknowledged',
    entityType: 'scheduled_service',
    source: 'whatsapp',
    timestamp: new Date(),
  });
}

export async function handleTechnicianStartTravel(technicianId: string, serviceId: string, from: string): Promise<void> {
  const { storage } = await import('../storage');

  // Update service status to in progress (travel)
  await storage.updateScheduledService(serviceId, {
    status: 'in_progress',
    actualStartTime: new Date(),
  });

  // Send next service details
  const nextService = await storage.getNextScheduledService(technicianId);
  if (nextService) {
    const serviceReq = nextService.serviceRequestId ? await storage.getServiceRequest(nextService.serviceRequestId) : undefined;
    const container = serviceReq?.containerId ? await storage.getContainer(serviceReq.containerId) : undefined;
    const message = `🚗 Travel started to:\n\n📍 ${typeof container?.currentLocation === 'object' && container?.currentLocation && (container as any).currentLocation.address ? (container as any).currentLocation.address : 'Location'}\n🔧 Container: ${container?.containerCode || 'TBD'}\n📋 Issue: ${serviceReq?.issueDescription || 'TBD'}\n\n⏱️ ETA: ${calculateETA(nextService)}`;

    await sendInteractiveButtons(
      from,
      message,
      [
        { id: 'arrived_at_location', title: 'Arrived at Location' },
        { id: 'call_customer', title: 'Call Customer' },
        { id: 'need_directions', title: 'Need Directions' }
      ]
    );
  } else {
    await sendTextMessage(from, '🚗 Travel started. Safe journey to the first service location!');
  }
}

export async function handleTechnicianArrival(technicianId: string, serviceId: string, from: string): Promise<void> {
  const { storage } = await import('../storage');

  // Update service status and arrival time
  await storage.updateScheduledService(serviceId, {
    status: 'in_progress',
    actualStartTime: new Date(),
  });

  // Send service start prompt
  const service = await storage.getScheduledService(serviceId);
  if (service) {
    const serviceReq = service.serviceRequestId ? await storage.getServiceRequest(service.serviceRequestId) : undefined;
    const container = serviceReq?.containerId ? await storage.getContainer(serviceReq.containerId) : undefined;
    const message = `📍 *Arrival Confirmed*\n\n🔧 Service: ${serviceReq?.issueDescription || 'TBD'}\n📦 Container: ${container?.containerCode || 'TBD'}\n⚙️ Required Parts: ${serviceReq?.requiredParts?.join(', ') || 'None'}\n\nReady to start service?`;

    await sendInteractiveButtons(
      from,
      message,
      [
        { id: 'start_service_work', title: 'Start Service' },
        { id: 'missing_parts', title: 'Missing Parts' },
        { id: 'need_help', title: 'Need Help' },
        { id: 'customer_not_ready', title: 'Customer Not Ready' }
      ]
    );
  }
}

export async function handleTechnicianStartService(technicianId: string, serviceId: string, from: string): Promise<void> {
  const { storage } = await import('../storage');

  // Update service request status
  await storage.updateServiceRequest(serviceId, {
    status: 'in_progress',
    actualStartTime: new Date(),
  });

  // Send service completion checklist
  const message = `🔧 *Service Started*\n\n✅ Parts verified\n📋 Complete the service and upload documentation:\n\n• Before photos\n• Repair process\n• After photos\n• Used parts confirmation\n• Customer signature`;

  await sendInteractiveButtons(
    from,
    message,
    [
      { id: 'upload_before_photos', title: 'Upload Before Photos' },
      { id: 'complete_service', title: 'Complete Service' },
      { id: 'need_assistance', title: 'Need Assistance' }
    ]
  );
}

export async function handleTechnicianCompleteService(technicianId: string, serviceId: string, from: string): Promise<void> {
  const { storage } = await import('../storage');

  // Update service request status to completed
  await storage.updateServiceRequest(serviceId, {
    status: 'completed',
    actualEndTime: new Date(),
  });

  // Calculate and log service duration
  const service = await storage.getServiceRequest(serviceId);
  if (service) {
    // Guard against null actualStartTime
    const startMs = service.actualStartTime
      ? new Date(service.actualStartTime).getTime()
      : Date.now();
    const duration = Math.max(0, Math.round((Date.now() - startMs) / (1000 * 60)));
    await storage.updateServiceRequest(serviceId, { serviceDuration: duration });

    // Send completion confirmation and next steps
    const message = `✅ *Service Completed Successfully!*\n\n⏱️ Duration: ${duration} minutes\n📋 Service documented and saved\n\nNext service will be prompted automatically.`;

    await sendTextMessage(from, message);

    // Check for next service
    const nextService = await storage.getNextScheduledService(technicianId);
    if (nextService) {
      setTimeout(async () => {
        await sendNextServicePrompt(technicianId, from);
      }, 2000);
    } else {
      await sendEndOfDayPrompt(from);
    }
  }
}

export async function handleTechnicianMissingParts(technicianId: string, serviceId: string, from: string): Promise<void> {
  const { storage } = await import('../storage');

  // Report missing parts and update service status
  await storage.updateServiceRequest(serviceId, {
    status: 'pending',
    resolutionNotes: 'Missing required parts - awaiting procurement',
  });

  await sendTextMessage(from, '⚠️ *Missing Parts Reported*\n\nSupport team has been notified. You\'ll be updated when parts are available.');

  // Notify admin/coordinator
  const admins = await storage.getUsersByRole('admin');
  for (const admin of admins) {
    await sendTextMessage(
      admin.phoneNumber,
      `🚨 *Parts Alert*\n\nTechnician ${technicianId} reported missing parts for Service Request ${serviceId}.\n\nPlease arrange procurement immediately.`
    );
  }
}

export async function handleTechnicianNeedHelp(technicianId: string, serviceId: string, from: string): Promise<void> {
  const { storage } = await import('../storage');

  await sendTextMessage(from, '🆘 *Help Request Sent*\n\nSupport team has been notified and will contact you shortly.');

  // Notify admin/coordinator
  const coordinators = await storage.getUsersByRole('coordinator');
  for (const coordinator of coordinators) {
    await sendTextMessage(
      coordinator.phoneNumber,
      `🆘 *Technician Needs Help*\n\nTechnician ${technicianId} needs assistance with Service Request ${serviceId}.\n\nPlease contact them immediately.`
    );
  }
}

// Helper functions for technician workflow
async function formatTechnicianScheduleMessage(scheduledServices: any[]): Promise<string> {
  if (scheduledServices.length === 0) {
    return '📋 *No Services Scheduled*\n\nYou have no services scheduled for today. Enjoy your day off!';
  }

  let message = `📋 *Today's Schedule (${new Date().toLocaleDateString()})*\n\nTotal Services: ${scheduledServices.length}\n\n`;

  for (let i = 0; i < scheduledServices.length; i++) {
    const service = scheduledServices[i];
    message += `${i + 1}️⃣ *${service.estimatedStartTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'TBD'}*\n`;
    message += `   📦 Container: ${service.container?.containerCode || service.container?.containerId}\n`;
    message += `   📍 Location: ${service.container?.currentLocation?.address || 'Unknown'}\n`;
    message += `   🔧 Issue: ${service.serviceRequest?.issueDescription}\n`;
    if (service.serviceRequest?.requiredParts?.length > 0) {
      message += `   ⚙️ Parts: ${service.serviceRequest.requiredParts.join(', ')}\n`;
    }
    message += '\n';
  }

  message += '🗺️ Route Map: [View Route]\n\n';
  return message;
}

async function sendNextServicePrompt(technicianId: string, from: string): Promise<void> {
  const { storage } = await import('../storage');

  const nextService = await storage.getNextScheduledService(technicianId);
  if (nextService) {
    const serviceReq = nextService.serviceRequestId ? await storage.getServiceRequest(nextService.serviceRequestId) : undefined;
    const container = serviceReq?.containerId ? await storage.getContainer(serviceReq.containerId) : undefined;
    const message = `🔄 *Next Service*\n\n📦 Container: ${container?.containerCode || 'TBD'}\n📍 Location: ${typeof container?.currentLocation === 'object' && container?.currentLocation && (container as any).currentLocation.address ? (container as any).currentLocation.address : 'Unknown'}\n🔧 Issue: ${serviceReq?.issueDescription || 'TBD'}\n\nReady to proceed?`;

    await sendInteractiveButtons(
      from,
      message,
      [
        { id: 'start_travel_next', title: 'Start Travel' },
        { id: 'reschedule_service', title: 'Reschedule' },
        { id: 'skip_service', title: 'Skip Service' }
      ]
    );
  }
}

async function sendEndOfDayPrompt(from: string): Promise<void> {
  const message = `🏁 *End of Day*\n\n✅ All services completed!\n\n📊 Please submit your timesheet:\n• Total services: [Count]\n• Total travel time: [Time]\n• Total work time: [Time]\n\nGreat job today!`;

  await sendInteractiveButtons(
    from,
    message,
    [
      { id: 'submit_timesheet', title: 'Submit Timesheet' },
      { id: 'report_issues', title: 'Report Issues' },
      { id: 'end_day', title: 'End Day' }
    ]
  );
}

function calculateETA(service: any): string {
  // Simple ETA calculation - in production, use Google Maps Distance Matrix API
  return '30 minutes';
}

// Technician workflow functions (legacy - kept for backward compatibility)
async function acknowledgeSchedule(from: string, user: any, conversationState: any): Promise<void> {
  await handleTechnicianAcknowledge(user.id, from);
}

async function startTravel(from: string, user: any, conversationState: any): Promise<void> {
  const serviceId = conversationState?.currentServiceId;
  if (serviceId) {
    await handleTechnicianStartTravel(user.id, serviceId, from);
  } else {
    await sendTextMessage(from, '❌ No active service found. Please contact support.');
  }
}

async function confirmArrival(from: string, user: any, conversationState: any): Promise<void> {
  const serviceId = conversationState?.currentServiceId;
  if (serviceId) {
    await handleTechnicianArrival(user.id, serviceId, from);
  } else {
    await sendTextMessage(from, '❌ No active service found. Please contact support.');
  }
}

async function startService(from: string, user: any, conversationState: any): Promise<void> {
  const serviceId = conversationState?.currentServiceId;
  if (serviceId) {
    await handleTechnicianStartService(user.id, serviceId, from);
  } else {
    await sendTextMessage(from, '❌ No active service found. Please contact support.');
  }
}

async function completeService(from: string, user: any, conversationState: any): Promise<void> {
  const serviceId = conversationState?.currentServiceId;
  if (serviceId) {
    await handleTechnicianCompleteService(user.id, serviceId, from);
  } else {
    await sendTextMessage(from, '❌ No active service found. Please contact support.');
  }
}

async function requestPhotoUpload(from: string, user: any, conversationState: any): Promise<void> {
  await sendTextMessage(from, '📸 Please upload before and after photos to complete the service documentation.');
}

async function reportMissingParts(from: string, user: any, conversationState: any): Promise<void> {
  const serviceId = conversationState?.currentServiceId;
  if (serviceId) {
    await handleTechnicianMissingParts(user.id, serviceId, from);
  } else {
    await sendTextMessage(from, '❌ No active service found. Please contact support.');
  }
}

async function requestHelp(from: string, user: any, conversationState: any): Promise<void> {
  const serviceId = conversationState?.currentServiceId;
  if (serviceId) {
    await handleTechnicianNeedHelp(user.id, serviceId, from);
  } else {
    await sendTextMessage(from, '❌ No active service found. Please contact support.');
  }
}

// Automated Customer Communication Flows (PRD Section 4.8)
export class CustomerCommunicationService {
  private storage: any;

  constructor() {
    this.initializeStorage();
  }

  private async initializeStorage() {
    const { storage } = await import('../storage');
    this.storage = storage;
  }

  // Send alert notification to customer (PRD 4.2.2)
  async sendAlertNotification(alertId: string, customerId: string): Promise<void> {
    let templateName: string;
    let parameters: string[];

    const alert = await this.storage.getAlert(alertId);
    const container = await this.storage.getContainer(alert.containerId);
    const customer = await this.storage.getCustomer(customerId);

    if (!alert || !container || !customer) {
      console.error(`Missing data for alert notification: alert=${!!alert}, container=${!!container}, customer=${!!customer}`);
      return;
    }

    const customerUser = await this.storage.getUser(customer.userId);
    if (!customerUser) {
      console.error(`Customer user not found for customer ${customerId}`);
      return;
    }

    // Check if customer has WhatsApp enabled
    if (!customer.whatsappNumber) {
      console.error(`Customer ${customerId} does not have WhatsApp number configured`);
      return;
    }

    try {
      if (['critical', 'high'].includes(alert.severity)) {
        templateName = alert.severity === 'critical' ? 'CRITICAL_ALERT' : 'HIGH_ALERT';
        parameters = [
          container.containerCode,
          alert.title,
          container.currentLocation?.address || 'Unknown Location',
          alert.id.substring(0, 8) // Short alert ID
        ];
      } else {
        // For other severities, send a text message
        const textMessage = `⚠️ ${alert.severity.toUpperCase()} ALERT\n\nContainer: ${container.containerCode}\nIssue: ${alert.title}\nLocation: ${container.currentLocation?.address || 'Unknown'}\n\nPlease check your dashboard for details.`;

        try {
          await sendTemplateMessage(
            customer.whatsappNumber,
            'HIGH_ALERT',
            'en',
            [
            container.containerCode,
            alert.title,
            container.currentLocation?.address || 'Unknown Location',
            alert.id.substring(0, 8)
            ]
          );
        } catch (templateError) {
          console.error('Template message failed, sending text message instead');
          await sendTextMessage(customer.whatsappNumber, textMessage);
        }
        return;
      }

      await sendTemplateMessage(customer.whatsappNumber, templateName, 'en', parameters);

      // Log the communication
      await this.storage.createWhatsappMessage({
        recipientType: 'customer',
        recipientId: customerUser.id,
        phoneNumber: customer.whatsappNumber,
        messageType: 'template',
        templateName,
        messageContent: { alert, container, parameters },
        whatsappMessageId: `alert_${alertId}_${Date.now()}`,
        status: 'sent',
        relatedEntityType: 'alert',
        relatedEntityId: alertId,
        sentAt: new Date(),
      });

      console.log(`✅ WhatsApp alert notification sent successfully for alert ${alertId}`);
    } catch (templateError) {
      console.error('Template message failed, sending text message instead');
      const textMessage = `🚨 ${alert.severity.toUpperCase()} ALERT\n\nContainer: ${container.containerCode}\nIssue: ${alert.title}\nLocation: ${container.currentLocation?.address || 'Unknown'}\n\nService will be scheduled shortly.`;
      await sendTextMessage(customer.whatsappNumber, textMessage);
    }
  }

  // Auto-trigger alert notifications when alerts are created (PRD 4.2.2)
  async triggerAlertNotification(alertId: string): Promise<void> {
    try {
      const alert = await this.storage.getAlert(alertId);
      if (!alert) return;

      const container = await this.storage.getContainer(alert.containerId);
      if (!container || !container.currentCustomerId) return;

      // Send notification to the customer assigned to this container
      await this.sendAlertNotification(alertId, container.currentCustomerId);
    } catch (error) {
      console.error(`Failed to trigger alert notification for alert ${alertId}:`, error);
    }
  }

  // Send service schedule confirmation to customer (PRD 4.5.2)
  async sendServiceScheduleConfirmation(serviceRequestId: string): Promise<void> {
    const serviceRequest = await this.storage.getServiceRequest(serviceRequestId);
    if (!serviceRequest) return;

    const customer = await this.storage.getCustomer(serviceRequest.customerId);
    if (!customer) return;

    const customerUser = await this.storage.getUser(customer.userId);
    if (!customerUser) return;

    const scheduledService = await this.storage.getScheduledServicesByTechnician(
      serviceRequest.assignedTechnicianId,
      new Date().toISOString().split('T')[0]
    );

    const service = scheduledService.find((s: any) => s.serviceRequestId === serviceRequestId);
    if (!service) return;

    const technician = await this.storage.getTechnician(serviceRequest.assignedTechnicianId);
    if (!technician) return;

    const parameters = [
      serviceRequest.containerId, // Container ID
      service.scheduledDate.toISOString().split('T')[0], // Date
      service.scheduledTimeWindow || 'TBD', // Time window
      technician.name, // Technician name
      `${process.env.FRONTEND_URL || 'https://container-genie.com'}/dashboard` // Dashboard link
    ];

    await sendTemplateMessage(customerUser.phoneNumber, 'service_schedule_client', 'en', parameters);

    // Log the communication
    await this.storage.createWhatsappMessage({
      recipientType: 'customer',
      recipientId: customerUser.id,
      phoneNumber: customerUser.phoneNumber,
      messageType: 'template',
      templateName: 'service_schedule_client',
      messageContent: { serviceRequest, service, technician, parameters },
      whatsappMessageId: `schedule_${serviceRequestId}_${Date.now()}`,
      status: 'sent',
      relatedEntityType: 'service_request',
      relatedEntityId: serviceRequestId,
      sentAt: new Date(),
    });
  }

  // Send invoice to customer (PRD 4.4.2)
  async sendInvoice(invoiceId: string): Promise<void> {
    const invoice = await this.storage.getInvoice(invoiceId);
    if (!invoice) return;

    const customer = await this.storage.getCustomer(invoice.customerId);
    if (!customer) return;

    const customerUser = await this.storage.getUser(customer.userId);
    if (!customerUser) return;

    const serviceRequest = await this.storage.getServiceRequest(invoice.serviceRequestId);

    const parameters = [
      invoice.invoiceNumber,
      serviceRequest?.issueDescription || 'Container Service',
      invoice.totalAmount.toString(),
      invoice.dueDate.toISOString().split('T')[0],
      `${process.env.FRONTEND_URL || 'https://container-genie.com'}/invoice/${invoice.id}` // PDF link
    ];

    await sendTemplateMessage(customerUser.phoneNumber, 'invoice_generated', 'en', parameters);

    // Update invoice sent timestamp
    await this.storage.updateInvoice(invoiceId, { sentAt: new Date() });

    // Log the communication
    await this.storage.createWhatsappMessage({
      recipientType: 'customer',
      recipientId: customerUser.id,
      phoneNumber: customerUser.phoneNumber,
      messageType: 'template',
      templateName: 'invoice_generated',
      messageContent: { invoice, serviceRequest, parameters },
      whatsappMessageId: `invoice_${invoiceId}_${Date.now()}`,
      status: 'sent',
      relatedEntityType: 'invoice',
      relatedEntityId: invoiceId,
      sentAt: new Date(),
    });
  }

  // Send payment reminder (PRD 4.4.2)
  async sendPaymentReminder(invoiceId: string): Promise<void> {
    const invoice = await this.storage.getInvoice(invoiceId);
    if (!invoice || invoice.paymentStatus !== 'pending') return;

    const customer = await this.storage.getCustomer(invoice.customerId);
    if (!customer) return;

    const customerUser = await this.storage.getUser(customer.userId);
    if (!customerUser) return;

    // Calculate days until due
    const daysUntilDue = Math.ceil((invoice.dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue <= 0) {
      // Overdue reminder
      const message = `💳 *Payment Overdue*\n\nInvoice #${invoice.invoiceNumber}\nAmount: ₹${invoice.totalAmount}\n\nPlease make payment immediately to avoid service interruption.\n\n[Pay Now]`;
      await sendTextMessage(customerUser.phoneNumber, message);
    } else {
      // Regular reminder
      const parameters = [
        invoice.invoiceNumber,
        invoice.dueDate.toISOString().split('T')[0],
        invoice.totalAmount.toString()
      ];

      await sendTemplateMessage(customerUser.phoneNumber, 'payment_reminder', 'en', parameters);
    }

    // Log the communication
    await this.storage.createWhatsappMessage({
      recipientType: 'customer',
      recipientId: customerUser.id,
      phoneNumber: customerUser.phoneNumber,
      messageType: 'template',
      templateName: 'payment_reminder',
      messageContent: { invoice, daysUntilDue },
      whatsappMessageId: `reminder_${invoiceId}_${Date.now()}`,
      status: 'sent',
      relatedEntityType: 'invoice',
      relatedEntityId: invoiceId,
      sentAt: new Date(),
    });
  }

  // Send feedback request after service completion (PRD 4.7.1)
  async sendFeedbackRequest(serviceRequestId: string): Promise<void> {
    const serviceRequest = await this.storage.getServiceRequest(serviceRequestId);
    if (!serviceRequest || serviceRequest.status !== 'completed') return;

    const customer = await this.storage.getCustomer(serviceRequest.customerId);
    if (!customer) return;

    const customerUser = await this.storage.getUser(customer.userId);
    if (!customerUser) return;

    const technician = await this.storage.getTechnician(serviceRequest.assignedTechnicianId);
    if (!technician) return;

    // Check if feedback already exists
    const existingFeedback = await this.storage.getFeedbackByServiceRequest(serviceRequestId);
    if (existingFeedback) return;

    const message = `⭐ *Service Completed!*\n\nContainer: ${serviceRequest.containerId}\nTechnician: ${technician.name}\nCompleted: ${serviceRequest.actualEndTime?.toLocaleString() || 'Recently'}\n\nPlease rate your experience:`;

    await sendInteractiveButtons(
      customerUser.phoneNumber,
      message,
      [
        { id: 'rate_5', title: '⭐⭐⭐⭐⭐ Excellent' },
        { id: 'rate_4', title: '⭐⭐⭐⭐ Good' },
        { id: 'rate_3', title: '⭐⭐⭐ Average' },
        { id: 'rate_2', title: '⭐⭐ Poor' },
        { id: 'rate_1', title: '⭐ Very Poor' }
      ]
    );

    // Log the communication
    await this.storage.createWhatsappMessage({
      recipientType: 'customer',
      recipientId: customerUser.id,
      phoneNumber: customerUser.phoneNumber,
      messageType: 'interactive',
      messageContent: { serviceRequest, technician },
      whatsappMessageId: `feedback_${serviceRequestId}_${Date.now()}`,
      status: 'sent',
      relatedEntityType: 'service_request',
      relatedEntityId: serviceRequestId,
      sentAt: new Date(),
    });
  }

  // Send welcome message to new customers (PRD 4.3.3)
  async sendWelcomeMessage(customerId: string): Promise<void> {
    const customer = await this.storage.getCustomer(customerId);
    if (!customer) return;

    const customerUser = await this.storage.getUser(customer.userId);
    if (!customerUser) return;

    const parameters = [customerUser.name];

    await sendTemplateMessage(customerUser.phoneNumber, 'welcome_client', 'en', parameters);

    // Log the communication
    await this.storage.createWhatsappMessage({
      recipientType: 'customer',
      recipientId: customerUser.id,
      phoneNumber: customerUser.phoneNumber,
      messageType: 'template',
      templateName: 'welcome_client',
      messageContent: { customer, parameters },
      whatsappMessageId: `welcome_${customerId}_${Date.now()}`,
      status: 'sent',
      relatedEntityType: 'customer',
      relatedEntityId: customerId,
      sentAt: new Date(),
    });
  }

  // Send status update for container (PRD 4.1.2)
  async sendContainerStatusUpdate(containerId: string, customerId: string): Promise<void> {
    const container = await this.storage.getContainer(containerId);
    if (!container || container.currentCustomerId !== customerId) return;

    const customer = await this.storage.getCustomer(customerId);
    if (!customer) return;

    const customerUser = await this.storage.getUser(customer.userId);
    if (!customerUser) return;

    // Get recent alerts for this container
    const alerts = await this.storage.getAlertsByContainer(containerId);
    const activeAlerts = alerts.filter((a: any) => !a.resolvedAt);

    const parameters = [
      container.containerCode,
      container.status.toUpperCase(),
      container.currentLocation?.address || 'Unknown',
      new Date().toLocaleString()
    ];

    await sendTemplateMessage(customerUser.phoneNumber, 'container_status_update', 'en', parameters);

    // Log the communication
    await this.storage.createWhatsappMessage({
      recipientType: 'customer',
      recipientId: customerUser.id,
      phoneNumber: customerUser.phoneNumber,
      messageType: 'template',
      templateName: 'container_status_update',
      messageContent: { container, activeAlerts, parameters },
      whatsappMessageId: `status_${containerId}_${Date.now()}`,
      status: 'sent',
      relatedEntityType: 'container',
      relatedEntityId: containerId,
      sentAt: new Date(),
    });
  }

  /**
   * Send WhatsApp notification to client when service request is updated
   */
  async notifyServiceRequestUpdate(serviceRequestId: string, updateType: 'assigned' | 'started' | 'completed' | 'status_changed' | 'updated', previousData?: any): Promise<void> {
    try {
      const serviceRequest = await this.storage.getServiceRequest(serviceRequestId);
      if (!serviceRequest) {
        console.log(`[WhatsApp] Service request ${serviceRequestId} not found, skipping notification`);
        return;
      }

      const customer = await this.storage.getCustomer(serviceRequest.customerId);
      if (!customer) {
        console.log(`[WhatsApp] Customer not found for service request ${serviceRequestId}, skipping notification`);
        return;
      }

      // Get customer's WhatsApp number
      const whatsappNumber = customer.whatsappNumber || customer.phone;
      if (!whatsappNumber) {
        console.log(`[WhatsApp] Customer ${customer.id} has no WhatsApp number, skipping notification`);
        return;
      }

      // Get related data
      const container = await this.storage.getContainer(serviceRequest.containerId);
      const technician = serviceRequest.assignedTechnicianId 
        ? await this.storage.getTechnician(serviceRequest.assignedTechnicianId)
        : null;
      const technicianUser = technician 
        ? await this.storage.getUser(technician.userId)
        : null;
      const technicianName = technicianUser?.name || technician?.employeeCode || 'Unassigned';

      let message = '';
      let messageType = 'text';

      switch (updateType) {
        case 'assigned':
          message = `🔔 *Service Request Update*\n\n` +
            `✅ *Technician Assigned*\n\n` +
            `📋 Request Number: ${serviceRequest.requestNumber}\n` +
            `📦 Container: ${container?.containerCode || 'Unknown'}\n` +
            `👷 Technician: ${technicianName}\n` +
            (serviceRequest.scheduledDate 
              ? `📅 Scheduled: ${new Date(serviceRequest.scheduledDate).toLocaleDateString()}\n` +
                (serviceRequest.scheduledTimeWindow ? `⏰ Time: ${serviceRequest.scheduledTimeWindow}\n` : '')
              : '') +
            `\nYour service request has been assigned to a technician. You'll receive updates as the service progresses.`;
          break;

        case 'started':
          message = `🔔 *Service Request Update*\n\n` +
            `🚀 *Service Started*\n\n` +
            `📋 Request Number: ${serviceRequest.requestNumber}\n` +
            `📦 Container: ${container?.containerCode || 'Unknown'}\n` +
            `👷 Technician: ${technicianName}\n` +
            `⏰ Started: ${serviceRequest.actualStartTime ? new Date(serviceRequest.actualStartTime).toLocaleString() : 'Just now'}\n` +
            `\nThe technician has started working on your service request.`;
          break;

        case 'completed':
          const duration = serviceRequest.serviceDuration 
            ? `${serviceRequest.serviceDuration} minutes`
            : serviceRequest.actualStartTime && serviceRequest.actualEndTime
            ? `${Math.round((new Date(serviceRequest.actualEndTime).getTime() - new Date(serviceRequest.actualStartTime).getTime()) / 60000)} minutes`
            : 'N/A';
          
          message = `✅ *Service Completed!*\n\n` +
            `📋 Request Number: ${serviceRequest.requestNumber}\n` +
            `📦 Container: ${container?.containerCode || 'Unknown'}\n` +
            `👷 Technician: ${technicianName}\n` +
            `⏰ Completed: ${serviceRequest.actualEndTime ? new Date(serviceRequest.actualEndTime).toLocaleString() : 'Just now'}\n` +
            `⏱️ Duration: ${duration}\n` +
            (serviceRequest.resolutionNotes 
              ? `\n📝 Notes: ${serviceRequest.resolutionNotes.substring(0, 200)}${serviceRequest.resolutionNotes.length > 200 ? '...' : ''}\n`
              : '') +
            `\nThank you for using our service!`;
          break;

        case 'status_changed':
          const statusEmoji: Record<string, string> = {
            'pending': '⏳',
            'scheduled': '📅',
            'in_progress': '🚀',
            'completed': '✅',
            'cancelled': '❌'
          };
          const statusText: Record<string, string> = {
            'pending': 'Pending',
            'scheduled': 'Scheduled',
            'in_progress': 'In Progress',
            'completed': 'Completed',
            'cancelled': 'Cancelled'
          };
          
          message = `🔔 *Service Request Update*\n\n` +
            `${statusEmoji[serviceRequest.status] || '📋'} *Status Changed*\n\n` +
            `📋 Request Number: ${serviceRequest.requestNumber}\n` +
            `📦 Container: ${container?.containerCode || 'Unknown'}\n` +
            `📊 New Status: ${statusText[serviceRequest.status] || serviceRequest.status}\n` +
            (technicianName !== 'Unassigned' ? `👷 Technician: ${technicianName}\n` : '') +
            `\nYour service request status has been updated.`;
          break;

        case 'updated':
          message = `🔔 *Service Request Update*\n\n` +
            `📋 Request Number: ${serviceRequest.requestNumber}\n` +
            `📦 Container: ${container?.containerCode || 'Unknown'}\n` +
            `📊 Status: ${serviceRequest.status}\n` +
            (technicianName !== 'Unassigned' ? `👷 Technician: ${technicianName}\n` : '') +
            `\nYour service request has been updated. Check your dashboard for details.`;
          break;
      }

      if (message) {
        await sendTextMessage(whatsappNumber, message);

        // Log the communication
        const customerUser = await this.storage.getUser(customer.userId);
        if (customerUser) {
          await this.storage.createWhatsappMessage({
            recipientType: 'customer',
            recipientId: customerUser.id,
            phoneNumber: whatsappNumber,
            messageType: messageType as any,
            messageContent: { 
              body: message,
              serviceRequest: {
                id: serviceRequest.id,
                requestNumber: serviceRequest.requestNumber,
                status: serviceRequest.status
              },
              updateType
            },
            whatsappMessageId: `sr_update_${serviceRequestId}_${Date.now()}`,
            status: 'sent',
            relatedEntityType: 'ServiceRequest',
            relatedEntityId: serviceRequestId,
            sentAt: new Date(),
          });
        }

        console.log(`✅ WhatsApp notification sent for service request ${serviceRequestId} (${updateType})`);
      }
    } catch (error) {
      console.error(`[WhatsApp] Error sending service request update notification:`, error);
      // Don't throw - notification failures shouldn't break the main flow
    }
  }
}

// ========================================
// MAIN MESSAGE PROCESSOR
// ========================================

/**
 * Enhanced phone number normalization for accurate user matching
 * Handles multiple phone number formats from WhatsApp and database
 */
function normalizePhoneNumber(phone: string): string[] {
  if (!phone) return [];

  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');

  const variations = new Set<string>();
  variations.add(cleaned); // Original cleaned version

  // Extract just the digits
  const digitsOnly = cleaned.replace(/\+/g, '');

  // Add variations
  if (digitsOnly.length >= 10) {
    // Last 10 digits (standard mobile number)
    const last10 = digitsOnly.slice(-10);
    variations.add(last10);

    // With +91 (India country code)
    variations.add(`+91${last10}`);

    // With 91 prefix
    variations.add(`91${last10}`);

    // With + prefix only
    variations.add(`+${last10}`);

    // If it's a 12-digit number starting with 91, also try without it
    if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
      const without91 = digitsOnly.substring(2);
      variations.add(without91);
      variations.add(`+${without91}`);
    }
  }

  // Add the original phone as-is
  variations.add(phone);

  return Array.from(variations);
}

export async function processIncomingMessage(message: any, from: string): Promise<void> {
  const { storage } = await import('../storage');

  try {
    console.log(`[WhatsApp] Processing message from ${from}`);

    // Get or create user and session
    // Enhanced phone number matching with multiple variations
    let user = null;
    const phoneVariations = normalizePhoneNumber(from);

    console.log(`[WhatsApp] Trying ${phoneVariations.length} phone number variations:`, phoneVariations);

    // Try each variation until we find a match
    for (const variation of phoneVariations) {
      user = await storage.getUserByPhoneNumber(variation);
      if (user) {
        console.log(`[WhatsApp] ✅ Found user with phone variation: ${variation} -> ${user.name} (${user.id})`);
        break;
      }
    }
    
    if (!user) {
      console.log(`[WhatsApp] No existing user found for ${from}, creating new user`);
      user = await storage.createUser({
        phoneNumber: from,
        name: `WhatsApp User ${from.slice(-4)}`,
        email: `whatsapp_${from}@temp.com`,
        role: 'client',
        isActive: true,
        whatsappVerified: true,
        emailVerified: false
      });
    } else {
      console.log(`[WhatsApp] Found existing user: ${user.name} (${user.id}), role: ${user.role}`);
    }
    
    // ENHANCED ROLE DETECTION: Check customer and technician tables
    console.log(`[WhatsApp] 🔍 Verifying user role from dashboard data...`);
    const customer = await storage.getCustomerByUserId(user.id);
    const technician = await storage.getTechnicianByUserId(user.id);
    
    if (customer && technician) {
      console.log(`[WhatsApp] ⚠️ User ${user.id} has both customer and technician records. Defaulting to user.role: ${user.role}`);
    } else if (customer) {
      console.log(`[WhatsApp] ✅ User ${user.id} identified as CLIENT from dashboard (customer record found)`);
      if (user.role !== 'client') {
        console.log(`[WhatsApp] 🔄 Updating user role from ${user.role} to client`);
        await storage.updateUser(user.id, { role: 'client' });
        user.role = 'client';
      }
    } else if (technician) {
      console.log(`[WhatsApp] ✅ User ${user.id} identified as TECHNICIAN from dashboard (technician record found)`);
      if (user.role !== 'technician') {
        console.log(`[WhatsApp] 🔄 Updating user role from ${user.role} to technician`);
        await storage.updateUser(user.id, { role: 'technician' });
        user.role = 'technician';
      }
    } else {
      console.log(`[WhatsApp] ⚠️ User ${user.id} has no customer or technician record. Using user.role: ${user.role}`);
    }
    
    // Get or create WhatsApp session - use phone number to find session
    let session: any = null;
    try {
      // Try to get existing session by phone number
      session = await storage.getWhatsappSession(from);
      if (session) {
        console.log(`[WhatsApp] Found existing session ${session.id} for ${from}`);
      }
    } catch (e) {
      console.log(`[WhatsApp] Error getting session:`, e);
      // Session doesn't exist, will create below
    }
    
    if (!session) {
      console.log(`[WhatsApp] Creating new session for ${from}`);
      session = await storage.createWhatsappSession({
        phoneNumber: from,
        userId: user.id,
        conversationState: {},
        lastMessageAt: new Date()
      });
    } else {
      // Update last message time and ensure conversationState is preserved
      await storage.updateWhatsappSession(session.id, {
        lastMessageAt: new Date(),
        conversationState: session.conversationState || {}
      });
    }
    
    // Handle different message types
    if (message.type === 'text') {
      await handleTextMessage(message, user, session);
    } else if (message.type === 'interactive') {
      await handleInteractiveMessage(message, user, null, session);
    } else if (message.type === 'image' || message.type === 'video' || message.type === 'document') {
      await handleMediaMessage(message, user, session);
    }

    // Determine if this message is related to a service request
    const conversationState = session.conversationState || {};
    let relatedEntityType = null;
    let relatedEntityId = null;

    // Check if user is in service request flow or working on a service
    if (conversationState.lastCreatedServiceRequestId) {
      relatedEntityType = 'ServiceRequest';
      relatedEntityId = conversationState.lastCreatedServiceRequestId;
    } else if (conversationState.currentServiceId) {
      relatedEntityType = 'ServiceRequest';
      relatedEntityId = conversationState.currentServiceId;
    } else if (conversationState.completingServiceId) {
      relatedEntityType = 'ServiceRequest';
      relatedEntityId = conversationState.completingServiceId;
    }

    // Store message in database (use 'admin' instead of 'system' to match enum)
    await storage.createWhatsappMessage({
      recipientType: user.role === 'client' ? 'customer' : (user.role === 'technician' ? 'technician' : 'admin'),
      recipientId: user.id,
      phoneNumber: from,
      messageType: message.type || 'text',
      messageContent: message,
      whatsappMessageId: message.id,
      status: 'received',
      sentAt: new Date(parseInt(message.timestamp) * 1000),
      relatedEntityType,
      relatedEntityId
    });
    
  } catch (error) {
    console.error(`[WhatsApp] Error processing message from ${from}:`, error);
    await sendTextMessage(from, '❌ Sorry, something went wrong. Please try again or contact support.');
  }
}

async function handleTextMessage(message: any, user: any, session: any): Promise<void> {
  const text = message.text?.body?.trim() || '';
  const from = message.from;
  const conversationState = session.conversationState || {};
  
  console.log(`[WhatsApp] Text message from ${from}: "${text}"`);
  
  // Handle "hi" or greeting messages (flexible matching for hi, hii, hiii, etc.)
  if (/^(hi+|hello|hey|start|menu)$/i.test(text)) {
    console.log(`[WhatsApp] ✅ Greeting detected from ${from}, user role: ${user.role}`);
    
    // CRITICAL FIX: Don't restart flow if user is already in an active flow
    const activeFlow = conversationState.flow;
    const activeStep = conversationState.step;
    
    if (activeFlow === 'real_service_request' && activeStep) {
      console.log(`[WhatsApp] ⚠️ User is in active service request flow (${activeStep}), ignoring greeting`);
      await sendTextMessage(from, '⚠️ You are currently in the middle of a service request. Please complete the current step or type *CANCEL* to start over.');
      return;
    }
    
    if (activeFlow === 'container_verification' && conversationState.selectedContainers?.length > 0) {
      console.log(`[WhatsApp] ⚠️ User has containers selected, asking for confirmation to restart`);
      await sendTextMessage(from, '⚠️ You have containers selected. Type *RESTART* to start over, or continue with your current selection.');
      return;
    }
    
    try {
      console.log(`[WhatsApp] 🎯 Routing to ${user.role.toUpperCase()} flow...`);
      
      if (user.role === 'client') {
        console.log(`[WhatsApp] 📱 Starting CLIENT MODE for ${from}`);
        // For clients, ask for container number first
        const { storage } = await import('../storage');
        await storage.updateWhatsappSession(session.id, {
          conversationState: {
            flow: 'container_verification',
            step: 'awaiting_container_number',
            containerAttempts: 0,
            selectedContainers: [],
            verifiedCustomerId: null
          }
        });
        await sendTextMessage(from, '👋 Welcome! Please enter your container number to continue.');
        console.log(`[WhatsApp] ✅ Container number request sent to ${from}`);
      } else if (user.role === 'technician') {
        console.log(`[WhatsApp] 🔧 Starting TECHNICIAN MODE for ${from}`);
        const { storage } = await import('../storage');
        const technician = await storage.getTechnicianByUserId(user.id);
        if (technician) {
          console.log(`[WhatsApp] Technician found: ${technician.employeeCode} (${technician.id})`);
          const activeServices = getActiveServices(session);
          console.log(`[WhatsApp] Active services count: ${activeServices.length}`);
          if (activeServices.length > 0) {
            console.log(`[WhatsApp] Showing active services menu`);
            await showActiveServicesMenu(from, user, session, storage);
          } else {
            console.log(`[WhatsApp] Showing technician main menu`);
            await sendTechnicianMainMenu(from, user, storage);
          }
        } else {
          console.log(`[WhatsApp] ⚠️ No technician record found for user ${user.id}, falling back to client menu`);
          const { storage } = await import('../storage');
          const customer = await storage.getCustomerByUserId(user.id);
          await sendRealClientMenu(from, user, customer);
        }
        console.log(`[WhatsApp] ✅ Technician menu sent successfully to ${from}`);
      } else {
        console.log(`[WhatsApp] ⚠️ Unknown role '${user.role}', defaulting to client menu`);
        const { storage } = await import('../storage');
        const customer = await storage.getCustomerByUserId(user.id);
        await sendRealClientMenu(from, user, customer);
        console.log(`[WhatsApp] ✅ Default menu sent successfully to ${from}`);
      }
      return; // IMPORTANT: Return here after successful menu send
    } catch (error: any) {
      console.error(`[WhatsApp] ❌ Error sending menu to ${from}:`, error);
      console.error(`[WhatsApp] Error details:`, error.message, error.stack);
      await sendTextMessage(from, '❌ Sorry, something went wrong. Please try again or contact support.');
      return; // IMPORTANT: Return here after error
    }
  }
  
  // Handle CANCEL command - allows user to abort current flow
  const lowerText = text.toLowerCase();
  if (lowerText === 'cancel') {
    console.log(`[WhatsApp] CANCEL command from ${from}`);
    const { storage } = await import('../storage');
    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        flow: null,
        step: null,
        selectedContainers: [],
        verifiedCustomerId: null,
        containerAttempts: 0
      }
    });
    await sendTextMessage(from, '❌ *Request cancelled.*\n\nType *hi* to start a new request.');
    return;
  }
  
  // Handle RESTART command - clears everything and starts fresh
  if (lowerText === 'restart') {
    console.log(`[WhatsApp] RESTART command from ${from}`);
    const { storage } = await import('../storage');
    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        flow: 'container_verification',
        step: 'awaiting_container_number',
        containerAttempts: 0,
        selectedContainers: [],
        verifiedCustomerId: null
      }
    });
    await sendTextMessage(from, '🔄 *Restarting...*\n\n👋 Welcome! Please enter your container number to continue.');
    return;
  }
  
  // Handle container verification flow
  if (conversationState.flow === 'container_verification') {
    await handleContainerVerification(text, from, user, session);
    return;
  }
  
  // Handle service request flow steps
  if (conversationState.flow === 'real_service_request') {
    await handleClientTextMessage(text, from, user, session);
    return;
  }
  
  // Handle text-based menu commands (fallback for when buttons don't work)
  if (lowerText === 'service' || lowerText === 'request service') {
    console.log(`[WhatsApp] Text command 'service' detected from ${from}`);
    const { storage } = await import('../storage');
    const session = await storage.getWhatsappSession(user.id);
    await handleRealClientRequestService(from, user, session);
    return;
  }
  
  if (lowerText === 'status' || lowerText === 'check status') {
    console.log(`[WhatsApp] Text command 'status' detected from ${from}`);
    const { storage } = await import('../storage');
    const session = await storage.getWhatsappSession(user.id);
    await handleRealClientStatusCheck(from, user, session);
    return;
  }
  
  // Handle technician completion flow
  if (user.role === 'technician' && conversationState.completionStep) {
    if (text.toUpperCase() === 'DONE') {
      const step = conversationState.completionStep;
      if (step === 'awaiting_before_photos') {
        await moveToAfterPhotos(from, session, await import('../storage').then(m => m.storage));
      } else if (step === 'awaiting_after_photos') {
        await requestSignatureUpload(from, session, await import('../storage').then(m => m.storage));
      }
    }
    return;
  }
  
  // Default: show menu
  await sendTextMessage(from, '👋 Welcome! Please type "hi" to see the menu.');
}

async function handleContainerVerification(text: string, from: string, user: any, session: any): Promise<void> {
  const { storage } = await import('../storage');
  const conversationState = session.conversationState || {};
  
  if (conversationState.step === 'awaiting_container_number') {
    const containerNumber = text.trim().toUpperCase();
    console.log(`[WhatsApp] Container verification attempt for: ${containerNumber}`);

    // Check if container exists in database
    const container = await storage.getContainerByCode(containerNumber);

    if (container) {
      console.log(`[WhatsApp] Container ${containerNumber} found for customer ${container.currentCustomerId}`);

      // Get current selected containers list
      const selectedContainers = conversationState.selectedContainers || [];
      const verifiedCustomerId = conversationState.verifiedCustomerId;

      // Check if container already selected
      if (selectedContainers.some((c: any) => c.containerCode === containerNumber)) {
        const containerList = selectedContainers.map((c: any) => c.containerCode).join(', ');
        await sendInteractiveButtons(
          from,
          `⚠️ *Container ${containerNumber} is already selected.*\n\n📦 *Selected:* ${containerList}\n\nPlease enter a different container number or proceed.`,
          [
            { id: 'add_more_containers', title: '➕ Add More' },
            { id: 'proceed_with_containers', title: '✅ Proceed' }
          ]
        );
        return;
      }

      // FIRST CONTAINER: Set the verified customer ID
      if (selectedContainers.length === 0) {
        console.log(`[WhatsApp] First container - setting verified customer to ${container.currentCustomerId}`);
        
        // Add container to selected list
        selectedContainers.push({
          id: container.id,
          containerCode: containerNumber,
          customerId: container.currentCustomerId
        });

        // Update session with selected containers and verified customer
        await storage.updateWhatsappSession(session.id, {
          conversationState: {
            ...conversationState,
            selectedContainers: selectedContainers,
            verifiedCustomerId: container.currentCustomerId,
            containerAttempts: 0,
            step: 'container_added'
          }
        });
      } else {
        // SECOND+ CONTAINER: Validate it belongs to the same customer
        if (container.currentCustomerId !== verifiedCustomerId) {
          console.log(`[WhatsApp] ❌ Container ${containerNumber} belongs to different customer. Expected: ${verifiedCustomerId}, Got: ${container.currentCustomerId}`);
          await sendTextMessage(
            from,
            `❌ *This container does not belong to your company.*\n\nPlease check the number and try again.`
          );
          return;
        }

        console.log(`[WhatsApp] ✅ Container ${containerNumber} belongs to same customer ${verifiedCustomerId}`);
        
        // Add container to selected list
        selectedContainers.push({
          id: container.id,
          containerCode: containerNumber,
          customerId: container.currentCustomerId
        });

        // Update session with selected containers
        await storage.updateWhatsappSession(session.id, {
          conversationState: {
            ...conversationState,
            selectedContainers: selectedContainers,
            containerAttempts: 0,
            step: 'container_added'
          }
        });
      }

      // Show container added message with Add More / Proceed / Remove Last buttons
      const containerList = selectedContainers.map((c: any) => c.containerCode).join(', ');
      const containerCount = selectedContainers.length;

      // Build button array
      const buttons = [
        { id: 'add_more_containers', title: '➕ Add More' },
        { id: 'proceed_with_containers', title: '✅ Proceed' }
      ];
      
      // Add "Remove Last" button if more than one container selected
      if (containerCount > 1) {
        buttons.push({ id: 'remove_last_container', title: '🗑️ Remove Last' });
      }

      await sendInteractiveButtons(
        from,
        `✅ *Container Added*\n\n📦 *Selected (${containerCount}):* ${containerList}\n\nWould you like to add more containers or proceed?`,
        buttons
      );

      console.log(`[WhatsApp] ✅ Container ${containerNumber} added to selection. Total: ${selectedContainers.length}`);

    } else {
      // Container not found
      const attempts = (conversationState.containerAttempts || 0) + 1;
      console.log(`[WhatsApp] Container ${containerNumber} not found. Attempt ${attempts}/2`);

      if (attempts >= 2) {
        // Second failed attempt - ask to contact support
        await sendTextMessage(
          from,
          `Container number not found.\n\nPlease contact support at *+917021307474* for assistance.`
        );

        // Reset flow
        await storage.updateWhatsappSession(session.id, {
          conversationState: {
            ...conversationState,
            flow: null,
            step: null,
            containerAttempts: 0,
            selectedContainers: []
          }
        });
      } else {
        // First failed attempt - ask to try again
        await storage.updateWhatsappSession(session.id, {
          conversationState: {
            ...conversationState,
            containerAttempts: attempts
          }
        });

        await sendTextMessage(
          from,
          `❌ Invalid container number. Please enter a valid one.`
        );
      }
    }
  }
}

async function handleClientTextMessage(text: string, from: string, user: any, session: any): Promise<void> {
  const { storage } = await import('../storage');
  const conversationState = session.conversationState || {};
  
  // Handle error code input
  if (conversationState.step === 'awaiting_error_code') {
    await handleErrorCodeInput(text, from, user, session);
    return;
  }
  
  // Handle issue description input
  if (conversationState.step === 'awaiting_description') {
    await handleIssueDescriptionInput(text, from, user, session);
    return;
  }
  
  // Handle DONE command after photo uploads
  if (conversationState.step === 'awaiting_photos') {
    if (text.toUpperCase() === 'DONE') {
      const beforePhotos = conversationState.beforePhotos || [];
      
      if (beforePhotos.length === 0) {
        await sendTextMessage(from, '⚠️ *Photo upload is mandatory.* Please send at least one photo, then type *DONE*.');
        return;
      }
      
      // Move to video upload step
      await storage.updateWhatsappSession(session.id, {
        conversationState: {
          ...conversationState,
          step: 'awaiting_videos',
          videos: []
        }
      });
      
      await sendTextMessage(
        from,
        `${getProgressIndicator('awaiting_videos')}` +
        `✅ Photos received (${beforePhotos.length}).\n\n` +
        `🎥 *Please attach a short video showing the issue.*\n\n` +
        `💡 Video is optional but helpful.\n\n` +
        `Send the video, then type *DONE* to submit.`
      );
    } else {
      await sendTextMessage(from, '📸 Please send photos or type *DONE* when finished.');
    }
    return;
  }
  
  // Handle DONE command after video uploads
  if (conversationState.step === 'awaiting_videos') {
    if (text.toUpperCase() === 'DONE') {
      await storage.updateWhatsappSession(session.id, {
        conversationState: {
          ...conversationState,
          step: 'awaiting_company_name'
        }
      });
      session.conversationState = {
        ...conversationState,
        step: 'awaiting_company_name'
      };
      
      await sendTextMessage(
        from,
        `${getProgressIndicator('awaiting_company_name')}` +
        `🏢 *What's the company name at the site?*\n\n` +
        `Please provide the full company name.`
      );
    } else {
      await sendTextMessage(from, '🎥 Please send a video or type *DONE* to continue.');
    }
    return;
  }

  // Handle company name input
  if (conversationState.step === 'awaiting_company_name') {
    if (!text || text.trim().length === 0) {
      await sendTextMessage(from, '❌ Please provide the company name.');
      return;
    }

    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        ...conversationState,
        companyName: text.trim(),
        step: 'awaiting_onsite_contact'
      }
    });
    session.conversationState = {
      ...conversationState,
      companyName: text.trim(),
      step: 'awaiting_onsite_contact'
    };

    await sendTextMessage(
      from,
      `${getProgressIndicator('awaiting_onsite_contact')}` +
      `📞 *Onsite contact phone number?*\n\n` +
      `Please provide the onsite contact phone number (10 digits). This should be the person available at the site. You may share your own number if appropriate: *${from}*`
    );
    return;
  }

  // Handle onsite contact input
  if (conversationState.step === 'awaiting_onsite_contact') {
    if (!text || text.trim().length === 0) {
      await sendTextMessage(from, '❌ Please provide the onsite contact number.');
      return;
    }

    // Validate phone number format (10 digits)
    const phoneDigits = text.trim().replace(/\D/g, ''); // Remove non-digits
    if (phoneDigits.length !== 10) {
      await sendTextMessage(
        from,
        `❌ Please enter a valid 10-digit phone number using numbers only (e.g., *9876543210*).\n\n` +
        `You entered: ${text.trim()}\n` +
        `Digits found: ${phoneDigits.length}`
      );
      return;
    }

    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        ...conversationState,
        onsiteContact: phoneDigits, // Store cleaned phone number
        step: 'awaiting_site_address'
      }
    });
    session.conversationState = {
      ...conversationState,
      onsiteContact: phoneDigits,
      step: 'awaiting_site_address'
    };

    await sendTextMessage(
      from,
      `${getProgressIndicator('awaiting_site_address')}` +
      `📍 *Site address (street, city, landmarks)?*\n\n` +
      `Full address helps us route the technician accurately.`
    );
    return;
  }

  // Handle site address input
  if (conversationState.step === 'awaiting_site_address') {
    if (!text || text.trim().length === 0) {
      await sendTextMessage(from, '❌ Please provide the site address.');
      return;
    }

    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        ...conversationState,
        siteAddress: text.trim(),
        step: 'awaiting_preferred_contact'
      }
    });
    session.conversationState = {
      ...conversationState,
      siteAddress: text.trim(),
      step: 'awaiting_preferred_contact'
    };

    await promptPreferredContactDate(from, user);
    return;
  }

  if (conversationState.step === 'awaiting_preferred_contact') {
    if (!text) {
      await sendTextMessage(from, '❌ Please provide a preferred date/time or type *No preference*.');
      return;
    }

    const trimmed = text.trim();
    const value = trimmed.toLowerCase() === 'no preference' ? 'No preference' : trimmed;
    await finalizePreferredContactSelection(value, from, user, session);
    return;
  }
}

async function handleMediaMessage(message: any, user: any, session: any): Promise<void> {
  const from = message.from;
  const conversationState = session.conversationState || {};
  
  let mediaId = null;
  
  if (message.type === 'image') {
    mediaId = message.image?.id;
  } else if (message.type === 'video') {
    mediaId = message.video?.id;
  } else if (message.type === 'document') {
    mediaId = message.document?.id;
  }
  
  if (!mediaId) {
    console.error('[WhatsApp] No media ID found in message');
    return;
  }
  
  console.log(`[WhatsApp] Media message (${message.type}) from ${from}, ID: ${mediaId}`);
  
  // Handle CLIENT photo uploads during real service request flow
  if (user.role === 'client' && conversationState.step === 'awaiting_photos' && message.type === 'image') {
    await handlePhotoUpload(mediaId, from, user, session);
    return;
  }
  
  // Handle CLIENT video uploads during real service request flow
  if (user.role === 'client' && conversationState.step === 'awaiting_videos' && message.type === 'video') {
    await handleVideoUpload(mediaId, from, user, session);
    return;
  }
  
  // Handle TECHNICIAN photo uploads during completion flow
  if (user.role === 'technician' && conversationState.completionStep) {
    const step = conversationState.completionStep;
    
    if ((step === 'awaiting_before_photos' || step === 'awaiting_after_photos') && message.type === 'image') {
      await handlePhotoUploadStep(from, user, mediaId, session, await import('../storage').then(m => m.storage));
    } else if (step === 'awaiting_signature' && (message.type === 'image' || message.type === 'document')) {
      await handleSignatureUpload(from, user, mediaId, session, await import('../storage').then(m => m.storage));
    } else if (step === 'awaiting_invoice' && (message.type === 'image' || message.type === 'document')) {
      await handleInvoiceUpload(from, user, mediaId, session, await import('../storage').then(m => m.storage));
    }
  }
}

// Global instance for easy access
export const customerCommunicationService = new CustomerCommunicationService();

// Export the service as an object for easier importing
export const whatsappService = {
  handleWebhook: handleWebhook,
  customerCommunicationService,
  authorizeWhatsAppMessage,
  sendMessage: async (phoneNumber: string, message: string) => {
    return await sendTextMessage(phoneNumber, message);
  },
  sendAlertNotification: async (alertId: string, customerId: string) => {
    return await customerCommunicationService.sendAlertNotification(alertId, customerId);
  },
  updateWhatsAppTemplate,
  processIncomingMessage, // Export for direct use if needed
};
