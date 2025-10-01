import axios from "axios";

const WHATSAPP_API_URL = `https://graph.facebook.com/v16.0/${process.env.WA_PHONE_NUMBER_ID}/messages`;
const WHATSAPP_TOKEN = process.env.CLOUD_API_ACCESS_TOKEN || "";

export interface WhatsAppMessage {
  to: string;
  type: "text" | "interactive" | "template";
  content: any;
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
  return `🚨 *Alert: ${alert.severity.toUpperCase()}*

Container: *${container.containerId}*
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
    message += `   Container: ${service.container?.containerId}\n`;
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
