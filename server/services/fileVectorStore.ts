import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from '@xenova/transformers';
import { manualChunks } from '../../shared/schema';
import { db } from '../db';
import { eq } from 'drizzle-orm';

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

interface StoredChunk {
  id: string;
  vector: number[];
  text: string;
  metadata: ChunkMetadata;
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

export class FileVectorStore {
  private embeddings: FreeEmbeddings;
  private vectorsFile = path.join(process.cwd(), 'vectors.json');
  private chunks: StoredChunk[] = [];

  constructor() {
    this.embeddings = new FreeEmbeddings();
    this.loadVectors();
  }

  private loadVectors() {
    try {
      if (fs.existsSync(this.vectorsFile)) {
        const data = fs.readFileSync(this.vectorsFile, 'utf8');
        this.chunks = JSON.parse(data);
        console.log(`✅ Loaded ${this.chunks.length} vectors from file`);
      } else {
        console.log('📄 No existing vectors file found');
      }
    } catch (error) {
      console.error('❌ Error loading vectors from file:', error);
      this.chunks = [];
    }
  }

  private saveVectors() {
    try {
      fs.writeFileSync(this.vectorsFile, JSON.stringify(this.chunks, null, 2));
      console.log(`💾 Saved ${this.chunks.length} vectors to file`);
    } catch (error) {
      console.error('❌ Error saving vectors to file:', error);
    }
  }

  async initializeCollection(): Promise<void> {
    console.log('✅ File-based vector store initialized');
    console.log(`📁 Vectors stored in: ${this.vectorsFile}`);
  }

  async addChunks(chunks: Array<{ text: string; metadata: ChunkMetadata; id: string }>): Promise<void> {
    try {
      console.log(`🤖 Generating embeddings for ${chunks.length} chunks...`);

      // Generate embeddings for all chunks
      const texts = chunks.map(chunk => chunk.text);
      const embeddings = await this.embeddings.embedDocuments(texts);

      // Add to in-memory storage
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];

        // Check if chunk already exists
        const existingIndex = this.chunks.findIndex(c => c.id === chunk.id);
        if (existingIndex >= 0) {
          this.chunks[existingIndex] = {
            id: chunk.id,
            vector: embedding,
            text: chunk.text,
            metadata: chunk.metadata
          };
        } else {
          this.chunks.push({
            id: chunk.id,
            vector: embedding,
            text: chunk.text,
            metadata: chunk.metadata
          });
        }
      }

      // Save to file
      this.saveVectors();

      // Also store metadata in PostgreSQL (without vectors to save space)
      console.log('💾 Storing metadata in PostgreSQL...');
      const dbChunks = chunks.map(chunk => ({
        id: chunk.id,
        manualId: chunk.metadata.manualId,
        chunkText: chunk.text,
        chunkEmbeddingId: chunk.id,
        embedding: null, // Vectors stored in file only
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
      const batchSize = 50;
      for (let i = 0; i < dbChunks.length; i += batchSize) {
        const batch = dbChunks.slice(i, i + batchSize);
        await db.insert(manualChunks).values(batch).onConflictDoNothing();
      }

      console.log(`✅ Added ${chunks.length} chunks to file-based vector store`);
    } catch (error) {
      console.error('❌ Error adding chunks to file vector store:', error);
      throw error;
    }
  }

  async search(query: string, limit: number = 5, filter?: Partial<ChunkMetadata>): Promise<SearchResult[]> {
    try {
      if (this.chunks.length === 0) {
        console.log('⚠️ No vectors available for search');
        return [];
      }

      // Generate embedding for the query
      const queryEmbedding = await this.embeddings.embedQuery(query);

      // Calculate cosine similarity for all chunks
      const similarities = this.chunks.map(chunk => {
        const similarity = this.cosineSimilarity(queryEmbedding, chunk.vector);

        // Apply filters
        if (filter?.manualId && chunk.metadata.manualId !== filter.manualId) {
          return { ...chunk, score: -1 }; // Exclude from results
        }

        return { ...chunk, score: similarity };
      });

      // Sort by similarity and take top results
      similarities.sort((a, b) => b.score - a.score);

      return similarities
        .filter(item => item.score > 0) // Only positive similarities
        .slice(0, limit)
        .map(item => ({
          id: item.id,
          text: item.text,
          metadata: item.metadata,
          score: item.score
        }));

    } catch (error) {
      console.error('❌ Error searching file vector store:', error);
      return [];
    }
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async getStats(): Promise<{ count: number; manuals: any[] }> {
    try {
      const count = this.chunks.length;
      const manualIds = [...new Set(this.chunks.map(c => c.metadata.manualId))];

      const manuals = manualIds.map(id => ({
        id,
        name: `Manual ${id}`,
        chunksCount: this.chunks.filter(c => c.metadata.manualId === id).length
      }));

      return { count, manuals };
    } catch (error) {
      console.error('❌ Error getting file vector store stats:', error);
      return { count: 0, manuals: [] };
    }
  }

  /**
   * Get all chunks for migration to Qdrant
   */
  getAllChunks(): StoredChunk[] {
    return [...this.chunks];
  }
}

// Export singleton instance
export const fileVectorStore = new FileVectorStore();

