import { config } from "dotenv";
config(); // Load environment variables

import axios from "axios";

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
<<<<<<< HEAD
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
=======
const ROLE_TEST_NUMBERS = new Set(['917021307474', '7021307474']);
>>>>>>> all-ui-working
function isRoleTestNumber(input: string): boolean {
  return ROLE_TEST_NUMBERS.has(cleanPhone(input));
}

<<<<<<< HEAD
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

/**
 * Send real client menu (for actual registered clients, not test mode)
 */
async function sendRealClientMenu(to: string): Promise<void> {
  await sendInteractiveButtons(
    to,
    '🏢 *Client Mode*\n\nHow can I help you today?',
    [
      { id: 'request_service', title: '🧰 Request Service' },
      { id: 'status', title: '📊 Status' }
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
    console.log(`[WhatsApp] handleRealClientRequestService - user: ${user.name} (${user.id})`);
    
    const customer = await storage.getCustomerByUserId(user.id);
    if (!customer) {
      console.error(`[WhatsApp] Customer profile not found for user ${user.id}`);
      await sendTextMessage(from, '❌ Customer profile not found. Please contact support.');
      return;
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

    // Update session to track service request flow
    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        flow: 'real_service_request',
        step: 'awaiting_container_selection',
        customerId: customer.id,
        selectedContainers: []
      }
    });

    // Always use list for multi-select capability (WhatsApp lists support multi-selection)
    const rows = containers.map((c: any) => {
      const location = (c.currentLocation as any)?.address || (c.currentLocation as any)?.city || 'Unknown';
      return {
        id: `select_container_${c.id}`,
        title: c.containerCode,
        description: `${c.type} | ${c.status} | ${location}`.substring(0, 72)
      };
    });

    await sendInteractiveList(
      from,
      '🔧 *Service Request*\n\nWhich container needs service?\n\n*Select a container from the list below.*',
      'Select Container',
      [{ title: 'Your Containers', rows }]
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
    
    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        ...conversationState,
        errorCode: errorCode.trim(),
        step: 'awaiting_description'
      }
    });

    await sendTextMessage(
      from,
      `✅ Error code noted: *${errorCode.trim()}*\n\n📝 *Please describe briefly what's happening* (2–3 sentences):`
    );
  } catch (error) {
    console.error('[WhatsApp] Error in handleErrorCodeInput:', error);
    await sendTextMessage(from, '❌ Error processing error code. Please try again.');
  }
}

/**
 * Handle issue description input from client
 */
async function handleIssueDescriptionInput(description: string, from: string, user: any, session: any): Promise<void> {
  const { storage } = await import('../storage');
  
  try {
    const conversationState = session.conversationState || {};
    
    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        ...conversationState,
        issueDescription: description.trim(),
        step: 'awaiting_photo_choice'
      }
    });

    await sendInteractiveButtons(
      from,
      `✅ Description received.\n\n📸 *Would you like to attach photos?*`,
      [
        { id: 'attach_photos_yes', title: '✅ Yes' },
        { id: 'attach_photos_no', title: '❌ No' }
      ]
    );
  } catch (error) {
    console.error('[WhatsApp] Error in handleIssueDescriptionInput:', error);
    await sendTextMessage(from, '❌ Error processing description. Please try again.');
  }
}

/**
 * Handle photo attachment choice
 */
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
      // No photos - create service request immediately
      await createServiceRequestFromWhatsApp(from, user, session);
    }
  } catch (error) {
    console.error('[WhatsApp] Error in handlePhotoChoice:', error);
    await sendTextMessage(from, '❌ Error processing choice. Please try again.');
  }
}

/**
 * Handle photo upload from client
 */
async function handlePhotoUpload(mediaId: string, from: string, user: any, session: any): Promise<void> {
  const { storage } = await import('../storage');
  
  try {
    const conversationState = session.conversationState || {};
    const beforePhotos = conversationState.beforePhotos || [];
    
    // Store media ID (in production, you'd download and store the actual image)
    beforePhotos.push(mediaId);
    
    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        ...conversationState,
        beforePhotos
      }
    });

    await sendTextMessage(
      from,
      `✅ Photo ${beforePhotos.length} received.\n\nSend more photos or type *DONE* to submit.`
    );
  } catch (error) {
    console.error('[WhatsApp] Error in handlePhotoUpload:', error);
    await sendTextMessage(from, '❌ Error processing photo. Please try again.');
  }
}

/**
 * Create service request from WhatsApp conversation and save to database
 */
async function createServiceRequestFromWhatsApp(from: string, user: any, session: any): Promise<void> {
  const { storage } = await import('../storage');
  
  try {
    const conversationState = session.conversationState || {};
    const { selectedContainers, errorCode, issueDescription, beforePhotos, customerId } = conversationState;

    if (!selectedContainers || selectedContainers.length === 0) {
      await sendTextMessage(from, '❌ No containers selected. Please start again.');
      return;
    }

    // Create service request for each selected container
    const createdRequests = [];
    for (const containerId of selectedContainers) {
      const container = await storage.getContainer(containerId);
      if (!container) continue;

      const fullDescription = [
        issueDescription || 'Service requested via WhatsApp',
        errorCode && errorCode.toUpperCase() !== 'NA' ? `Error Code: ${errorCode}` : ''
      ].filter(Boolean).join('\n\n');

      const serviceRequest = await storage.createServiceRequest({
        requestNumber: `SR-${Date.now()}${Math.floor(Math.random() * 1000)}`,
        containerId: container.id,
        customerId: customerId,
        priority: 'normal',
        status: 'pending',
        issueDescription: fullDescription,
        beforePhotos: beforePhotos || [],
        createdBy: user.id,
        createdAt: new Date(),
        requestedAt: new Date()
      });

      createdRequests.push(serviceRequest);
    }

    // Clear conversation state
    await storage.updateWhatsappSession(session.id, {
      conversationState: {}
    });

    // Send confirmation
    const requestNumbers = createdRequests.map(r => r.requestNumber).join(', ');
    await sendTextMessage(
      from,
      `✅ *Your service request has been raised!*\n\n📋 Request Number(s): ${requestNumbers}\n\nA technician will contact you soon. You can check the status anytime by selecting "Status" from the menu.`
    );

    // Show client menu again
    await sendRealClientMenu(from);
  } catch (error) {
    console.error('[WhatsApp] Error in createServiceRequestFromWhatsApp:', error);
    await sendTextMessage(from, '❌ Error creating service request. Please contact support.');
  }
}

/**
 * Handle real client status check - shows real container status from database
 */
async function handleRealClientStatusCheck(from: string, user: any, session: any): Promise<void> {
  const { storage } = await import('../storage');
  
  try {
    console.log(`[WhatsApp] handleRealClientStatusCheck - user: ${user.name} (${user.id})`);
    
    const customer = await storage.getCustomerByUserId(user.id);
    if (!customer) {
      console.error(`[WhatsApp] Customer profile not found for user ${user.id}`);
      await sendTextMessage(from, '❌ Customer profile not found.');
      return;
    }

    console.log(`[WhatsApp] Found customer: ${customer.companyName} (${customer.id})`);
    
    const containers = await storage.getContainersByCustomer(customer.id);
    console.log(`[WhatsApp] Fetched ${containers.length} containers for status check`);
    
    if (containers.length === 0) {
      console.error(`[WhatsApp] No containers found for customer ${customer.id}`);
      await sendTextMessage(from, '❌ No containers found for your account.');
      return;
    }

    console.log(`[WhatsApp] Showing ${containers.length} containers for status selection`);

    // Update session
    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        flow: 'check_status',
        step: 'awaiting_container_selection_for_status',
        customerId: customer.id
      }
    });

    // Always use list for consistency and better UX
    const rows = containers.map((c: any) => {
      const location = (c.currentLocation as any)?.address || (c.currentLocation as any)?.city || 'Unknown';
      return {
        id: `status_container_${c.id}`,
        title: c.containerCode,
        description: `${c.type} | ${c.status} | ${location}`.substring(0, 72)
      };
    });

    await sendInteractiveList(
      from,
      '📊 *Status Check*\n\nWhich container\'s status do you want to check?\n\n*Select a container to view its detailed status.*',
      'Select Container',
      [{ title: 'Your Containers', rows }]
    );
  } catch (error) {
    console.error('[WhatsApp] Error in handleRealClientStatusCheck:', error);
    await sendTextMessage(from, '❌ Error loading status. Please try again.');
  }
}

/**
 * Show detailed status for a specific container
 */
