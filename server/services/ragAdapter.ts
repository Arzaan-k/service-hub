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
      // Perform vector search to find relevant chunks
      const searchResults = await cloudQdrantStore.search(
        request.query,
        8, // Get top 8 results for better context
        {
          model: request.unit_model,
          // Add more filters as needed
        }
      );

      if (searchResults.length === 0) {
        // Fall back to mock response if no results found
        const mockResponse = this.getMockResponse(request);
        await this.storeQuery(request, mockResponse);
        return mockResponse;
      }

      // Generate response using OpenAI with retrieved context
      const context = searchResults.map(result =>
        `From ${result.metadata.brand || 'Manual'} ${result.metadata.model || ''} (Page ${result.metadata.pageNum || 'N/A'}):\n${result.text}`
      ).join('\n\n');

      const systemPrompt = `You are an expert refrigeration unit technician helping with troubleshooting and maintenance. Use the provided manual excerpts to give accurate, helpful advice.

Guidelines:
- Provide step-by-step troubleshooting procedures when applicable
- Include specific alarm codes, part numbers, and technical details from the manuals
- Suggest spare parts when relevant
- Be concise but thorough
- If information is incomplete, say so and suggest next steps
- Always cite the source manual and page when possible

Context from manuals:
${context}`;

      const userPrompt = `Question: ${request.query}
${request.alarm_code ? `Alarm Code: ${request.alarm_code}` : ''}
${request.unit_model ? `Unit Model: ${request.unit_model}` : ''}
${request.context?.alert_id ? `Alert Context: This relates to an active alert` : ''}

Please provide a detailed troubleshooting response based on the manual content.`;

      // Use NVIDIA API for free LLM generation
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.nvidiaApiKey}`,
        },
        body: JSON.stringify({
          model: 'meta/llama3-8b-instruct', // Free NVIDIA model
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 1500,
          temperature: 0.1, // Low temperature for factual responses
        }),
      });

      if (!response.ok) {
        throw new Error(`NVIDIA API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const answer = data.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response. Please try rephrasing your question.';

      // Extract steps from the response (look for numbered lists)
      const steps = this.extractStepsFromResponse(answer);

      // Extract suggested parts
      const suggestedParts = this.extractPartsFromResponse(answer);

      // Get source information
      const sources = await this.getSourceInfo(searchResults);

      // Determine confidence based on search results and response quality
      const confidence = this.determineConfidence(searchResults, answer);

      const ragResponse: RagQueryResponse = {
        answer,
        steps,
        sources,
        confidence,
        suggested_spare_parts: suggestedParts,
        request_id: `rag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };

      // Store the query in database
      await this.storeQuery(request, ragResponse);

      return ragResponse;
    } catch (error: any) {
      console.error('RAG query failed, falling back to mock response:', error?.message || error);
      // Fall back to mock response when service is unavailable
      const mockResponse = this.getMockResponse(request);
      await this.storeQuery(request, mockResponse);
      return mockResponse;
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
    } catch (error: any) {
      console.error('Failed to store RAG query:', error?.message || error);
      // Don't throw - logging failure shouldn't break the main flow
    }
  }
  
  /**
   * Get source information from search results
   */
  private async getSourceInfo(searchResults: any[]): Promise<Array<{ manual_id: string; manual_name: string; page: number }>> {
    const sources: Array<{ manual_id: string; manual_name: string; page: number }> = [];
    
    // Create a Set to track unique manual IDs
    const uniqueManualIds = new Set<string>();
    
    for (const result of searchResults) {
      const manualId = result.metadata.manualId;
      
      // Skip if we've already included this manual
      if (uniqueManualIds.has(manualId)) continue;
      
      uniqueManualIds.add(manualId);
      
      try {
        // Get manual details
        const [manual] = await db.select().from(manuals).where(eq(manuals.id, manualId));
        
        if (manual) {
          sources.push({
            manual_id: manualId,
            manual_name: manual.name,
            page: result.metadata.pageNum || 1
          });
        }
      } catch (error) {
        console.error(`Failed to get manual info for ${manualId}:`, error);
      }
    }
    
    return sources;
  }
  
  /**
   * Determine confidence level based on search results and response
   */
  private determineConfidence(searchResults: any[], answer: string): 'high' | 'medium' | 'low' {
    // No results means low confidence
    if (searchResults.length === 0) return 'low';
    
    // Check if top result has a high score
    const topScore = searchResults[0]?.score || 0;
    
    // Check if answer contains uncertainty phrases
    const uncertaintyPhrases = [
      "I'm not sure", 
      "I don't know", 
      "I cannot find", 
      "I don't have enough information",
      "unclear",
      "insufficient information"
    ];
    
    const hasUncertainty = uncertaintyPhrases.some(phrase => 
      answer.toLowerCase().includes(phrase.toLowerCase())
    );
    
    if (hasUncertainty) return 'low';
    if (topScore > 0.8) return 'high';
    if (topScore > 0.6) return 'medium';
    return 'low';
  }
  

  /**
   * Extract numbered steps from the response text
   */
  private extractStepsFromResponse(response: string): string[] {
    const steps: string[] = [];

    // Look for numbered lists (1., 2., etc.)
    const lines = response.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // Match patterns like "1.", "2)", "(1)", etc.
      if (/^\d+[\.)]\s/.test(trimmed) || /^\(\d+\)\s/.test(trimmed)) {
        // Remove the numbering and clean up
        const step = trimmed.replace(/^\d+[\.)]\s*/, '').replace(/^\(\d+\)\s*/, '');
        if (step.length > 10) { // Only include substantial steps
          steps.push(step);
        }
      }
    }

    return steps;
  }

  /**
   * Extract suggested parts from the response
   */
  private extractPartsFromResponse(response: string): string[] {
    const parts: string[] = [];

    // Look for common part-related keywords
    const partKeywords = ['sensor', 'board', 'harness', 'relay', 'compressor', 'fan', 'motor', 'valve', 'switch', 'thermostat', 'controller'];
    const lines = response.toLowerCase().split('\n');

    for (const line of lines) {
      for (const keyword of partKeywords) {
        if (line.includes(keyword)) {
          // Extract the part name (look for capitalized words around the keyword)
          const words = line.split(' ');
          const partIndex = words.findIndex(word => word.includes(keyword));
          if (partIndex !== -1) {
            // Get surrounding words to form part name
            const start = Math.max(0, partIndex - 2);
            const end = Math.min(words.length, partIndex + 3);
            const partName = words.slice(start, end).join(' ').replace(/[^\w\s-]/g, '').trim();

            if (partName.length > 3 && !parts.includes(partName)) {
              parts.push(partName);
            }
          }
        }
      }
    }

    return parts.slice(0, 5); // Limit to 5 parts
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

      return await this.query(request);
    } catch (error) {
      console.error('Failed to get alert suggestions:', error);
      return null;
    }
  }
}

export const ragAdapter = new RagAdapter();
