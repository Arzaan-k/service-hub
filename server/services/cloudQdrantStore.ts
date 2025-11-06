import { QdrantClient } from '@qdrant/js-client-rest';
import { pipeline } from '@xenova/transformers';
import { manualChunks } from '../../shared/schema';
import { db } from '../db';
import { eq } from 'drizzle-orm';

// Generate UUID for Qdrant point IDs
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export interface ChunkMetadata {
  manualId: string;
  pageNum?: number;
  startOffset?: number;
  endOffset?: number;
  heading?: string;
  section?: string;
  alarmCodes?: string[];
  partNumbers?: string[];
  model?: string;
  brand?: string;
}

export interface SearchResult {
  id: string;
  text: string;
  metadata: ChunkMetadata;
  score: number;
}

class FreeEmbeddings {
  private extractor: any = null;
  private modelName = 'Xenova/all-MiniLM-L6-v2';

  async initialize() {
    if (!this.extractor) {
      console.log('Initializing free embeddings model...');
      this.extractor = await pipeline('feature-extraction', this.modelName);
      console.log('Free embeddings model loaded successfully');
    }
    return this.extractor;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const extractor = await this.initialize();
    const embeddings: number[][] = [];

    for (const text of texts) {
      try {
        const output = await extractor(text, { pooling: 'mean', normalize: true });
        const embedding = Array.from(output.data);
        embeddings.push(embedding);
      } catch (error) {
        console.error('Error generating embedding for text:', error);
        embeddings.push(new Array(384).fill(0));
      }
    }

    return embeddings;
  }

  async embedQuery(text: string): Promise<number[]> {
    const extractor = await this.initialize();

    try {
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    } catch (error) {
      console.error('Error generating embedding for query:', error);
      return new Array(384).fill(0);
    }
  }
}

export class CloudQdrantStore {
  private qdrant: QdrantClient;
  private embeddings: FreeEmbeddings;
  private collectionName = 'manual_chunks';

  constructor() {
    // Use cloud Qdrant
    const qdrantUrl = process.env.QDRANT_URL || 'https://7f02b3b5-b0f1-4a1c-9a6b-1c0b8f0c2f7a.us-east4-0.gcp.cloud.qdrant.io';
    const qdrantKey = process.env.QDRANT_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.64bUNfBLe8l3-nce12wzvpoA-feqxbg7uHgkgSAXC7o';

    this.qdrant = new QdrantClient({
      url: qdrantUrl,
      apiKey: qdrantKey,
      checkCompatibility: false
    });
    this.embeddings = new FreeEmbeddings();
  }

  async initializeCollection(): Promise<void> {
    try {
      console.log('🔗 Connecting to Cloud Qdrant...');

      // Test connection
      await this.qdrant.api('get', '/health');
      console.log('✅ Cloud Qdrant connection successful');

      // Create collection if it doesn't exist
      try {
        await this.qdrant.getCollection(this.collectionName);
        console.log('✅ Using existing cloud collection');
      } catch {
        await this.qdrant.createCollection(this.collectionName, {
          vectors: {
            size: 384,
            distance: 'Cosine'
          }
        });
        console.log('✅ Created new cloud collection');
      }

      console.log('🚀 Cloud Qdrant ready for vector storage!');
    } catch (error) {
      console.error('❌ Cloud Qdrant initialization failed:', error);
      console.log('💡 Check your QDRANT_URL and QDRANT_API_KEY in .env');
      throw error;
    }
  }