async function showContainerStatus(containerId: string, from: string, user: any, session: any): Promise<void> {
  const { storage } = await import('../storage');
  
  try {
    const container = await storage.getContainer(containerId);
    if (!container) {
      await sendTextMessage(from, '❌ Container not found.');
      return;
    }

    // Get latest metrics if available
    const metrics = await storage.getContainerMetrics(containerId);
    const latestMetric = metrics && metrics.length > 0 ? metrics[0] : null;

    // Get active service requests for this container
    const serviceRequests = await storage.getServiceRequestsByCustomer(session.conversationState?.customerId || '');
    const containerRequests = serviceRequests.filter((sr: any) => 
      sr.containerId === containerId && ['pending', 'scheduled', 'in_progress'].includes(sr.status)
    );

    const location = (container.currentLocation as any)?.address || (container.currentLocation as any)?.city || 'Unknown';
    const statusMsg = [
      `📦 *${container.containerCode}*`,
      '',
      `🏷️ Type: ${container.type}`,
      `📍 Location: ${location}`,
      `✅ Status: ${container.status}`,
      latestMetric ? `🌡️ Temperature: ${latestMetric.temperature || 'N/A'}°C` : '',
      latestMetric ? `💧 Humidity: ${latestMetric.humidity || 'N/A'}%` : '',
      '',
      containerRequests.length > 0 ? `🔧 *Active Service Requests:*` : '✅ No active service requests',
      ...containerRequests.map((sr: any) => 
        `• ${sr.requestNumber} - ${sr.status}\n  ${sr.issueDescription.substring(0, 50)}...`
      )
    ].filter(Boolean).join('\n');

    await sendTextMessage(from, statusMsg);

    // Clear conversation state
    await storage.updateWhatsappSession(session.id, {
      conversationState: {}
    });

    // Show menu
    await sendRealClientMenu(from);
  } catch (error) {
    console.error('[WhatsApp] Error in showContainerStatus:', error);
    await sendTextMessage(from, '❌ Error loading container status.');
  }
}

=======
>>>>>>> all-ui-working
export interface WhatsAppMessage {
  to: string;
  type: "text" | "interactive" | "template" | "media" | "flow";
  content: any;
}

export interface WhatsAppButton {
  id: string;
  title: string;
}

export interface WhatsAppListItem {
  id: string;
  title: string;
  description?: string;
}

export interface WhatsAppFlowData {
  flow_token: string;
  flow_id: string;
  flow_cta: string;
  flow_action_payload: any;
}

export async function sendTextMessage(to: string, text: string): Promise<any> {
  try {
    console.log('📤 Attempting to send WhatsApp message to:', to, 'Text:', text.substring(0, 50) + '...');
    ensureWhatsAppConfig();
    const toClean = cleanPhone(to);
    console.log('📤 Cleaned phone number:', toClean);
    console.log('📤 WhatsApp config check - Phone ID:', WHATSAPP_PHONE_NUMBER_ID ? 'SET' : 'NOT SET', 'Token:', WHATSAPP_TOKEN ? 'SET' : 'NOT SET');
    
    const response = await axios.post(
      WHATSAPP_MESSAGES_URL,
      {
        messaging_product: "whatsapp",
        to: toClean,
        type: "text",
        text: { body: text },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        },
      }
    );
    console.log('✅ WhatsApp text send success:', response.data);
    return response.data;
  } catch (error: any) {
    console.error("❌ WhatsApp send error:", error.response?.data || error.message);
    console.error("❌ Full error:", error);
    throw error;
  }
}

export async function sendInteractiveButtons(
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>
): Promise<any> {
  try {
    ensureWhatsAppConfig();
    const toClean = cleanPhone(to);
    const response = await axios.post(
      WHATSAPP_MESSAGES_URL,
      {
        messaging_product: "whatsapp",
        to: toClean,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: bodyText },
          action: {
            buttons: buttons.map((btn) => ({
              type: "reply",
              reply: { id: btn.id, title: btn.title },
            })),
          },
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        },
      }
    );
    console.log('WhatsApp buttons send success:', response.data);
    return response.data;
  } catch (error: any) {
    console.error("WhatsApp send error:", error.response?.data || error.message);
    throw error;
  }
}

export async function sendInteractiveList(
  to: string,
  bodyText: string,
  buttonText: string,
  sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>
): Promise<any> {
  try {
    ensureWhatsAppConfig();
    const toClean = cleanPhone(to);
    const response = await axios.post(
      WHATSAPP_MESSAGES_URL,
      {
        messaging_product: "whatsapp",
        to: toClean,
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: bodyText },
          action: {
            button: buttonText,
            sections: sections,
          },
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        },
      }
    );
    console.log('WhatsApp list send success:', response.data);
    return response.data;
  } catch (error: any) {
    console.error("WhatsApp send error:", error.response?.data || error.message);
    throw error;
  }
}

export async function sendTemplate(to: string, templateName: string, languageCode = "en_US"): Promise<any> {
  try {
    ensureWhatsAppConfig();
    const toClean = cleanPhone(to);
    const response = await axios.post(
      WHATSAPP_MESSAGES_URL,
      {
        messaging_product: "whatsapp",
        to: toClean,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        },
      }
    );
    console.log('WhatsApp template send success:', response.data);
    return response.data;
  } catch (error: any) {
    console.error("WhatsApp send error:", error.response?.data || error.message);
    throw error;
  }
}

export function formatAlertMessage(alert: any, container: any): string {
  return `🚨 *Alert: ${String(alert.severity || '').toUpperCase()}*

Container: *${container.containerCode || container.containerId || container.id}*
Location: ${container.currentLocation?.address || "Unknown"}

Issue: ${alert.title}
${alert.description}

⏰ Time: ${new Date(alert.detectedAt).toLocaleString()}

AI Analysis: ${alert.aiClassification?.rootCause || "Processing..."}`;
}

export function formatServiceScheduleMessage(technician: any, services: any[]): string {
  let message = `📋 *Tomorrow's Schedule*\n\nTotal Services: ${services.length}\n\n`;

  services.forEach((service, index) => {
    message += `${index + 1}️⃣ *${service.scheduledTime || "TBD"}*\n`;
    message += `   Container: ${service.container?.containerCode || service.container?.containerId}\n`;
    message += `   Location: ${service.container?.currentLocation?.address || "Unknown"}\n`;
    message += `   Issue: ${service.issueDescription}\n`;
    if (service.requiredParts?.length > 0) {
      message += `   Parts: ${service.requiredParts.join(", ")}\n`;
    }
    message += "\n";
  });

  message += `📍 Route Map: [View Route]\n`;
  return message;
}

// Enhanced WhatsApp Integration according to PRD

export async function sendListMessage(
  to: string,
  bodyText: string,
  buttonText: string,
  listItems: WhatsAppListItem[]
): Promise<any> {
  try {
    const response = await axios.post(
      WHATSAPP_MESSAGES_URL,
      {
        messaging_product: "whatsapp",
        to: to,
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: bodyText },
          action: {
            button: buttonText,
            sections: [
              {
                title: "Options",
                rows: listItems.map(item => ({
                  id: item.id,
                  title: item.title,
                  description: item.description || ""
                }))
              }
            ]
          }
        }
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.error("WhatsApp list send error:", error.response?.data || error.message);
    throw error;
  }
}

export async function sendMediaMessage(
  to: string,
  mediaType: "image" | "video" | "document" | "audio",
  mediaUrl: string,
  caption?: string
): Promise<any> {
  try {
    const response = await axios.post(
      WHATSAPP_MESSAGES_URL,
      {
        messaging_product: "whatsapp",
        to: to,
        // WhatsApp expects type to match the media block name
        type: mediaType,
        [mediaType]: {
          link: mediaUrl,
          ...(caption ? { caption } : {})
        }
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.error("WhatsApp media send error:", error.response?.data || error.message);
    throw error;
  }
}

export async function sendFlowMessage(
  to: string,
  flowData: WhatsAppFlowData
): Promise<any> {
  try {
    ensureWhatsAppConfig();
    const toClean = cleanPhone(to);
    const response = await axios.post(
      WHATSAPP_MESSAGES_URL,
      {
        messaging_product: "whatsapp",
        to: toClean,
        type: "interactive",
        interactive: {
          type: "flow",
          body: {
            text: flowData.flow_cta
          },
          action: {
            name: "flow",
            parameters: {
              flow_token: flowData.flow_token,
              flow_id: flowData.flow_id,
              flow_action_payload: flowData.flow_action_payload
            }
          }
        }
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        },
      }
    );
    console.log('WhatsApp flow send success:', response.data);
    return response.data;
  } catch (error: any) {
    console.error("WhatsApp flow send error:", error.response?.data || error.message);
    throw error;
  }
}

export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string = "en",
  parameters: any[] = []
): Promise<any> {
  try {
    const response = await axios.post(
      WHATSAPP_MESSAGES_URL,
      {
        messaging_product: "whatsapp",
        to: to,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: languageCode
          },
          components: parameters.length > 0 ? [
            {
              type: "body",
              parameters: parameters.map(param => ({
                type: "text",
                text: param
              }))
            }
          ] : []
        }
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.error("WhatsApp template send error:", error.response?.data || error.message);
    throw error;
  }
}

// PRD-specific message templates
export function formatCriticalAlertMessage(alert: any, container: any): string {
  return `🚨 *CRITICAL ALERT*

Container: ${container.containerCode}
Issue: ${alert.title}
${alert.description}

⏰ Time: ${new Date(alert.detectedAt).toLocaleString()}

A service technician will be assigned shortly.

Service Request #${alert.serviceRequestId || 'TBD'}

Reply URGENT for immediate callback`;
}

