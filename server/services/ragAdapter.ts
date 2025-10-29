import { db } from "../db";
import { ragQueries, manuals, manualChunks } from "../../shared/schema";
import { eq, desc } from "drizzle-orm";

interface RagQueryRequest {
  user_id?: string;
  unit_id?: string;
  unit_model?: string;
  alarm_code?: string;
  query: string;
  context?: any;
}

interface RagQueryResponse {
  answer: string;
  steps: string[];
  sources: Array<{
    manual_id: string;
    manual_name: string;
    page: number;
  }>;
  confidence: 'high' | 'medium' | 'low';
  suggested_spare_parts?: string[];
  request_id: string;
}

export class RagAdapter {
  private ragServiceUrl: string;

  constructor() {
    this.ragServiceUrl = process.env.RAG_SERVICE_URL || 'http://localhost:8001';
  }

  async query(request: RagQueryRequest): Promise<RagQueryResponse> {
    try {
      // Call the actual RAG service
      const response = await fetch(`${this.ragServiceUrl}/api/v1/rag/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        timeout: 30000 // 30 second timeout
      });

      if (!response.ok) {
        throw new Error(`RAG service returned ${response.status}: ${response.statusText}`);
      }

      const ragResponse: RagQueryResponse = await response.json();

      // Store the query in database
      await this.storeQuery(request, ragResponse);

      return ragResponse;
    } catch (error) {
      console.error('RAG query failed:', error);
      throw error; // Re-throw the error instead of falling back to mock
    }
  }

  private async storeQuery(request: RagQueryRequest, response: RagQueryResponse): Promise<void> {
    try {
      await db.insert(ragQueries).values({
        userId: request.user_id,
        unitId: request.unit_id,
        queryText: request.query,
        responseText: response.answer,
        sources: response.sources,
        confidence: response.confidence,
        suggestedParts: response.suggested_spare_parts || [],
        context: request.context || {}
      });
    } catch (error) {
      console.error('Failed to store RAG query:', error);
      // Don't throw - logging failure shouldn't break the main flow
    }
  }

  private getMockResponse(request: RagQueryRequest): RagQueryResponse {
    const responses = {
      default: {
        answer: "I've analyzed the available manuals for your unit. Here's what I found:",
        steps: [
          "Check the alarm code against the unit's diagnostic manual",
          "Verify sensor connections and wiring",
          "Test the component mentioned in the alarm",
          "Replace faulty parts if identified",
          "Clear the alarm and test the system"
        ],
        sources: [{
          manual_id: "123",
          manual_name: `${request.unit_model || 'Thermo King'} Service Manual`,
          page: 45
        }],
        confidence: 'medium' as const,
        suggested_spare_parts: ["Sensor assembly", "Control board", "Wiring harness"],
        request_id: `mock-${Date.now()}`
      },

      alarm17: {
        answer: "Alarm 17 typically indicates a return air sensor fault on Thermo King units.",
        steps: [
          "Locate the return air sensor (usually in the evaporator section)",
          "Check sensor wiring for continuity and secure connections",
          "Test sensor resistance (should be approximately 10kΩ at 25°C)",
          "Replace sensor if resistance is out of specification",
          "Clear alarm and verify temperature control operation"
        ],
        sources: [{
          manual_id: "456",
          manual_name: "Thermo King SL-500 Troubleshooting Guide",
          page: 42
        }],
        confidence: 'high' as const,
        suggested_spare_parts: ["Return air temperature sensor", "Sensor wiring harness"],
        request_id: `mock-${Date.now()}`
      }
    };

    if (request.alarm_code === 'Alarm 17' || request.query.toLowerCase().includes('alarm 17')) {
      return responses.alarm17;
    }

    return responses.default;
  }

  // Get query history for a user
  async getUserQueryHistory(userId: string, limit: number = 50): Promise<any[]> {
    try {
      const history = await db
        .select()
        .from(ragQueries)
        .where(eq(ragQueries.userId, userId))
        .orderBy(ragQueries.createdAt)
        .limit(limit);

      return history;
    } catch (error) {
      console.error('Failed to get user query history:', error);
      return [];
    }
  }

  // Get query history for a specific container
  async getContainerQueryHistory(containerId: string, limit: number = 20): Promise<any[]> {
    try {
      const history = await db
        .select()
        .from(ragQueries)
        .where(eq(ragQueries.unitId, containerId))
        .orderBy(ragQueries.createdAt)
        .limit(limit);

      return history;
    } catch (error) {
      console.error('Failed to get container query history:', error);
      return [];
    }
  }

  // Get manual information for admin interface
  async getManuals(): Promise<any[]> {
    try {
      const manualsList = await db
        .select()
        .from(manuals)
        .orderBy(manuals.uploadedOn);

      return manualsList;
    } catch (error) {
      console.error('Failed to get manuals:', error);
      return [];
    }
  }

  // Delete manual
  async deleteManual(manualId: string): Promise<void> {
    try {
      // Delete associated chunks first
      await db.delete(manualChunks).where(eq(manualChunks.manualId, manualId));

      // Delete manual
      await db.delete(manuals).where(eq(manuals.id, manualId));
    } catch (error) {
      console.error('Failed to delete manual:', error);
      throw error;
    }
  }

  // Upload a new manual (would integrate with file storage)
  async uploadManual(manualData: {
    name: string;
    sourceUrl?: string;
    uploadedBy: string;
    version?: string;
    meta?: any;
  }): Promise<any> {
    try {
      const [manual] = await db
        .insert(manuals)
        .values({
          ...manualData,
          uploadedOn: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      return manual;
    } catch (error) {
      console.error('Failed to upload manual:', error);
      throw error;
    }
  }

  // Get troubleshooting suggestions for alerts
  async getAlertSuggestions(containerId: string, alarmCode: string, unitModel?: string): Promise<RagQueryResponse | null> {
    try {
      // Check cache first (Redis would be ideal here)
      const cacheKey = `alert_suggestions:${containerId}:${alarmCode}`;

      // For now, generate a query based on the alarm
      const query = `What are the troubleshooting steps for ${alarmCode} on ${unitModel || 'this unit'}?`;

      const request: RagQueryRequest = {
        unit_id: containerId,
        unit_model: unitModel,
        alarm_code: alarmCode,
        query: query,
        context: { source: 'alert_suggestion' }
      };

      return await this.query(request);
    } catch (error) {
      console.error('Failed to get alert suggestions:', error);
      return null;
    }
  }
}

export const ragAdapter = new RagAdapter();
