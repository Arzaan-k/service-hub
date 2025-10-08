import axios from "axios";

const WHATSAPP_API_URL = `https://graph.facebook.com/v16.0/${process.env.WA_PHONE_NUMBER_ID}/messages`;
const WHATSAPP_TOKEN = process.env.CLOUD_API_ACCESS_TOKEN || "";

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
    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: "whatsapp",
        to: to,
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
    return response.data;
  } catch (error: any) {
    console.error("WhatsApp send error:", error.response?.data || error.message);
    throw error;
  }
}

export async function sendInteractiveButtons(
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>
): Promise<any> {
  try {
    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: "whatsapp",
        to: to,
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
    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: "whatsapp",
        to: to,
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
    return response.data;
  } catch (error: any) {
    console.error("WhatsApp send error:", error.response?.data || error.message);
    throw error;
  }
}

export async function sendTemplate(to: string, templateName: string, languageCode = "en_US"): Promise<any> {
  try {
    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: "whatsapp",
        to: to,
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
      WHATSAPP_API_URL,
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
      WHATSAPP_API_URL,
      {
        messaging_product: "whatsapp",
        to: to,
        type: "media",
        [mediaType]: {
          link: mediaUrl,
          caption: caption || ""
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
    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: "whatsapp",
        to: to,
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
      WHATSAPP_API_URL,
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