// WhatsApp Message Templates according to PRD
export const WHATSAPP_TEMPLATES = {
  // Alert Notifications
  CRITICAL_ALERT: {
    name: "critical_alert_notification_v3",
    category: "UTILITY",
    language: "en",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "CRITICAL ALERT"
      },
      {
        type: "BODY",
        text: "Container {{1}} requires immediate attention.\n\nIssue: {{2}}\nLocation: {{3}}\n\nA service technician will be assigned shortly.\n\nService Request #{{4}}"
      },
      {
        type: "FOOTER",
        text: "Reply URGENT for immediate callback"
      }
    ]
  },

  HIGH_ALERT: {
    name: "high_alert_notification_v3",
    category: "UTILITY",
    language: "en",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "HIGH PRIORITY ALERT"
      },
      {
        type: "BODY",
        text: "Container {{1}} needs attention within 24 hours.\n\nIssue: {{2}}\n\nService will be scheduled automatically.\n\nService Request #{{3}}"
      }
    ]
  },

  // Service Schedule Templates
  SERVICE_SCHEDULE_CLIENT: {
    name: "service_schedule_client_v3",
    category: "UTILITY",
    language: "en",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Service Scheduled"
      },
      {
        type: "BODY",
        text: "Container: {{1}}\nDate: {{2}}\nTime Window: {{3}}\nTechnician: {{4}}\n\nTrack status: {{5}}"
      }
    ]
  },

  SERVICE_SCHEDULE_TECHNICIAN: {
    name: "service_schedule_technician_v3",
    category: "UTILITY",
    language: "en",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Tomorrows Schedule"
      },
      {
        type: "BODY",
        text: "Total Services: {{1}}\n\nServices scheduled for tomorrow. Check your dashboard for full details."
      }
    ]
  },

  // Invoice Templates
  INVOICE_GENERATED: {
    name: "invoice_generated_v3",
    category: "UTILITY",
    language: "en",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Invoice Generated"
      },
      {
        type: "BODY",
        text: "Invoice #{{1}}\nService: {{2}}\nAmount: ₹{{3}}\nDue Date: {{4}}\n\nPDF: {{5}}"
      }
    ]
  },

  PAYMENT_REMINDER: {
    name: "payment_reminder_v3",
    category: "UTILITY",
    language: "en",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Payment Reminder"
      },
      {
        type: "BODY",
        text: "Invoice #{{1}} is due on {{2}}\nAmount: ₹{{3}}\n\nPay now to avoid late fees."
      }
    ]
  },

  // Feedback Templates
  FEEDBACK_REQUEST: {
    name: "feedback_request_v3",
    category: "UTILITY",
    language: "en",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "How was our service?"
      },
      {
        type: "BODY",
        text: "Service completed for Container {{1}}\n\nPlease rate your experience:\n\n5 - Excellent\n4 - Good\n3 - Average\n2 - Poor\n1 - Very Poor"
      }
    ]
  },

  // Technician Workflow Templates
  TECHNICIAN_SERVICE_START: {
    name: "technician_service_start_v3",
    category: "UTILITY",
    language: "en",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Service Starting"
      },
      {
        type: "BODY",
        text: "Service request received. Please check your dashboard for details and confirm parts availability."
      }
    ]
  },

  TECHNICIAN_SERVICE_COMPLETE: {
    name: "technician_service_complete_v3",
    category: "UTILITY",
    language: "en",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Service Completed"
      },
      {
        type: "BODY",
        text: "Service completed successfully. Please complete documentation in your dashboard."
      }
    ]
  },

  // Status Update Templates
  CONTAINER_STATUS_UPDATE: {
    name: "container_status_update_v3",
    category: "UTILITY",
    language: "en",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Status Update"
      },
      {
        type: "BODY",
        text: "Container status updated. Check your dashboard for current information."
      }
    ]
  },

  // Welcome and Help Templates
  WELCOME_CLIENT: {
    name: "welcome_client_v3",
    category: "UTILITY",
    language: "en",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Welcome"
      },
      {
        type: "BODY",
        text: "Welcome to ContainerGenie! Use 'status', 'service', or 'invoice' commands to get started."
      }
    ]
  },

  // Enhanced Location Proof Templates (NEW)
  TECHNICIAN_LOCATION_PROOF: {
    name: "technician_location_proof_v1",
    category: "UTILITY",
    language: "en",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Location Verification Required"
      },
      {
        type: "BODY",
        text: "Please send a photo proving you have arrived at Container {{1}} location.\n\nThis photo will be stored with the service record for quality assurance."
      }
    ]
  },

  LOCATION_PROOF_RECEIVED: {
    name: "location_proof_received_v1",
    category: "UTILITY",
    language: "en",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Location Proof Received"
      },
      {
        type: "BODY",
        text: "Thank you for submitting location proof for Container {{1}}.\n\nYou can now start the service. Tap the button below to proceed."
      }
    ]
  },

  // Enhanced Technician Templates (NEW)
  TECHNICIAN_DAILY_BRIEF: {
    name: "technician_daily_brief_v1",
    category: "UTILITY",
    language: "en",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Good Morning!"
      },
      {
        type: "BODY",
        text: "Hello {{1}}, you have {{2}} services scheduled today.\n\nFirst service: {{3}} at {{4}}\n\nPlease confirm you've reviewed today's schedule."
      }
    ]
  },

  SERVICE_DOCUMENTATION_COMPLETE: {
    name: "service_documentation_complete_v1",
    category: "UTILITY",
    language: "en",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Documentation Complete"
      },
      {
        type: "BODY",
        text: "Service documentation for Request #{{1}} has been completed.\n\nBefore photos: {{2}}\nAfter photos: {{3}}\nLocation proof: {{4}}\n\nCustomer will be notified upon approval."
      }
    ]
  },

  // Enhanced Customer Service Templates (NEW)
  SERVICE_APPROVAL_REQUEST: {
    name: "service_approval_request_v1",
    category: "UTILITY",
    language: "en",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Service Completion Pending Approval"
      },
      {
        type: "BODY",
        text: "Service for Container {{1}} has been completed by technician {{2}}.\n\nPlease review the documentation and approve to finalize the service."
      }
    ]
  },

  RESCHEDULE_CONFIRMATION: {
    name: "reschedule_confirmation_v1",
    category: "UTILITY",
    language: "en",
    components: [
      {
        type: "HEADER",
        format: "TEXT",
        text: "Service Rescheduled"
      },
      {
        type: "BODY",
        text: "This is an important update regarding your service request {{1}} for Container {{2}}. The service has been rescheduled to {{3}}.\n\nNew time slot: {{4}}\nAssigned technician: {{5}}"
      }
    ]
  }
};

// Template Management Functions
export async function registerWhatsAppTemplate(templateConfig: any): Promise<any> {
  const baseId = await resolveWabaId();
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${baseId}/message_templates`;
  const token = WHATSAPP_TOKEN;

  try {
    // Ensure WhatsApp configuration is available
    if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_TOKEN) {
      throw new Error('WhatsApp configuration missing. Please set WA_PHONE_NUMBER_ID and CLOUD_API_ACCESS_TOKEN environment variables.');
    }

    // Check if template already exists
    const existingTemplates = await getWhatsAppTemplates();
    const existingTemplate = existingTemplates.data?.find((t: any) => t.name === templateConfig.name);

    if (existingTemplate) {
      console.log(`Template ${templateConfig.name} already exists, skipping registration`);
      return { message: 'Template already exists', template: existingTemplate };
    }

    // Filter out button components as WhatsApp Business API doesn't support them in message templates
    const whatsappTemplate = {
      name: templateConfig.name,
      category: templateConfig.category,
      language: templateConfig.language,
      components: templateConfig.components.filter((component: any) =>
        component.type !== 'BUTTONS'
      )
    };

    const response = await axios.post(
      url,
      whatsappTemplate,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    console.log('WhatsApp template registration success:', response.data);
    return response.data;
  } catch (error: any) {
    // Handle specific error cases
    if (error.response?.status === 400 && error.response?.data?.error?.error_subcode === 2388024) {
      console.log(`Template ${templateConfig.name} already exists with different content, skipping`);
      return { message: 'Template already exists with different content' };
    }

    console.error("WhatsApp template registration error:", error.response?.data || error.message);
    // Provide more detailed error information
    if (error.response?.data) {
      console.error("WhatsApp API Error Details:", error.response.data);
    }
    throw error;
  }
}

export async function getWhatsAppTemplates(): Promise<any> {
  const baseId = await resolveWabaId();
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${baseId}/message_templates`;
  const token = WHATSAPP_TOKEN;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error: any) {
    console.error("WhatsApp template fetch error:", error.response?.data || error.message);
    throw error;
  }
}