  async addChunks(chunks: Array<{ text: string; metadata: ChunkMetadata; id: string }>): Promise<void> {
    try {
      console.log(`🤖 Generating embeddings for ${chunks.length} chunks...`);

      // Generate embeddings for all chunks
      const texts = chunks.map(chunk => chunk.text);
      const embeddings = await this.embeddings.embedDocuments(texts);

      // Clean text to remove problematic characters for JSON encoding
      const cleanText = (text: string): string => {
        if (!text) return '';
        // Remove null bytes and control characters
        return text
          .replace(/\0/g, '')
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
          .replace(/\u0000/g, '') // Remove Unicode null
          .trim()
          .substring(0, 100000); // Limit to 100KB per chunk to avoid Qdrant payload limits
      };

      // Prepare points for Qdrant (Qdrant requires UUIDs for IDs)
      const points = chunks.map((chunk, index) => {
        const cleanedText = cleanText(chunk.text);
        
        return {
          id: generateUUID(), // Generate proper UUID for Qdrant
          vector: embeddings[index],
          payload: {
            originalId: chunk.id || '', // Keep original ID in payload
            manualId: chunk.metadata.manualId || '',
            text: cleanedText, // Use cleaned text
            pageNum: chunk.metadata.pageNum || 0,
            startOffset: chunk.metadata.startOffset || 0,
            endOffset: chunk.metadata.endOffset || 0,
            metadata: {
              heading: (chunk.metadata.heading || '').substring(0, 500),
              section: (chunk.metadata.section || '').substring(0, 500),
              alarmCodes: Array.isArray(chunk.metadata.alarmCodes) ? chunk.metadata.alarmCodes.slice(0, 50) : [],
              partNumbers: Array.isArray(chunk.metadata.partNumbers) ? chunk.metadata.partNumbers.slice(0, 50) : [],
              model: (chunk.metadata.model || '').substring(0, 200),
              brand: (chunk.metadata.brand || '').substring(0, 200),
            }
          }
        };
      });

      // Upsert to Qdrant in smaller batches with retry logic
      const batchSize = 50; // Smaller batches to avoid payload size issues
      let successfulChunks = 0;
      
      for (let i = 0; i < points.length; i += batchSize) {
        const batch = points.slice(i, i + batchSize);
        
        // Retry logic for Qdrant upsert
        let retries = 3;
        let success = false;
        
        while (retries > 0 && !success) {
          try {
            await this.qdrant.upsert(this.collectionName, { points: batch });
            success = true;
            successfulChunks += batch.length;
          } catch (error: any) {
            retries--;
            if (retries === 0) {
              // Try individual chunks if batch fails
              if (batch.length > 1) {
                console.log(`   Batch failed, trying individual chunks...`);
                for (const point of batch) {
                  try {
                    // Further clean the point data
                    const cleanedPoint = {
                      id: point.id,
                      vector: point.vector,
                      payload: {
                        ...point.payload,
                        text: point.payload.text.substring(0, 50000), // Further limit text
                      }
                    };
                    await this.qdrant.upsert(this.collectionName, { points: [cleanedPoint] });
                    successfulChunks++;
                  } catch (individualError) {
                    // Skip this chunk and continue
                    console.log(`   Skipping chunk due to error`);
                  }
                }
              }
            } else {
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }
        
        if (successfulChunks % 500 === 0 && successfulChunks > 0) {
          console.log(`   ✅ Processed ${successfulChunks}/${points.length} chunks...`);
        }
      }
      
      // Log final count
      console.log(`   ✅ Successfully stored ${successfulChunks}/${points.length} chunks in Qdrant`);

      // DO NOT store in PostgreSQL - all data is in Qdrant cloud
      // This saves massive Neon database space!
      console.log('💾 Skipping PostgreSQL storage - all data in Qdrant cloud');
      console.log(`✅ Added ${chunks.length} chunks to Cloud Qdrant ONLY (no PostgreSQL storage)`);
    } catch (error) {
      console.error('❌ Error adding chunks to Cloud Qdrant:', error);
      throw error;
    }
  }

  async search(query: string, limit: number = 5, filter?: Partial<ChunkMetadata>): Promise<SearchResult[]> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.embeddings.embedQuery(query);

      // Build filter for Qdrant
      let filterConditions: any = {};
      if (filter?.manualId) {
        filterConditions.must = [
          { key: 'manualId', match: { value: filter.manualId } }
        ];
      }

      // Search in Qdrant
      const searchResult = await this.qdrant.search(this.collectionName, {
        vector: queryEmbedding,
        limit: limit,
        filter: Object.keys(filterConditions).length > 0 ? filterConditions : undefined,
        with_payload: true,
        with_vector: false
      });

      // Convert results
      return searchResult.map(hit => ({
        id: hit.payload?.originalId || hit.id, // Use original ID from payload
        text: hit.payload?.text || '',
        metadata: {
          manualId: hit.payload?.manualId || '',
          pageNum: hit.payload?.pageNum,
          startOffset: hit.payload?.startOffset,
          endOffset: hit.payload?.endOffset,
          ...hit.payload?.metadata
        } as ChunkMetadata,
        score: hit.score || 0
      }));

    } catch (error) {
      console.error('❌ Error searching Cloud Qdrant:', error);
      return [];
    }
  }

