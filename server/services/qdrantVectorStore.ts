import { QdrantClient } from '@qdrant/js-client-rest';
import { pipeline } from '@xenova/transformers';
import { manualChunks, manuals } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db';

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

export class QdrantVectorStore {
  private qdrant: QdrantClient;
  private embeddings: FreeEmbeddings;
  private collectionName = 'manual_chunks';

  constructor() {
    const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
    this.qdrant = new QdrantClient({ url: qdrantUrl });
    this.embeddings = new FreeEmbeddings();
  }

  async initializeCollection(): Promise<void> {
    try {
      console.log('🔗 Connecting to Qdrant...');
      await this.qdrant.api('get', '/health');

      // Create collection if it doesn't exist
      try {
        await this.qdrant.getCollection(this.collectionName);
        console.log('✅ Using existing Qdrant collection');
      } catch {
        await this.qdrant.createCollection(this.collectionName, {
          vectors: {
            size: 384,
            distance: 'Cosine'
          }
        });
        console.log('✅ Created new Qdrant collection');
      }
    } catch (error) {
      console.error('❌ Qdrant initialization failed:', error);
      throw error;
    }
  }

  async addChunks(chunks: Array<{ text: string; metadata: ChunkMetadata; id: string }>): Promise<void> {
    try {
      console.log(`🤖 Generating embeddings for ${chunks.length} chunks...`);

      // Generate embeddings for all chunks
      const texts = chunks.map(chunk => chunk.text);
      const embeddings = await this.embeddings.embedDocuments(texts);

      // Prepare points for Qdrant
      const points = chunks.map((chunk, index) => ({
        id: chunk.id,
        vector: embeddings[index],
        payload: {
          manualId: chunk.metadata.manualId,
          text: chunk.text,
          pageNum: chunk.metadata.pageNum,
          startOffset: chunk.metadata.startOffset,
          endOffset: chunk.metadata.endOffset,
          metadata: {
            heading: chunk.metadata.heading,
            section: chunk.metadata.section,
            alarmCodes: chunk.metadata.alarmCodes,
            partNumbers: chunk.metadata.partNumbers,
            model: chunk.metadata.model,
            brand: chunk.metadata.brand,
          }
        }
      }));

      // Upsert to Qdrant in batches
      const batchSize = 100;
      for (let i = 0; i < points.length; i += batchSize) {
        const batch = points.slice(i, i + batchSize);
        await this.qdrant.upsert(this.collectionName, { points: batch });
      }

      // Also store in PostgreSQL for relational queries (without embeddings to save space)
      console.log('💾 Storing metadata in PostgreSQL...');
      const dbChunks = chunks.map(chunk => ({
        id: chunk.id,
        manualId: chunk.metadata.manualId,
        chunkText: chunk.text,
        chunkEmbeddingId: chunk.id,
        embedding: null, // Embeddings stored in Qdrant only
        pageNum: chunk.metadata.pageNum,
        startOffset: chunk.metadata.startOffset,
        endOffset: chunk.metadata.endOffset,
        metadata: {
          heading: chunk.metadata.heading,
          section: chunk.metadata.section,
          alarmCodes: chunk.metadata.alarmCodes,
          partNumbers: chunk.metadata.partNumbers,
          model: chunk.metadata.model,
          brand: chunk.metadata.brand,
        },
        createdAt: new Date(),
      }));

      // Insert in batches
      const insertBatchSize = 50;
      for (let i = 0; i < dbChunks.length; i += insertBatchSize) {
        const batch = dbChunks.slice(i, i + insertBatchSize);
        await db.insert(manualChunks).values(batch).onConflictDoNothing();
      }

      console.log(`✅ Added ${chunks.length} chunks to Qdrant + PostgreSQL metadata`);
    } catch (error) {
      console.error('❌ Error adding chunks to Qdrant:', error);
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
        id: hit.id,
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
      console.error('❌ Error searching Qdrant:', error);
      return [];
    }
  }

  async getStats(): Promise<{ count: number; manuals: any[] }> {
    try {
      const collection = await this.qdrant.getCollection(this.collectionName);
      const count = collection.points_count || 0;

      // Get manual statistics from PostgreSQL
      const manuals = await db.select({
        id: manuals.id,
        name: manuals.name,
        chunksCount: sql<number>`COUNT(${manualChunks.id})`
      })
      .from(manuals)
      .leftJoin(manualChunks, eq(manuals.id, manualChunks.manualId))
      .groupBy(manuals.id, manuals.name);

      return { count, manuals };
    } catch (error) {
      console.error('❌ Error getting Qdrant stats:', error);
      return { count: 0, manuals: [] };
    }
  }
}

// Export singleton instance
export const qdrantVectorStore = new QdrantVectorStore();