export async function deleteWhatsAppTemplate(templateName: string): Promise<any> {
  const baseId = await resolveWabaId();
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${baseId}/message_templates`;
  const token = WHATSAPP_TOKEN;

  try {
    const response = await axios.delete(`${url}?name=${encodeURIComponent(templateName)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error: any) {
    console.error("WhatsApp template deletion error:", error.response?.data || error.message);
    throw error;
  }
}

export async function updateWhatsAppTemplate(templateName: string, templateData: any): Promise<any> {
  // For WhatsApp Business API, templates cannot be updated directly.
  // Instead, we need to delete the existing template and create a new one with a new name.
  // This is a limitation of the WhatsApp Business API.

  // First, delete the existing template
  await deleteWhatsAppTemplate(templateName);

  // Then create a new template with the updated data
  const updatedTemplateData = {
    ...templateData,
    name: `${templateData.name}_updated_${Date.now()}`, // Create a new unique name
  };

  const result = await registerWhatsAppTemplate(updatedTemplateData);
  return result;
}

// Template Registration Function
export async function registerAllTemplates(): Promise<any> {
  const results = [];

  for (const [key, template] of Object.entries(WHATSAPP_TEMPLATES)) {
    try {
      const result = await registerWhatsAppTemplate(template);
      if (result.message?.includes('already exists')) {
        results.push({ template: key, status: 'skipped', message: result.message });
        console.log(`⏭️ Template ${key} already exists, skipping`);
      } else {
        results.push({ template: key, status: 'success', data: result });
        console.log(`✅ Template ${key} registered successfully`);
      }
    } catch (error: any) {
      results.push({ template: key, status: 'error', error: error.message });
      console.error(`❌ Failed to register template ${key}:`, error.message);
    }
  }

  return results;
}


export function formatInvoiceMessage(invoice: any): string {
  return `📄 *Invoice #${invoice.invoiceNumber}*

Service: ${invoice.serviceDescription || 'Container Service'}
Amount: ₹${invoice.totalAmount}
Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}

Invoice PDF: [Download](https://example.com/invoice/${invoice.id})

Payment Link: [Pay Now](https://example.com/pay/${invoice.id})`;
}

export function formatFeedbackRequestMessage(serviceRequest: any): string {
  return `✅ *Service Completed*

Thank you for using our service!

Please rate your experience:

Container: ${serviceRequest.container?.containerId}
Service: ${serviceRequest.issueDescription}
Completed: ${new Date(serviceRequest.actualEndTime).toLocaleString()}

Your feedback helps us improve our service quality.`;
}

// WhatsApp workflow functions for technicians
export async function sendTechnicianSchedule(technician: any, services: any[]): Promise<any> {
  const message = formatServiceScheduleMessage(technician, services);
  
  return await sendInteractiveButtons(
    technician.phoneNumber,
    message,
    [
      { id: "acknowledge", title: "Acknowledge" },
      { id: "view_details", title: "View Details" },
      { id: "report_issue", title: "Report Issue" }
    ]
  );
}

export async function sendServiceStartPrompt(technician: any, service: any): Promise<any> {
  const message = `🔧 *Service Starting*

Container: ${service.container?.containerId}
Location: ${service.container?.currentLocation?.address}
Issue: ${service.issueDescription}

Please confirm you have all required parts before starting.`;

  return await sendInteractiveButtons(
    technician.phoneNumber,
    message,
    [
      { id: "start_service", title: "Start Service" },
      { id: "missing_parts", title: "Missing Parts" },
      { id: "need_help", title: "Need Help" }
    ]
  );
}

export async function sendServiceCompletePrompt(technician: any, service: any): Promise<any> {
  const message = `✅ *Service Completion*

Container: ${service.container?.containerId}
Service Duration: ${service.serviceDuration || 'TBD'} minutes

Please upload photos and complete documentation.`;

  return await sendInteractiveButtons(
    technician.phoneNumber,
    message,
    [
      { id: "complete_service", title: "Complete Service" },
      { id: "upload_photos", title: "Upload Photos" },
      { id: "add_notes", title: "Add Notes" }
    ]
  );
}

export async function sendCustomerFeedbackRequest(customer: any, service: any): Promise<any> {
  const message = formatFeedbackRequestMessage(service);
  
  return await sendInteractiveButtons(
    customer.phoneNumber,
    message,
    [
      { id: "rate_5", title: "⭐⭐⭐⭐⭐ Excellent" },
      { id: "rate_4", title: "⭐⭐⭐⭐ Good" },
      { id: "rate_3", title: "⭐⭐⭐ Average" },
      { id: "rate_2", title: "⭐⭐ Poor" },
      { id: "rate_1", title: "⭐ Very Poor" }
    ]
  );
}

// WhatsApp authorization function
export async function authorizeWhatsAppMessage(phoneNumber: string): Promise<{authorized: boolean, user?: any, roleData?: any, error?: string}> {
  try {
    // Normalize phone: keep digits only
    const digitsOnly = (phoneNumber || '').replace(/\D/g, '');
    const cleanPhone = digitsOnly;

<<<<<<< HEAD
    console.log(`[WhatsApp Auth] Looking up user for phone: ${phoneNumber} → normalized: ${cleanPhone}`);

    const { storage } = await import('../storage');
    
    // Try multiple phone number formats to handle database inconsistencies
    const phoneVariants = [
      cleanPhone,                                    // 918218994855
      `+${cleanPhone}`,                              // +918218994855
    ];
    
    // Add variants with/without country code for Indian numbers
    if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
      const withoutCountry = cleanPhone.slice(2);    // 8218994855
      phoneVariants.push(withoutCountry);
      phoneVariants.push(`+${withoutCountry}`);
    } else if (cleanPhone.length === 10) {
      const withIndia = `91${cleanPhone}`;           // 918218994855
      phoneVariants.push(withIndia);
      phoneVariants.push(`+${withIndia}`);
    }

    console.log(`[WhatsApp Auth] Trying phone variants:`, phoneVariants);

    // Try all variants and collect all matching users
    let users: any[] = [];
    for (const variant of phoneVariants) {
      const foundUser = await storage.getUserByPhoneNumber(variant);
      if (foundUser && !users.find(u => u.id === foundUser.id)) {
        users.push(foundUser);
      }
    }

    // If multiple users found, prioritize client role over others
    let user = null;
    if (users.length > 1) {
      console.log(`[WhatsApp Auth] Found ${users.length} users, prioritizing client role`);
      user = users.find(u => u.role === 'client') || users[0];
    } else if (users.length === 1) {
      user = users[0];
    }

    if (user) {
      console.log(`[WhatsApp Auth] Found user: ${user.name} (${user.id}) - Role: ${user.role}`);
    }

    // Special case for test numbers: support country and local formats (centralized)
    const isTestNumber = isRoleTestNumber(cleanPhone);
=======
    const { storage } = await import('../storage');
    let user = await storage.getUserByPhoneNumber(cleanPhone);

    // Try common variants if not found (e.g., India country code 91)
    if (!user) {
      if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
        const withoutCountry = cleanPhone.slice(2);
        user = await storage.getUserByPhoneNumber(withoutCountry);
      } else if (cleanPhone.length === 10) {
        const withIndia = `91${cleanPhone}`;
        user = await storage.getUserByPhoneNumber(withIndia) || user;
      }
    }

    // Special case for test numbers: support country and local formats
    const isTestNumber = cleanPhone === '917021307474' || cleanPhone === '7021307474' || cleanPhone === '917021037474';
>>>>>>> all-ui-working
    if (isTestNumber && !user) {
      console.log('🧪 Creating mock user for testing WhatsApp flows');
      // Create a test user for the test number
      user = await storage.createUser({
        phoneNumber: cleanPhone,
        name: 'Test User',
<<<<<<< HEAD
        email: `test_${cleanPhone}@example.com`,
=======
        email: 'test@example.com',
>>>>>>> all-ui-working
        role: 'client', // Default role, can be overridden by testingRole
        password: 'test123',
        isActive: true,
        whatsappVerified: true,
        emailVerified: false
      });

      console.log('✅ Created test user:', user.id);

      // Create mock client profile for testing
      const roleData = await storage.createCustomer({
        userId: user.id,
        companyName: 'Test Company',
        contactPerson: 'Test Contact',
<<<<<<< HEAD
        email: `test_${cleanPhone}@example.com`,
=======
        email: 'test@example.com',
>>>>>>> all-ui-working
        phone: cleanPhone,
        whatsappNumber: cleanPhone,
        customerTier: 'standard',
        paymentTerms: 'net30',
        billingAddress: 'Test Address',
        status: 'active'
      });

      console.log('✅ Created test client profile:', roleData?.id);

      return { authorized: true, user, roleData };
    }

    // Override user role if testingRole is set for the test number
    if (isTestNumber && user && user.role !== 'admin') {
      const { storage } = await import('../storage');
      const session = await storage.getWhatsappSession(cleanPhone);
      const testingRole = (session?.conversationState as any)?.testingRole;

      if (testingRole && testingRole !== user.role) {
        console.log(`🧪 Overriding role to ${testingRole} for testing`);
        // Update user role for testing
        user = await storage.updateUser(user.id, { role: testingRole });

        // Create appropriate profile based on testing role
        let roleData = null;
        if (testingRole === 'technician') {
          // Create mock technician profile
          roleData = await storage.createTechnician({
            userId: user.id,
            employeeCode: 'TEST001',
            experienceLevel: 'senior',
            skills: ['electrical', 'mechanical', 'refrigeration'],
            baseLocation: { lat: 28.6139, lng: 77.2090 }, // Delhi coordinates
            serviceAreas: ['Delhi', 'Noida', 'Gurgaon'],
            status: 'available'
          });
        } else if (testingRole === 'client') {
          // Use existing client profile or create if missing
          roleData = await storage.getCustomerByUserId(user.id);
          if (!roleData) {
            roleData = await storage.createCustomer({
              userId: user.id,
              companyName: 'Test Company',
              contactPerson: 'Test Contact',
              email: 'test@example.com',
              phone: cleanPhone,
              whatsappNumber: cleanPhone,
              customerTier: 'standard',
              paymentTerms: 'net30',
              billingAddress: 'Test Address',
              status: 'active'
            });
          }
        }

        return { authorized: true, user, roleData };
      }
    }

    if (!user) {
      return {
        authorized: false,
        error: "Your phone number is not registered in our system. Please contact support to get registered."
      };
    }

    if (!user.isActive) {
      return {
        authorized: false,
        error: "Your account is not active. Please contact support."
      };
    }