  async getStats(): Promise<{ count: number; manuals: any[] }> {
    try {
      const collection = await this.qdrant.getCollection(this.collectionName);
      const count = collection.points_count || 0;

      // Get manual statistics from PostgreSQL
      const manuals = await db.execute(`
        SELECT
          m.id,
          m.name,
          COUNT(mc.id) as chunks_count
        FROM manuals m
        LEFT JOIN manual_chunks mc ON m.id = mc.manual_id
        GROUP BY m.id, m.name
      `);

      return {
        count,
        manuals: manuals.rows.map(row => ({
          id: row.id,
          name: row.name,
          chunksCount: parseInt(row.chunks_count)
        }))
      };
    } catch (error) {
      console.error('❌ Error getting Cloud Qdrant stats:', error);
      return { count: 0, manuals: [] };
    }
  }

  /**
   * Get all existing original IDs from Qdrant to avoid duplicates
   */
  async getExistingOriginalIds(): Promise<Set<string>> {
    try {
      const existingIds = new Set<string>();
      let offset = undefined;

      // Scroll through all points in batches to get originalIds
      console.log('🔍 Scanning Qdrant for existing chunk IDs...');

      while (true) {
        const response = await this.qdrant.scroll(this.collectionName, {
          limit: 1000,
          offset,
          with_payload: true,
          with_vector: false
        });

        if (!response.points || response.points.length === 0) {
          break;
        }

        // Extract originalIds from payloads
        for (const point of response.points) {
          if (point.payload?.originalId) {
            existingIds.add(point.payload.originalId);
          }
        }

        // Check if we have more points
        if (response.points.length < 1000) {
          break;
        }

        // Set offset for next batch
        offset = response.points[response.points.length - 1].id;

        if (existingIds.size % 10000 === 0) {
          console.log(`   📋 Found ${existingIds.size.toLocaleString()} existing IDs so far...`);
        }
      }

      console.log(`✅ Found ${existingIds.size.toLocaleString()} total existing chunk IDs in Qdrant`);
      return existingIds;

    } catch (error) {
      console.error('❌ Error getting existing original IDs from Qdrant:', error);
      return new Set<string>();
    }
  }

  /**
   * Process and chunk text content (compatible with documentProcessor)
   */
  async processText(text: string, metadata: ChunkMetadata): Promise<Array<{ text: string; metadata: ChunkMetadata; id: string }>> {
    try {
      // Simple text splitter
      const chunkSize = 1000;
      const chunkOverlap = 200;
      const chunks: string[] = [];
      let start = 0;

      while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push(text.slice(start, end));
        start = Math.max(start + chunkSize - chunkOverlap, start + 1);
      }

      // Convert to chunks with IDs and metadata
      const result = chunks.map((chunkText, index) => ({
        text: chunkText,
        metadata: {
          ...metadata,
          startOffset: index * (chunkSize - chunkOverlap),
          endOffset: (index + 1) * (chunkSize - chunkOverlap),
        },
        id: `${metadata.manualId}_chunk_${index}_${Date.now()}`,
      }));

      return result;
    } catch (error) {
      console.error('Error processing text:', error);
      // Fallback: split text manually
      const fallbackChunks = text.match(/.{1,1000}/g) || [text];
      return fallbackChunks.map((chunkText, index) => ({
        text: chunkText,
        metadata: {
          ...metadata,
          startOffset: index * 1000,
          endOffset: (index + 1) * 1000,
        },
        id: `${metadata.manualId}_chunk_${index}_${Date.now()}`,
      }));
    }
  }
}

// Export singleton instance
export const cloudQdrantStore = new CloudQdrantStore();
