// WhatsApp Helper Functions - Temporary file to add to whatsapp.ts
// Copy everything from line 8 onwards and insert after line 97 in whatsapp.ts

import axios from "axios";

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v20.0";
const WHATSAPP_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID || "";
const WHATSAPP_TOKEN = process.env.CLOUD_API_ACCESS_TOKEN || "";
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

const EMOJI_REGEX = /[\p{Extended_Pictographic}\uFE0E\uFE0F\u200D]/gu;

function sanitizeContent(input?: string | null, options: { trim?: boolean } = {}): string {
  if (!input) {
    return '';
  }
  let sanitized = input.replace(EMOJI_REGEX, '');
  sanitized = sanitized.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n');
  sanitized = sanitized.replace(/^\s+/, '');
  return options.trim ? sanitized.trim() : sanitized;
}

// ========================================
// WHATSAPP API HELPER FUNCTIONS
// ========================================

/**
 * Send a text message via WhatsApp
 */
export async function sendTextMessage(to: string, text: string): Promise<any> {
  ensureWhatsAppConfig();
  const cleanedPhone = cleanPhone(to);
  const sanitizedText = sanitizeContent(text);

  console.log(`📤 Attempting to send WhatsApp message to: ${to} Text: ${text.substring(0, 50)}...`);

  try {
    const response = await axios.post(
      WHATSAPP_MESSAGES_URL,
      {
        messaging_product: 'whatsapp',
        to: cleanedPhone,
        type: 'text',
        text: { body: sanitizedText }
      },
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ WhatsApp text send success:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ WhatsApp text send error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Send interactive buttons via WhatsApp
 */
export async function sendInteractiveButtons(to: string, bodyText: string, buttons: Array<{ id: string; title: string }>): Promise<any> {
  ensureWhatsAppConfig();
  const cleanedPhone = cleanPhone(to);
  const sanitizedBody = sanitizeContent(bodyText);
  const normalizedButtons = buttons.slice(0, 3).map((btn, idx) => {
    const title = sanitizeContent(btn.title, { trim: true });
    const safeTitle = (title || `Option ${idx + 1}`).substring(0, 20);
    return {
      type: 'reply',
      reply: {
        id: btn.id,
        title: safeTitle
      }
    };
  });

  const payload = {
    messaging_product: 'whatsapp',
    to: cleanedPhone,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: sanitizedBody },
      action: {
        buttons: normalizedButtons
      }
    }
  };

  try {
    const response = await axios.post(WHATSAPP_MESSAGES_URL, payload, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error: any) {
    console.error('WhatsApp buttons send error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Send interactive list via WhatsApp
 */
export async function sendInteractiveList(to: string, bodyText: string, buttonText: string, sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>): Promise<any> {
  ensureWhatsAppConfig();
  const cleanedPhone = cleanPhone(to);
  const sanitizedBody = sanitizeContent(bodyText);
  const buttonLabel = (sanitizeContent(buttonText, { trim: true }) || 'Select').substring(0, 20);
  const normalizedSections = sections.map((section, sectionIdx) => {
    const sectionTitle = sanitizeContent(section.title, { trim: true }) || `Section ${sectionIdx + 1}`;
    return {
      title: sectionTitle,
      rows: section.rows.map((row, rowIdx) => {
        const rowTitle = sanitizeContent(row.title, { trim: true });
        const safeRowTitle = (rowTitle || `Item ${rowIdx + 1}`).substring(0, 24);
        const rowDescription = sanitizeContent(row.description, { trim: true }).substring(0, 72);
        return {
          id: row.id,
          title: safeRowTitle,
          description: rowDescription
        };
      })
    };
  });

  const payload = {
    messaging_product: 'whatsapp',
    to: cleanedPhone,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: sanitizedBody },
      action: {
        button: buttonLabel,
        sections: normalizedSections
      }
    }
  };

  try {
    const response = await axios.post(WHATSAPP_MESSAGES_URL, payload, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error: any) {
    console.error('WhatsApp list send error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Send image via WhatsApp
 */
export async function sendImageMessage(to: string, imageUrl: string, caption?: string): Promise<any> {
  ensureWhatsAppConfig();
  const cleanedPhone = cleanPhone(to);
  const sanitizedCaption = sanitizeContent(caption, { trim: true });

  const payload = {
    messaging_product: 'whatsapp',
    to: cleanedPhone,
    type: 'image',
    image: {
      link: imageUrl,
      caption: sanitizedCaption || ''
    }
  };

  try {
    const response = await axios.post(WHATSAPP_MESSAGES_URL, payload, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error: any) {
    console.error('WhatsApp image send error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Send video via WhatsApp
 */
export async function sendVideoMessage(to: string, videoUrl: string, caption?: string): Promise<any> {
  ensureWhatsAppConfig();
  const cleanedPhone = cleanPhone(to);
  const sanitizedCaption = sanitizeContent(caption, { trim: true });

  const payload = {
    messaging_product: 'whatsapp',
    to: cleanedPhone,
    type: 'video',
    video: {
      link: videoUrl,
      caption: sanitizedCaption || ''
    }
  };

  try {
    const response = await axios.post(WHATSAPP_MESSAGES_URL, payload, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error: any) {
    console.error('WhatsApp video send error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Send template message via WhatsApp
 */
export async function sendTemplateMessage(to: string, templateName: string, languageCode: string, parameters: string[]): Promise<any> {
  ensureWhatsAppConfig();
  const cleanedPhone = cleanPhone(to);

  const payload = {
    messaging_product: 'whatsapp',
    to: cleanedPhone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: 'body',
          parameters: parameters.map(p => ({ type: 'text', text: p }))
        }
      ]
    }
  };

  try {
    const response = await axios.post(WHATSAPP_MESSAGES_URL, payload, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error: any) {
    console.error('WhatsApp template send error:', error.response?.data || error.message);
    throw error;
  }
}

export const sendListMessage = sendInteractiveList;

export async function authorizeWhatsAppMessage(phoneNumber: string): Promise<boolean> {
  return true;
}

export async function updateWhatsAppTemplate(templateName: string, content: any): Promise<void> {
  console.log(`Updating template: ${templateName}`);
}

export async function handleWebhook(body: any): Promise<any> {
  console.log('[WhatsApp Webhook] Received:', JSON.stringify(body, null, 2));

  try {
    // WhatsApp sends webhook data in this format
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value) {
      console.log('[WhatsApp Webhook] No value in webhook body');
      return { status: 'ok', message: 'No value' };
    }

    // Handle incoming messages
    if (value.messages && value.messages.length > 0) {
      const message = value.messages[0];
      const from = message.from;

      console.log(`[WhatsApp Webhook] Processing message from ${from}:`, message);

      // Import the main message processor from whatsapp.ts
      const { processIncomingMessage } = await import('./whatsapp');
      await processIncomingMessage(message, from);
    }

    // Handle status updates
    if (value.statuses && value.statuses.length > 0) {
      console.log('[WhatsApp Webhook] Status update:', value.statuses[0]);
    }

    return { status: 'ok', processed: true };
  } catch (error: any) {
    console.error('[WhatsApp Webhook] Error:', error);
    return { status: 'error', error: error?.message || 'Unknown error' };
  }
}

// ========================================
// ADDITIONAL HELPERS REQUIRED BY routes.ts
// ========================================

export function formatAlertMessage(alert: any, container: any): string {
  const code = alert?.alertCode || alert?.errorCode || 'ALERT';
  const severity = (alert?.severity || 'medium').toUpperCase();
  const title = alert?.title || 'Container Alert';
  const desc = alert?.description || 'No description provided';
  const cont = container?.containerCode || 'Unknown Container';
  const loc = container?.currentLocation?.address || container?.currentLocation?.city || 'Unknown Location';
  return `🚨 ${severity} Alert: ${title}\n\n` +
    `📦 Container: ${cont}\n` +
    `📍 Location: ${loc}\n` +
    `🆔 Code: ${code}\n\n` +
    `📝 ${desc}`;
}

export function formatCriticalAlertMessage(alert: any, container: any): string {
  return `🛑 CRITICAL ALERT\n\n${formatAlertMessage(alert, container)}\n\n` +
    `Please take immediate action.`;
}

export function formatServiceScheduleMessage(technician: any, services: any[] = []): string {
  const name = technician?.name || 'Technician';
  let msg = `📅 Schedule for ${name}\n\n`;
  if (!services || services.length === 0) {
    return msg + 'No scheduled services.';
  }
  services.slice(0, 5).forEach((s, i) => {
    const req = s?.requestNumber || s?.id || `#${i + 1}`;
    const cont = s?.container?.containerCode || 'Unknown';
    const when = s?.scheduledDate ? new Date(s.scheduledDate).toLocaleString() : 'TBD';
    msg += `• ${req} — ${cont} — ${when}\n`;
  });
  return msg;
}

export function formatTravelPlanMessage(plan: {
  technicianName: string;
  origin: string;
  destination: string;
  startDate: string | Date;
  endDate: string | Date;
  purpose?: string;
  notes?: string;
  costs?: any;
  tasks?: any[];
}): string {
  const start = plan.startDate ? new Date(plan.startDate).toLocaleDateString() : 'TBD';
  const end = plan.endDate ? new Date(plan.endDate).toLocaleDateString() : 'TBD';
  const totalCost = plan.costs?.totalEstimatedCost
    ? `₹${parseFloat(plan.costs.totalEstimatedCost).toLocaleString('en-IN')}`
    : 'N/A';
  const purpose = (plan.purpose || 'pm').toUpperCase();

  let message = `✈️ Travel Plan for ${plan.technicianName || 'Technician'}\n\n`;
  message += `📍 Destination: ${plan.destination}\n`;
  message += `🏠 Origin: ${plan.origin}\n`;
  message += `📅 Dates: ${start} → ${end}\n`;
  message += `🎯 Purpose: ${purpose}\n`;
  message += `💰 Estimated Cost: ${totalCost}\n`;
  if (plan.notes) {
    message += `📝 Notes: ${sanitizeContent(plan.notes)}\n`;
  }

  const tasks = plan.tasks || [];
  if (tasks.length) {
    message += `\n📦 Assigned Containers:\n`;
    tasks.slice(0, 5).forEach((task: any, idx: number) => {
      const code = task.container?.containerCode || task.containerId || `Task ${idx + 1}`;
      const site = task.siteName || task.customer?.companyName || 'Site TBD';
      const type = (task.taskType || 'pm').toUpperCase();
      const when = task.scheduledDate ? new Date(task.scheduledDate).toLocaleDateString() : 'TBD';
      message += `• ${code} — ${type} @ ${site} (${when})\n`;
    });
    if (tasks.length > 5) {
      message += `…and ${tasks.length - 5} more tasks.\n`;
    }
  } else {
    message += `\nNo containers/tasks assigned yet.\n`;
  }

  message += `\nHave a safe trip!`;
  return message;
}

export function formatInvoiceMessage(invoice: any, customer: any): string {
  const no = invoice?.invoiceNumber || 'INVOICE';
  const total = invoice?.totalAmount != null ? String(invoice.totalAmount) : 'N/A';
  const due = invoice?.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A';
  const cust = customer?.companyName || 'Customer';
  return `🧾 Invoice ${no}\n\n` +
    `👤 ${cust}\n` +
    `💰 Total: ${total}\n` +
    `📅 Due: ${due}`;
}

export function formatFeedbackRequestMessage(serviceRequest: any, customer: any): string {
  const req = serviceRequest?.requestNumber || 'Service Request';
  const cust = customer?.companyName || 'Customer';
  return `💬 Feedback Request\n\n` +
    `👤 ${cust}\n` +
    `🆔 ${req}\n\n` +
    `Please rate your service experience.`;
}

export async function sendMediaMessage(to: string, mediaUrl: string, caption = ''): Promise<any> {
  // Heuristic: send image for common extensions, otherwise try video
  const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(mediaUrl);
  if (isImage) {
    return sendImageMessage(to, mediaUrl, caption);
  }
  return sendVideoMessage(to, mediaUrl, caption);
}

export async function sendFlowMessage(to: string, flowId: string, data?: any): Promise<any> {
  // Placeholder: Send as text with a reference to the flow
  const payload = `🔗 Open flow: ${flowId}${data ? `\n\nData: ${JSON.stringify(data)}` : ''}`;
  return sendTextMessage(to, payload);
}

export async function sendTechnicianSchedule(to: string, technician: any, services: any[]): Promise<void> {
  const msg = formatServiceScheduleMessage(technician, services);
  await sendTextMessage(to, msg);
}

export async function sendServiceStartPrompt(to: string, service: any): Promise<void> {
  const title = service?.requestNumber || 'Service';
  await sendInteractiveButtons(
    to,
    `Start service ${title}?`,
    [
      { id: `start_service_${service?.id || 'now'}`, title: '▶️ Start' },
      { id: 'back_to_menu', title: '🏠 Menu' }
    ]
  );
}

export async function sendServiceCompletePrompt(to: string, service: any): Promise<void> {
  const title = service?.requestNumber || 'Service';
  await sendInteractiveButtons(
    to,
    `Complete service ${title}?`,
    [
      { id: `end_service_for_${service?.id || 'current'}`, title: '✅ Complete' },
      { id: 'back_to_menu', title: '🏠 Menu' }
    ]
  );
}

export async function sendCustomerFeedbackRequest(customer: any, serviceRequest: any): Promise<void> {
  const to = customer?.whatsappNumber || customer?.phoneNumber;
  if (!to) return;
  const msg = formatFeedbackRequestMessage(serviceRequest, customer);
  await sendTextMessage(to, msg);
  await sendInteractiveButtons(
    to,
    'Please rate this service:',
    [
      { id: `feedback_${serviceRequest?.id || 'sr'}_5`, title: '⭐⭐⭐⭐⭐' },
      { id: `feedback_${serviceRequest?.id || 'sr'}_4`, title: '⭐⭐⭐⭐' },
      { id: `feedback_${serviceRequest?.id || 'sr'}_3`, title: '⭐⭐⭐' }
    ]
  );
}

export function formatOnsiteContactDisplay(phone: string, digits: string): string {
  return digits ? `${phone} (${digits})` : phone || 'N/A';
}

export function formatPreferredContactDisplay(dateStr: string): string {
  if (!dateStr) return 'ASAP';
  if (dateStr.toLowerCase() === 'no preference') return 'No preference';
  return dateStr;
}
