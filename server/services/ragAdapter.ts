import { db } from "../db";
import { ragQueries, manuals, manualChunks, users } from "../../shared/schema";
import { eq, desc } from "drizzle-orm";
import { cloudQdrantStore } from "./cloudQdrantStore";

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
  references: string[]; // Add references field for clean citations
  confidence: 'high' | 'medium' | 'low';
  suggested_spare_parts?: string[];
  request_id: string;
}

export class RagAdapter {
  private nvidiaApiKey: string;

  constructor() {
    this.nvidiaApiKey = process.env.NVIDIA_API_KEY || '';
    if (!this.nvidiaApiKey) {
      console.warn('NVIDIA_API_KEY not found. LLM functionality will be limited.');
    }
  }

  async query(request: RagQueryRequest): Promise<RagQueryResponse> {
    try {
      // Debug: Check what manuals are in the database
      try {
        const allManuals = await db.select({ id: manuals.id, title: manuals.title }).from(manuals);
        console.log('DEBUG: All manuals in database:', allManuals);
      } catch (error) {
        console.error('DEBUG: Error querying manuals:', error);
      }

      // Perform vector search to find relevant chunks
      const searchResults = await cloudQdrantStore.search(
        request.query,
        5, // Get top 5 results
        {
          model: request.unit_model,
          // Add more filters as needed
        }
      );

      if (searchResults.length === 0) {
        const noResultsResponse: RagQueryResponse = {
          answer: "No relevant information found in the manual.",
          steps: [],
          sources: [],
          references: [], // Add empty references
          confidence: 'low',
          suggested_spare_parts: [],
          request_id: `rag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };
        await this.storeQuery(request, noResultsResponse);
        return noResultsResponse;
      }

      // Return the most relevant text passages with source information
      const passages: string[] = [];
      const processedSources = new Set<string>();
      const references: string[] = [];

      for (const result of searchResults) {
        const manualId = result.metadata.manualId;
        const pageNum = result.metadata.pageNum || 'N/A';
        console.error('DEBUG: Processing search result with manualId:', manualId, 'pageNum:', pageNum);

        // Get manual name from database
        let manualName = 'Service Manual';
        try {
          const [manual] = await db.select({ name: manuals.name, sourceUrl: manuals.sourceUrl }).from(manuals).where(eq(manuals.id, manualId)).limit(1);
          console.error('DEBUG: Manual lookup for ID', manualId, ':', manual);
          if (manual) {
            manualName = manual.name || 'Service Manual';
            console.error('DEBUG: Found manual name:', manualName);
          } else {
            console.error('DEBUG: No manual found for ID:', manualId);
            // Try to find similar manuals or log all manuals for debugging
            const allManuals = await db.select({ id: manuals.id, name: manuals.name }).from(manuals).limit(5);
            console.error('DEBUG: First 5 manuals in DB:', allManuals);
          }
        } catch (error) {
          console.error('Error getting manual name for ID', manualId, ':', error);
        }

        const sourceKey = `${manualName}_page_${pageNum}`;
        if (!processedSources.has(sourceKey)) {
          passages.push(result.text);
          processedSources.add(sourceKey);
          references.push(`from ${manualName} page ${pageNum}`);
        }
      }

      const fullAnswer = passages.join('\n\n---\n\n') + '\n\nReferences:\n' + references.join('\n');

      const ragResponse: RagQueryResponse = {
        answer: fullAnswer,
        steps: [],
        sources: await this.getSourceInfo(searchResults),
        references: references, // Add references array
        confidence: 'high',
        suggested_spare_parts: [],
        request_id: `rag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };

      // Store the query in database
      await this.storeQuery(request, ragResponse);

      return ragResponse;
    } catch (error) {
      console.error('RAG query failed:', (error as any)?.message || error);
      const errorResponse: RagQueryResponse = {
        answer: "No relevant information found in the manual.",
        steps: [],
        sources: [],
        references: [], // Add empty references
        confidence: 'low',
        suggested_spare_parts: [],
        request_id: `rag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
      await this.storeQuery(request, errorResponse);
      return errorResponse;
    }
  }

  private   async storeQuery(request: RagQueryRequest, response: RagQueryResponse): Promise<void> {
    try {
      // Only store if user exists (for real users, not test queries)
      if (request.user_id && request.user_id !== 'test-user') {
        const userExists = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, request.user_id))
          .limit(1);

        if (userExists.length > 0) {
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
        }
      }
    } catch (error) {
      console.error('Failed to store RAG query:', error.message);
      // Don't throw - logging failure shouldn't break the main flow
    }
  }
  
  /**
   * Get source information from search results
   */
  private async getSourceInfo(searchResults: any[]): Promise<Array<{ manual_id: string; manual_name: string; page: number }>> {
    const sources: Array<{ manual_id: string; manual_name: string; page: number }> = [];

    for (const result of searchResults.slice(0, 3)) { // Limit to top 3 sources
      try {
        console.log('DEBUG: Processing result for manualId:', result.metadata.manualId);
        // Get manual information from database
        const manual = await db
          .select({ name: manuals.name })
          .from(manuals)
          .where(eq(manuals.id, result.metadata.manualId))
          .limit(1);

        console.log('DEBUG: Manual query result:', manual);

        // Use the manual name directly
        const manualName = manual[0]?.name || 'Service Manual';
        console.log('DEBUG: Final manualName:', manualName);

        sources.push({
          manual_id: result.metadata.manualId,
          manual_name: manualName,
          page: result.metadata.pageNum || 1
        });
      } catch (error) {
        console.error('Error getting source info:', error);
        sources.push({
          manual_id: result.metadata.manualId,
          manual_name: 'Service Manual',
          page: result.metadata.pageNum || 1
        });
      }
    }

    return sources;
  }
  
  /**
   * Determine confidence level based on search results and response
   */
  private determineConfidence(searchResults: any[], response: string): 'high' | 'medium' | 'low' {
    // High confidence: Multiple good matches with high scores
    if (searchResults.length >= 3 && searchResults[0].score > 0.8) {
      return 'high';
    }

    // Medium confidence: Some matches or response contains specific technical details
    if (searchResults.length >= 2 || response.includes('page') || /\b\d{2}-\d{4}-\d{3}\b/.test(response)) {
      return 'medium';
    }

    // Low confidence: Few or no matches, generic response
    return 'low';
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

  async getManual(manualId: string): Promise<any> {
    try {
      const [manual] = await db
        .select()
        .from(manuals)
        .where(eq(manuals.id, manualId))
        .limit(1);

      return manual;
    } catch (error) {
      console.error('Failed to get manual:', error);
      throw error;
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

  // Update an existing manual
  async updateManual(manualId: string, updateData: {
    name?: string;
    sourceUrl?: string;
    version?: string;
    meta?: any;
  }): Promise<any> {
    try {
      const [manual] = await db
        .update(manuals)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(manuals.id, manualId))
        .returning();

      return manual;
    } catch (error) {
      console.error('Failed to update manual:', error);
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

      const response = await this.query(request);
      
      // Add references to the answer if available
      if (response && response.references && response.references.length > 0) {
        response.answer += `\n\nReferences:\n${response.references.join('\n')}`;
      }
      
      return response;
    } catch (error) {
      console.error('Failed to get alert suggestions:', error);
      return null;
    }
  }
}

export const ragAdapter = new RagAdapter();