<<<<<<< HEAD
    // Get role-specific data based on user role
    let roleData = null;
    if (user.role === 'client') {
      console.log(`[WhatsApp Auth] Looking up customer for user ${user.id} (${user.name})`);
      roleData = await storage.getCustomerByUserId(user.id);
      if (!roleData) {
        console.error(`[WhatsApp Auth] Customer profile not found for user ${user.id}`);
=======
    if (!user.whatsappVerified) {
      return {
        authorized: false,
        error: "WhatsApp access not enabled. Please contact support."
      };
    }

    // Get role-specific data based on user role
    let roleData = null;
    if (user.role === 'client') {
      roleData = await storage.getCustomerByUserId(user.id);
      if (!roleData) {
>>>>>>> all-ui-working
        return {
          authorized: false,
          error: "Client profile not found. Please contact support to complete your registration."
        };
      }
<<<<<<< HEAD
      console.log(`[WhatsApp Auth] Found customer: ${roleData.companyName} (${roleData.id})`);

      // Auto-enable WhatsApp for clients with customer profiles (backward compatibility)
      if (!user.whatsappVerified) {
        console.log(`[WhatsApp Auth] Auto-enabling WhatsApp for client ${user.name}`);
        await storage.updateUser(user.id, { whatsappVerified: true });
        user.whatsappVerified = true;
      }
=======
>>>>>>> all-ui-working
    } else if (user.role === 'technician') {
      roleData = await storage.getTechnicianByUserId(user.id);
      if (!roleData) {
        return {
          authorized: false,
          error: "Technician profile not found. Please contact support to complete your registration."
        };
      }
<<<<<<< HEAD

      // Check WhatsApp verification for technicians
      if (!user.whatsappVerified) {
        return {
          authorized: false,
          error: "WhatsApp access not enabled. Please contact support."
        };
      }
    } else {
      // For other roles, check WhatsApp verification
      if (!user.whatsappVerified) {
        return {
          authorized: false,
          error: "WhatsApp access not enabled. Please contact support."
        };
      }
=======
>>>>>>> all-ui-working
    }

    return { authorized: true, user, roleData };

  } catch (error) {
    console.error('Error authorizing WhatsApp message:', error);
    return {
      authorized: false,
      error: "Authorization check failed. Please try again later."
    };
  }
}

