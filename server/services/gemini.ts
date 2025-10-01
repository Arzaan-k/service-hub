import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface AlertClassification {
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  confidence: number;
  requiresImmediateService: boolean;
  estimatedServiceTime: number;
  requiredParts: string[];
  resolutionSteps: string[];
  rootCause: string;
}

export async function classifyAlert(
  errorCode: string,
  description: string,
  containerData: any
): Promise<AlertClassification> {
  try {
    const systemPrompt = `You are an expert container service engineer with deep knowledge of IoT-enabled containers, refrigeration systems, power systems, and logistics equipment.
Analyze container alerts and provide structured classification with actionable recommendations.`;

    const prompt = `Analyze this container alert and provide detailed classification:

Error Code: ${errorCode}
Description: ${description}
Container Type: ${containerData.type}
Current Status: ${JSON.stringify(containerData.currentLocation)}
Container Age: ${containerData.age || 'Unknown'}

Provide a detailed analysis including:
1. Severity level (critical/high/medium/low)
2. Alert category (power_system/cooling_system/door_security/sensor_malfunction/preventive_maintenance)
3. Confidence score (0-1)
4. Whether immediate service is required
5. Estimated service time in minutes
6. Required spare parts (if any)
7. Step-by-step resolution instructions
8. Root cause analysis`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
            category: { type: "string" },
            confidence: { type: "number" },
            requiresImmediateService: { type: "boolean" },
            estimatedServiceTime: { type: "number" },
            requiredParts: { type: "array", items: { type: "string" } },
            resolutionSteps: { type: "array", items: { type: "string" } },
            rootCause: { type: "string" },
          },
          required: [
            "severity",
            "category",
            "confidence",
            "requiresImmediateService",
            "estimatedServiceTime",
            "requiredParts",
            "resolutionSteps",
            "rootCause",
          ],
        },
      },
      contents: prompt,
    });

    const rawJson = response.text;
    if (rawJson) {
      const classification: AlertClassification = JSON.parse(rawJson);
      return classification;
    } else {
      throw new Error("Empty response from Gemini AI");
    }
  } catch (error) {
    console.error("Gemini AI classification error:", error);
    // Fallback classification
    return {
      severity: "medium",
      category: "unknown",
      confidence: 0.5,
      requiresImmediateService: false,
      estimatedServiceTime: 120,
      requiredParts: [],
      resolutionSteps: ["Contact technical support for manual diagnosis"],
      rootCause: "AI classification unavailable",
    };
  }
}

export async function generateServiceSchedule(
  serviceRequests: any[],
  technicians: any[]
): Promise<any> {
  try {
    const systemPrompt = `You are an expert logistics optimizer specializing in field service scheduling.
Create optimal daily schedules considering travel time, service priority, technician skills, and geographic clustering.`;

    const prompt = `Generate an optimized daily schedule for field technicians:

Service Requests:
${JSON.stringify(serviceRequests, null, 2)}

Available Technicians:
${JSON.stringify(technicians, null, 2)}

Requirements:
1. Minimize total travel distance
2. Prioritize critical and high-priority requests
3. Match technician skills to service requirements
4. Consider working hours (8-hour shifts)
5. Group geographically close services
6. Ensure spare parts availability
7. Respect customer preferred time windows

Provide assignments for each technician with service sequence, estimated travel times, and route.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            assignments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  technicianId: { type: "string" },
                  services: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        serviceRequestId: { type: "string" },
                        sequence: { type: "number" },
                        estimatedStartTime: { type: "string" },
                        travelTimeMinutes: { type: "number" },
                      },
                    },
                  },
                  totalTravelDistance: { type: "number" },
                  routeOptimizationScore: { type: "number" },
                },
              },
            },
          },
        },
      },
      contents: prompt,
    });

    const rawJson = response.text;
    if (rawJson) {
      return JSON.parse(rawJson);
    }
    throw new Error("Empty response from Gemini AI");
  } catch (error) {
    console.error("Gemini AI scheduling error:", error);
    return { assignments: [] };
  }
}

export async function generateInvoiceDescription(serviceRequest: any): Promise<string> {
  try {
    const prompt = `Generate a professional invoice description for this service:

Service Request: ${JSON.stringify(serviceRequest, null, 2)}

Create a clear, concise description suitable for invoicing, highlighting the work performed and parts used.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text || "Service completed as requested";
  } catch (error) {
    console.error("Gemini AI invoice description error:", error);
    return "Container service completed";
  }
}