// Enhanced WhatsApp webhook handler for incoming messages and interactive responses
export async function handleWebhook(body: any): Promise<any> {
  try {
    console.log('Received WhatsApp webhook:', JSON.stringify(body, null, 2));

    // Handle different types of webhook events
    if (body.object === 'whatsapp_business_account') {
      const { storage } = await import('../storage');

      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'messages') {
            const messageData = change.value;
            const message = messageData.messages?.[0];

            if (!message) continue;

            const from = message.from; // Sender's phone number (digits with country code)
            const messageId = message.id;
            const timestamp = message.timestamp;

            // Check if we've already processed this message
            const existingMessage = await storage.getWhatsAppMessageById(messageId);
            if (existingMessage) {
              console.log(`Message ${messageId} already processed`);
              continue;
            }

             // Special test number flow: handle first before authorization
            const cleanFrom = from.replace(/\D/g, '');
            const isTestNumber = isRoleTestNumber(cleanFrom);
            const isFlowTestNumber = typeof from === 'string' && from.replace(/\D/g, '') === '917021037474';

            if (isTestNumber) {
              console.log('🧪 Processing test number message');

              // Get or create session for test number
              let session = await storage.getWhatsappSession(from);
              if (!session) {
                // Create test user first
                const testUser = await storage.createUser({
                  phoneNumber: from.replace(/\D/g, ''),
                  name: 'Test User',
                  email: 'test@example.com',
                  role: 'client',
                  password: 'test123',
                  isActive: true,
                  whatsappVerified: true,
                  emailVerified: false
                });

                // Create test client profile
                await storage.createCustomer({
                  userId: testUser.id,
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

                session = await storage.createWhatsappSession({
                  phoneNumber: from,
                  userId: testUser.id,
                  conversationState: {},
                  lastMessageAt: new Date(),
                  isActive: true,
                });

                console.log('🧪 Created test session and profile for', from);
              }

              const testingRole = (session.conversationState as any)?.testingRole;

               // If no role selected yet, handle selection or prompt
               if (!testingRole) {
                 // Always send an immediate text acknowledgement so the user sees a reply even if interactive fails
                 try {
<<<<<<< HEAD
                   await sendTextMessage(from, '🧪 Hi! Choose a role to test using the buttons below.');
=======
                   await sendTextMessage(from, '🧪 Hi! Choose a role to test: reply with "technician" or "client". Buttons will appear shortly.');
>>>>>>> all-ui-working
                 } catch (e) {
                   console.error('🧪 Immediate text acknowledgement failed:', e);
                 }
                 // Handle interactive role selection buttons
                 if (message.type === 'interactive' && message.interactive?.type === 'button_reply') {
                   const buttonId = message.interactive.button_reply.id;
                   if (buttonId === 'test_role_technician' || buttonId === 'test_role_client') {
                     const selectedRole = buttonId === 'test_role_technician' ? 'technician' : 'client';
                     await storage.updateWhatsappSession(session.id, {
                       conversationState: { ...(session.conversationState || {}), testingRole: selectedRole }
                     });
                     await sendTextMessage(from, `🧪 Testing as ${selectedRole}. Continue your flow.`);

                     // Show initial menu for convenience
                     if (selectedRole === 'technician') {
                       await sendInteractiveButtons(
                         from,
                         `🔧 Technician Mode Activated\n\n🧪 Test Number: ${from}\n👤 Role: ${selectedRole}\n\nWhat would you like to do?`,
                         [
                           { id: 'check_schedule', title: '📅 Check Schedule' },
                           { id: 'switch_role', title: '🔄 Switch Role' }
                         ]
                       );
                     } else {
                       await sendInteractiveButtons(
                         from,
                         `🏢 Client Mode Activated\n\n🧪 Test Number: ${from}\n👤 Role: ${selectedRole}\n\nHow can I help you today?`,
                         [
                           { id: 'check_container_details', title: '📦 Check Container Details' },
                           { id: 'request_service', title: '🔧 Request Service' },
                           { id: 'check_service_status', title: '📋 Check Service Status' },
                           { id: 'check_container_status', title: '📊 Check Container Status' },
                           { id: 'switch_role', title: '🔄 Switch Role' }
                         ]
                       );
                     }

                     await storage.updateWhatsappSession(session.id, { lastMessageAt: new Date() });
                     continue; // We've handled the selection, no need to fall through
                   }
                 }

                 // Allow simple text-based selection
                 if (message.type === 'text') {
                   const text = message.text?.body?.toLowerCase().trim();
                   if (text === 'technician' || text === 'tech') {
                     await storage.updateWhatsappSession(session.id, {
                       conversationState: { ...(session.conversationState || {}), testingRole: 'technician' }
                     });
                     await sendTextMessage(from, `🧪 Testing as Technician. Continue your flow.`);
                     await storage.updateWhatsappSession(session.id, { lastMessageAt: new Date() });
                     continue;
                   } else if (text === 'client') {
                     await storage.updateWhatsappSession(session.id, {
                       conversationState: { ...(session.conversationState || {}), testingRole: 'client' }
                     });
                     await sendTextMessage(from, `🧪 Testing as Client. Continue your flow.`);
                     await storage.updateWhatsappSession(session.id, { lastMessageAt: new Date() });
                     continue;
                   }
                 }

                 console.log('🧪 Test number first message - prompting for role selection');

                 // Store the message for later processing
                 await storage.createWhatsappMessage({
                   recipientType: 'customer',
                   recipientId: session.userId,
                   phoneNumber: from,
                   messageType: message.type,
                   templateName: null,
                   messageContent: message,
                   whatsappMessageId: messageId,
                   status: 'delivered',
                   conversationId: session.id,
                   relatedEntityType: 'whatsapp_inbound',
                   relatedEntityId: messageId,
                   sentAt: new Date(parseInt(timestamp) * 1000),
                 });

                 console.log('🧪 About to send role selection buttons to:', from);
                 try {
<<<<<<< HEAD
                   await sendTestRoleSelectionMenu(from);
=======
                   await sendInteractiveButtons(
                     from,
                     '🧪 Select role to test WhatsApp flow:',
                     [
                       { id: 'test_role_technician', title: '🔧 Technician' },
                       { id: 'test_role_client', title: '🏢 Client' }
                     ]
                   );
>>>>>>> all-ui-working
                   console.log('🧪 Role selection buttons sent successfully');
                 } catch (error) {
                   console.error('🧪 Failed to send role selection buttons:', error);
                   // Fallback to text message
                   await sendTextMessage(from, '🧪 Select role to test WhatsApp flow:\n\nReply with "technician" or "client"');
                 }

                 await storage.updateWhatsappSession(session.id, {
                   lastMessageAt: new Date(),
                 });
                 continue; // Don't process the message yet
               }

              // For test number with role selected, use session data directly
              // Get the test user and role data
              if (!session.userId) {
                await sendTextMessage(from, "Test session invalid. Please try again.");
                continue;
              }

              const testUser = await storage.getUser(session.userId);
              if (!testUser) {
                await sendTextMessage(from, "Test user not found. Please try again.");
                continue;
              }

              // Apply role override from testingRole
              const overriddenUser = { ...testUser, role: testingRole };
              let roleData = null;

              if (testingRole === 'technician') {
                roleData = await storage.getTechnicianByUserId(testUser.id);
                if (!roleData) {
                  // Create test technician profile
                  roleData = await storage.createTechnician({
                    userId: testUser.id,
                    employeeCode: 'TEST001',
                    experienceLevel: 'senior',
                    skills: ['electrical', 'mechanical', 'refrigeration'],
                    baseLocation: { lat: 28.6139, lng: 77.2090 },
                    serviceAreas: ['Delhi', 'Noida', 'Gurgaon'],
                    status: 'available'
                  });
                  console.log('🧪 Created test technician profile');
                }
              } else if (testingRole === 'client') {
                roleData = await storage.getCustomerByUserId(testUser.id);
                if (!roleData) {
                  // Create test client profile
                  roleData = await storage.createCustomer({
                    userId: testUser.id,
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
                  console.log('🧪 Created test client profile');
                }
              }

              const user = overriddenUser;

              // Process the message based on type and user role (with possible testing override)
              await processIncomingMessage(message, user, roleData, session);

<<<<<<< HEAD
              // Send a compact menu after processing to avoid duplicate prompts (test-mode helpers)
              try {
                if (testingRole === 'technician') {
                  await sendTestTechnicianMenu(from);
                } else if (testingRole === 'client') {
                  await sendTestClientMenu(from);
=======
              // Send a compact menu after processing to avoid duplicate prompts
              try {
                if (testingRole === 'technician') {
                  await sendInteractiveButtons(
                    from,
                    `🔧 Technician Mode`,
                    [
                      { id: 'view_schedule', title: '📋 View Schedule' },
                      { id: 'start_service', title: '🔧 Start Service' },
                      { id: 'switch_role', title: '🔄 Switch Role' }
                    ]
                  );
                } else if (testingRole === 'client') {
                  await sendInteractiveButtons(
                    from,
                    `🏢 Client Mode`,
                    [
                      { id: 'request_service', title: '🔧 Request Service' },
                      { id: 'check_status', title: '📊 Status' },
                      { id: 'switch_role', title: '🔄 Switch Role' }
                    ]
                  );
>>>>>>> all-ui-working
                }
              } catch {}

              await storage.updateWhatsappSession(session.id, {
                lastMessageAt: new Date(),
              });

              // Broadcast the message to connected WebSocket clients
              const broadcastWhatsAppMessage = (global as any).broadcastWhatsAppMessage;
              if (broadcastWhatsAppMessage) {
                broadcastWhatsAppMessage({
                  from,
                  message,
                  timestamp: new Date(),
                  userId: user.id,
                  userRole: user.role,
                  sessionId: session.id
                }, user.id);
              }
               continue; // Skip normal flow for test number
             }

             // Flow test number: handle flow testing
             if (isFlowTestNumber) {
               console.log('🧪 Processing flow test number message');

               if (message.type === 'interactive' && message.interactive?.type === 'button_reply') {
                 const buttonId = message.interactive.button_reply.id;
                 await handleFlowTestButtonClick(buttonId, from);
               } else {
                 // Send flow initiation message
                 await sendInteractiveButtons(
                   from,
                   '🧪 *WhatsApp Flow Test Initiation*\n\nWelcome to ContainerGenie WhatsApp Flow Testing!\n\nChoose a flow to test:',
                   [
                     { id: 'test_client_flow', title: '🏢 Test Client Flow' },
                     { id: 'test_technician_flow', title: '🔧 Test Technician Flow' },
                     { id: 'test_alert_flow', title: '🚨 Test Alert Flow' },
                     { id: 'test_service_flow', title: '🔧 Test Service Flow' }
                   ]
                 );
               }

               continue; // Skip normal flow for flow test number
             }

             // Normal authorization for non-test numbers
            const authResult = await authorizeWhatsAppMessage(from);

            if (!authResult.authorized) {
              await sendTextMessage(from, authResult.error || "Not authorized");
              continue;
            }

            const user = authResult.user;
            const roleData = authResult.roleData;

            // Get or create session
            let session = await storage.getWhatsappSession(from);
            if (!session) {
              session = await storage.createWhatsappSession({
                phoneNumber: from,
                userId: user.id,
                conversationState: {},
                lastMessageAt: new Date(),
                isActive: true,
              });
            }

            // Store the incoming message
            await storage.createWhatsappMessage({
              recipientType: user.role === 'technician' ? 'technician' : 'customer',
              recipientId: user.id,
              phoneNumber: from,
              messageType: message.type,
              templateName: null,
              messageContent: message,
              whatsappMessageId: messageId,
              status: 'delivered',
              conversationId: session.id,
              relatedEntityType: 'whatsapp_inbound',
              relatedEntityId: messageId,
              sentAt: new Date(parseInt(timestamp) * 1000),
            });

            // Process the message based on type and user role
            await processIncomingMessage(message, user, roleData, session);

            // Update session timestamp
            await storage.updateWhatsappSession(session.id, {
              lastMessageAt: new Date(),
            });

            // Broadcast the message to connected WebSocket clients
            const broadcastWhatsAppMessage = (global as any).broadcastWhatsAppMessage;
            if (broadcastWhatsAppMessage) {
              broadcastWhatsAppMessage({
                from,
                message,
                timestamp: new Date(),
                userId: user.id,
                userRole: user.role,
                sessionId: session.id
              }, user.id); // Send to the specific user
            }
          }
        }
      }

      return { status: 'processed', message: 'Webhook processed successfully' };
    }

    return { status: 'ignored', message: 'Not a WhatsApp message' };
  } catch (error) {
    console.error('Error processing WhatsApp webhook:', error);
    throw error;
  }
}


// Handle flow test button clicks
async function handleFlowTestButtonClick(buttonId: string, from: string): Promise<void> {
  try {
    switch (buttonId) {
      case 'test_client_flow':
        await sendTextMessage(from, '🏢 *Client Flow Test*\n\nTesting client functionalities:\n• Container status\n• Service requests\n• Invoice management\n• Alert monitoring\n\nReply with "status" to test container status.');
        break;
      case 'test_technician_flow':
        await sendTextMessage(from, '🔧 *Technician Flow Test*\n\nTesting technician functionalities:\n• Daily schedule\n• Performance stats\n• Location management\n• Inventory status\n\nReply with "schedule" to test schedule view.');
        break;
      case 'test_alert_flow':
        await sendTextMessage(from, '🚨 *Alert Flow Test*\n\nTesting alert notifications:\n• Critical alerts\n• High priority alerts\n• Resolution workflows\n\nSimulating an alert...');
        // Simulate sending an alert
        setTimeout(async () => {
          await sendTextMessage(from, '🚨 *CRITICAL ALERT*\n\nContainer: TEST001\nIssue: Temperature anomaly\nLocation: Test Location\n\nA service technician will be assigned shortly.');
        }, 1000);
        break;
      case 'test_service_flow':
        await sendTextMessage(from, '🔧 *Service Flow Test*\n\nTesting service management:\n• Service request creation\n• Technician assignment\n• Service completion\n• Feedback collection\n\nService flow initiated.');
        break;
      default:
        await sendTextMessage(from, '❓ Unknown test option. Please try again.');
    }
  } catch (error) {
    console.error('Error handling flow test button:', error);
    await sendTextMessage(from, '❌ Error in flow test. Please try again.');
  }
}

// Process incoming WhatsApp messages based on user role and message type
async function processIncomingMessage(message: any, user: any, roleData: any, session: any): Promise<void> {
  const { storage } = await import('../storage');
  const from = message.from;

<<<<<<< HEAD
  console.log(`[WhatsApp] processIncomingMessage called - from: ${from}, type: ${message.type}, user: ${user?.name}, role: ${user?.role}`);

  try {
    if (message.type === 'text') {
      console.log(`[WhatsApp] Message is text type, calling handleTextMessage`);
      await handleTextMessage(message, user, roleData, session);
    } else if (message.type === 'interactive') {
      console.log(`[WhatsApp] Message is interactive type`);
      await handleInteractiveMessage(message, user, roleData, session);
    } else if (message.type === 'image' || message.type === 'video' || message.type === 'document') {
      console.log(`[WhatsApp] Message is media type: ${message.type}`);
      await handleMediaMessage(message, user, roleData, session);
    } else {
      console.log(`[WhatsApp] Unknown message type: ${message.type}`);
    }
  } catch (error) {
    console.error('[WhatsApp] Error processing message:', error);
=======
  try {
    if (message.type === 'text') {
      await handleTextMessage(message, user, roleData, session);
            } else if (message.type === 'interactive') {
      await handleInteractiveMessage(message, user, roleData, session);
    } else if (message.type === 'image' || message.type === 'video' || message.type === 'document') {
      await handleMediaMessage(message, user, roleData, session);
    }
  } catch (error) {
    console.error('Error processing message:', error);
>>>>>>> all-ui-working
    await sendTextMessage(from, 'Sorry, I encountered an error processing your message. Please try again.');
  }
}

// Handle text messages based on user role and conversation state
async function handleTextMessage(message: any, user: any, roleData: any, session: any): Promise<void> {
  const text = message.text?.body?.toLowerCase().trim();
  const from = message.from;

<<<<<<< HEAD
  console.log(`[WhatsApp] handleTextMessage called - from: ${from}, text: "${text}", user role: ${user?.role}`);

  // Testing override for the special number: route by chosen role
  const isTestNumber = typeof from === 'string' && isRoleTestNumber(from);
  const testingRole = session?.conversationState?.testingRole as string | undefined;

  console.log(`[WhatsApp] isTestNumber: ${isTestNumber}, testingRole: ${testingRole}`);

  if (user?.role === 'client' || (isTestNumber && testingRole === 'client')) {
    console.log(`[WhatsApp] Routing to handleClientTextMessage`);
    await handleClientTextMessage(text, from, user, roleData, session);
  } else if (user?.role === 'technician' || (isTestNumber && testingRole === 'technician')) {
    console.log(`[WhatsApp] Routing to handleTechnicianTextMessage`);
    await handleTechnicianTextMessage(text, from, user, roleData, session);
  } else {
    console.log(`[WhatsApp] No role match - isTestNumber: ${isTestNumber}, testingRole: ${testingRole}`);
    // For test numbers without a selected role, show role selection buttons instead of error
    if (isTestNumber && !testingRole) {
      await sendTestRoleSelectionMenu(from);
    } else {
      await sendTextMessage(from, 'Your role is not recognized. Please contact support.');
    }
=======
  // Testing override for the special number: route by chosen role
  const isTestNumber = typeof from === 'string' && isRoleTestNumber(from);
  const testingRole = session.conversationState?.testingRole as string | undefined;

  if (user.role === 'client' || (isTestNumber && testingRole === 'client')) {
    await handleClientTextMessage(text, from, user, roleData, session);
  } else if (user.role === 'technician' || (isTestNumber && testingRole === 'technician')) {
    await handleTechnicianTextMessage(text, from, user, roleData, session);
  } else {
    await sendTextMessage(from, 'Your role is not recognized. Please contact support.');
>>>>>>> all-ui-working
  }
}

// Handle client text messages with enhanced role-based features
async function handleClientTextMessage(text: string, from: string, user: any, roleData: any, session: any): Promise<void> {
  const { storage } = await import('../storage');
  const conversationState = session.conversationState || {};
  const customer = roleData; // roleData is the customer data for clients

<<<<<<< HEAD
  // Check if customer data exists
  if (!customer) {
    console.error(`[WhatsApp] Customer profile not found for user ${user?.id} (phone: ${from})`);
    await sendTextMessage(
      from,
      '❌ Your client profile is not found in our system.\n\nPlease contact support to complete your registration.'
    );
    return;
  }
  
  console.log(`[WhatsApp] Processing message for customer: ${customer.companyName} (${customer.id})`);
  console.log(`[WhatsApp] Conversation state:`, JSON.stringify(conversationState, null, 2));

  // Clear leftover legacy flow data for real clients (non-test numbers)
  const isTestNumber = typeof from === 'string' && isRoleTestNumber(from);
  if (!isTestNumber && conversationState.flow === 'service_request') {
    console.log(`[WhatsApp] Clearing leftover legacy service_request flow from session for real client`);
    const { storage } = await import('../storage');
    await storage.updateWhatsappSession(session.id, {
      conversationState: {}
    });
    // Update local reference
    session.conversationState = {};
    // Clear the local conversationState object
    for (const key in conversationState) {
      delete conversationState[key];
    }
    console.log(`[WhatsApp] Session cleared, conversation state is now empty`);
  }

  // Handle REAL service request flow steps (new dashboard integration)
  if (conversationState.flow === 'real_service_request') {
    console.log(`[WhatsApp] In real_service_request flow, step: ${conversationState.step}`);
    if (conversationState.step === 'awaiting_error_code') {
      await handleErrorCodeInput(text, from, user, session);
      return;
    }
    if (conversationState.step === 'awaiting_description') {
      await handleIssueDescriptionInput(text, from, user, session);
      return;
    }
    if (conversationState.step === 'awaiting_photos') {
      if (text.toUpperCase() === 'DONE') {
        await createServiceRequestFromWhatsApp(from, user, session);
      } else {
        await sendTextMessage(from, '📸 Please send photos or type *DONE* to submit the request.');
      }
      return;
    }
  }

  // Handle service request flow steps (legacy)
  if (conversationState.flow === 'service_request') {
    console.log(`[WhatsApp] In legacy service_request flow - calling handleServiceRequestFlow`);
=======
  // Handle service request flow steps
  if (conversationState.flow === 'service_request') {
>>>>>>> all-ui-working
    await serviceRequestViaWhatsApp.handleServiceRequestFlow({ text: { body: text } }, user, session);
    return;
  }

<<<<<<< HEAD
  console.log(`[WhatsApp] No active flow, processing as new message`);


  // Enhanced command handling with detailed client-specific information
  const lowerText = text.toLowerCase().trim();
  console.log(`[WhatsApp] Client message text: "${text}" → normalized: "${lowerText}"`);
  
  if (lowerText.includes('status') || lowerText.includes('container')) {
    console.log(`[WhatsApp] Handling status request for ${customer.companyName}`);
    await handleClientContainerStatus(from, customer, storage);
  } else if (lowerText.includes('service') || lowerText.includes('help') || lowerText.includes('request')) {
    console.log(`[WhatsApp] Handling service request for ${customer.companyName}`);
    await handleClientServiceRequests(from, customer, user, session, storage);
  } else if (lowerText.includes('invoice') || lowerText.includes('bill') || lowerText.includes('payment')) {
    console.log(`[WhatsApp] Handling invoice request for ${customer.companyName}`);
    await handleClientInvoices(from, customer, storage);
  } else if (lowerText.includes('alert') || lowerText.includes('notification')) {
    console.log(`[WhatsApp] Handling alerts for ${customer.companyName}`);
    await handleClientAlerts(from, customer, storage);
  } else if (lowerText.includes('location') || lowerText.includes('track')) {
    console.log(`[WhatsApp] Handling tracking for ${customer.companyName}`);
    await handleClientContainerTracking(from, customer, storage);
  } else if (lowerText.includes('history') || lowerText.includes('service history')) {
    console.log(`[WhatsApp] Handling service history for ${customer.companyName}`);
    await handleClientServiceHistory(from, customer, storage);
  } else {
    // For any unrecognized text, send main menu
    console.log(`[WhatsApp] Sending welcome menu to ${customer.companyName} (${customer.contactPerson})`);
    try {
      await sendTextMessage(
        from,
        `👋 Welcome ${customer.contactPerson}!\n\n🏢 ${customer.companyName}\n\nHow can I help you today?`
      );
      console.log(`[WhatsApp] Welcome message sent successfully`);
    } catch (error) {
      console.error(`[WhatsApp] Error sending welcome message:`, error);
      throw error;
    }
    
    try {
      console.log(`[WhatsApp] Now sending menu buttons`);
      await sendRealClientMenu(from);
      console.log(`[WhatsApp] Menu buttons sent successfully`);
    } catch (error) {
      console.error(`[WhatsApp] Error sending menu buttons:`, error);
      throw error;
    }
=======
  // Enhanced command handling with detailed client-specific information
  if (text.includes('status') || text.includes('container')) {
    await handleClientContainerStatus(from, customer, storage);
  } else if (text.includes('service') || text.includes('help') || text.includes('request')) {
    await handleClientServiceRequests(from, customer, user, session, storage);
  } else if (text.includes('invoice') || text.includes('bill') || text.includes('payment')) {
    await handleClientInvoices(from, customer, storage);
  } else if (text.includes('alert') || text.includes('notification')) {
    await handleClientAlerts(from, customer, storage);
  } else if (text.includes('location') || text.includes('track')) {
    await handleClientContainerTracking(from, customer, storage);
  } else if (text.includes('history') || text.includes('service history')) {
    await handleClientServiceHistory(from, customer, storage);
  } else {
    // For any unrecognized text, send main menu
    await sendInteractiveButtons(
      from,
      `👋 Welcome ${customer.contactPerson}!\n\n🏢 ${customer.companyName}\n\nHow can I help you today?`,
      [
        { id: 'check_containers', title: '📦 My Containers' },
        { id: 'request_service', title: '🔧 Request Service' },
        { id: 'check_services', title: '📋 Service History' },
        { id: 'view_invoices', title: '💰 View Invoices' }
      ]
    );
>>>>>>> all-ui-working
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

<<<<<<< HEAD
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
  if (buttonId.startsWith('select_container_')) {
    const containerId = buttonId.replace('select_container_', '');
    await handleContainerSelection(containerId, from, user, session);
    return;
  }

  // Handle REAL container selection for status check (non-test)
  if (buttonId.startsWith('status_container_')) {
    const containerId = buttonId.replace('status_container_', '');
    await showContainerStatus(containerId, from, user, session);
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

  // Handle multi-container selection buttons
  if (buttonId === 'add_more_containers') {
    // Show container list again for additional selection
    await handleRealClientRequestService(from, user, session);
    return;
  }

  if (buttonId === 'proceed_with_selection') {
    // Proceed to error code input
    const { storage } = await import('../storage');
    const conversationState = session.conversationState || {};
    const selectedContainers = conversationState.selectedContainers || [];
    
    if (selectedContainers.length === 0) {
      await sendTextMessage(from, '❌ No containers selected. Please start again.');
      await sendRealClientMenu(from);
      return;
    }

    // Get container codes for display
    const containerCodes = [];
    for (const cId of selectedContainers) {
      const c = await storage.getContainer(cId);
      if (c) containerCodes.push(c.containerCode);
    }

    // Update to error code step
    await storage.updateWhatsappSession(session.id, {
      conversationState: {
        ...conversationState,
        step: 'awaiting_error_code'
      }
    });

    await sendTextMessage(
      from,
      `📦 *Selected Container(s):*\n${containerCodes.join(', ')}\n\n❓ *What error code are you getting?*\n\nType the error code, or reply *NA* if no error code.`
    );
=======
  // Testing override: let the special number choose or switch roles
  const isTestNumber = typeof from === 'string' && isRoleTestNumber(from);
  if (isTestNumber && (buttonId === 'test_role_technician' || buttonId === 'test_role_client' || buttonId === 'switch_role')) {
    if (buttonId === 'switch_role') {
      // Clear testingRole to go back to role selection
      await storage.updateWhatsappSession(session.id, {
        conversationState: { ...(conversationState || {}), testingRole: null }
      });
      await sendTextMessage(from, '🧪 Role cleared. Please select a new role to test:');
      await sendInteractiveButtons(
        from,
        '🧪 Select role to test WhatsApp flow:',
        [
          { id: 'test_role_technician', title: '🔧 Technician' },
          { id: 'test_role_client', title: '🏢 Client' }
        ]
      );
      return;
    }
    const testingRole = buttonId === 'test_role_technician' ? 'technician' : 'client';
    await storage.updateWhatsappSession(session.id, {
      conversationState: { ...(conversationState || {}), testingRole }
    });
    await sendTextMessage(from, `🧪 Testing as ${testingRole}. Continue your flow.`);

    // Show appropriate menu for the selected role
    if (testingRole === 'technician') {
      await sendInteractiveButtons(
        from,
        `🔧 Technician Mode Activated\n\n🧪 Test Number: ${from}\n👤 Role: ${testingRole}\n\nWhat would you like to do?`,
        [
          { id: 'check_schedule', title: '📅 Check Schedule' },
          { id: 'switch_role', title: '🔄 Switch Role' }
        ]
      );
    } else if (testingRole === 'client') {
      await sendInteractiveButtons(
        from,
        `🏢 Client Mode Activated\n\n🧪 Test Number: ${from}\n👤 Role: ${testingRole}\n\nHow can I help you today?`,
        [
          { id: 'check_container_details', title: '📦 Check Container Details' },
          { id: 'request_service', title: '🔧 Request Service' },
          { id: 'check_service_status', title: '📋 Check Service Status' },
          { id: 'check_container_status', title: '📊 Check Container Status' },
          { id: 'switch_role', title: '🔄 Switch Role' }
        ]
      );
    }
>>>>>>> all-ui-working
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
<<<<<<< HEAD
      await handleRealClientRequestService(from, user, session);
=======
      await initiateServiceRequestFlow(from, user, session);
>>>>>>> all-ui-working
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
<<<<<<< HEAD
      await handleRealClientRequestService(from, user, session);
=======
      await initiateServiceRequestFlow(from, user, session);
>>>>>>> all-ui-working
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
      await sendInteractiveButtons(
        from,
        `👋 Hello ${user.name}!\n\n🔧 Employee Code: ${technician.employeeCode}\n📍 Status: ${technician.status.toUpperCase()}\n\nWhat would you like to do?`,
        [
          { id: 'check_schedule', title: '📅 Check Schedule' },
          { id: 'view_profile', title: '👤 View Profile' },
          { id: 'update_status', title: '📊 Update Status' }
        ]
      );
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

  switch (buttonId) {
    case 'check_schedule':
      await sendInteractiveButtons(
        from,
        '📅 *Select Schedule Date*',
        [
          { id: 'schedule_today', title: '📅 Today\'s Schedule' },
          { id: 'schedule_tomorrow', title: '📅 Tomorrow\'s Schedule' },
          { id: 'schedule_specific', title: '📅 Specific Date' }
        ]
      );
      break;

    case 'schedule_today':
      const technicianToday = await storage.getTechnicianByUserId(user.id);
      if (technicianToday) {
        await handleTechnicianSchedule(from, technicianToday, storage);
      }
      break;

    case 'schedule_tomorrow':
      const technicianTomorrow = await storage.getTechnicianByUserId(user.id);
      if (technicianTomorrow) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        await handleTechnicianScheduleForDate(from, technicianTomorrow, storage, tomorrow.toISOString().split('T')[0]);
      }
      break;

    case 'schedule_specific':
      await sendTextMessage(from, '📅 Please enter the date in YYYY-MM-DD format (e.g., 2025-10-25)');
      await storage.updateWhatsappSession(session.id, {
        conversationState: { ...conversationState, awaiting_date: true }
      });
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
        await sendListMessage(from, 'Select service to start:', 'Select Service', listItems);
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

<<<<<<< HEAD
  // Handle container selection for service request (real client flow)
  if (listId.startsWith('select_container_')) {
    const containerId = listId.replace('select_container_', '');
    await handleContainerSelection(containerId, from, user, session);
    return;
  }

  // Handle container selection for status check (real client flow)
  if (listId.startsWith('status_container_')) {
    const containerId = listId.replace('status_container_', '');
    await showContainerStatus(containerId, from, user, session);
    return;
  }

=======
>>>>>>> all-ui-working
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
async function handleMediaMessage(message: any, user: any, roleData: any, session: any): Promise<void> {
  const from = message.from;

  const { storage } = await import('../storage');

  // WhatsApp media payload structure varies by type
  const mediaType = message.type; // 'image' | 'video' | 'document'
  const media = (message as any)[mediaType];
  const mediaId = media?.id || media?.media_id;
  const caption = media?.caption || '';

<<<<<<< HEAD
  // Handle CLIENT photo uploads during real service request flow
  if (user.role === 'client' && session.conversationState?.flow === 'real_service_request') {
    if (session.conversationState?.step === 'awaiting_photos' && mediaId) {
      await handlePhotoUpload(mediaId, from, user, session);
      return;
    }
  }

=======
>>>>>>> all-ui-working
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
<<<<<<< HEAD
    // Guard against null actualStartTime
    const startMs = service.actualStartTime
      ? new Date(service.actualStartTime).getTime()
      : Date.now();
    const duration = Math.max(0, Math.round((Date.now() - startMs) / (1000 * 60)));
=======
    const duration = Math.round((new Date().getTime() - service.actualStartTime.getTime()) / (1000 * 60));
>>>>>>> all-ui-working
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
};
