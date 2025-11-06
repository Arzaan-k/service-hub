import { pipeline } from '@xenova/transformers';
import OpenAI from 'openai';
import { db } from '../db';
import { manualChunks, manuals } from '../../shared/schema';
import { eq, sql, desc, cosineDistance } from 'drizzle-orm';
import { sql as sqlTemplate } from 'drizzle-orm';

// Fallback text splitter if langchain fails
class SimpleTextSplitter {
  private chunkSize: number;
  private chunkOverlap: number;

  constructor(chunkSize = 1000, chunkOverlap = 200) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  splitText(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + this.chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start = end - this.chunkOverlap;

      if (start >= text.length) break;
    }

    return chunks;
  }
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

// Free embeddings class using HuggingFace models via @xenova/transformers
class FreeEmbeddings {
  private extractor: any = null;
  private modelName = 'Xenova/all-MiniLM-L6-v2'; // Free, fast, and effective model

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
        // Convert tensor to array
        const embedding = Array.from(output.data);
        embeddings.push(embedding);
      } catch (error) {
        console.error('Error generating embedding for text:', error);
        // Return zero vector as fallback
        embeddings.push(new Array(384).fill(0)); // all-MiniLM-L6-v2 has 384 dimensions
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
      return new Array(384).fill(0); // Fallback zero vector
    }
  }
}

export class VectorStoreService {
  private embeddings: FreeEmbeddings;
  private openai: OpenAI;
  private textSplitter: any;

  constructor() {
    // Initialize OpenAI (still used for reranking)
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Initialize free embeddings
    this.embeddings = new FreeEmbeddings();

    // Initialize text splitter with dynamic import
    this.initializeTextSplitter();
  }

  private async initializeTextSplitter() {
    try {
      // Try to import langchain dynamically
      const langchainModule = await import('langchain/text_splitters');
      const RecursiveCharacterTextSplitter = langchainModule.RecursiveCharacterTextSplitter;

      this.textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000, // Characters per chunk
        chunkOverlap: 200, // Overlap between chunks
        separators: ['\n\n', '\n', '. ', ' ', ''], // Split on paragraphs, sentences, etc.
      });

      console.log('Using Langchain RecursiveCharacterTextSplitter');
    } catch (error) {
      console.log('Langchain text splitter failed, using simple splitter:', error.message);
      this.textSplitter = new SimpleTextSplitter(1000, 200);
    }
  }

  /**
   * Initialize the vector database (ensure pgvector extension)
   */
  async initializeCollection(): Promise<void> {
    try {
      // Check if pgvector extension is available and create if needed
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);
      console.log('PostgreSQL vector extension initialized successfully');
    } catch (error) {
      console.log('Vector extension may already exist or is being initialized:', error.message);
    }
  }

  /**
   * Add chunks to the PostgreSQL vector store
   */
  async addChunks(chunks: Array<{ text: string; metadata: ChunkMetadata; id: string }>): Promise<void> {
    try {
      // TEMPORARY: Skip embedding generation to avoid hanging
      console.log(`⚠️ Skipping embedding generation for ${chunks.length} chunks (temporary fix)`);

      // Prepare data for PostgreSQL insertion without embeddings
      const dbChunks = chunks.map((chunk, index) => ({
        id: chunk.id,
        manualId: chunk.metadata.manualId,
        chunkText: chunk.text,
        chunkEmbeddingId: chunk.id, // For compatibility
        embedding: null, // No embeddings for now
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

      // Insert in batches to avoid overwhelming the database
      const batchSize = 50;
      for (let i = 0; i < dbChunks.length; i += batchSize) {
        const batch = dbChunks.slice(i, i + batchSize);
        await db.insert(manualChunks).values(batch);
      }

      console.log(`✅ Added ${chunks.length} chunks to PostgreSQL vector store`);
    } catch (error) {
      console.error('❌ Error adding chunks to PostgreSQL vector store:', error);
      throw error;
    }
  }

  /**
   * Search for similar chunks using pgvector
   */
  async search(query: string, limit: number = 5, filter?: Partial<ChunkMetadata>): Promise<SearchResult[]> {
    try {
      // TEMPORARY: Fall back to text search since embeddings are disabled
      console.log(`⚠️ Using text search instead of vector search for query: "${query}"`);

      // Build the query with filters and text search
      let queryBuilder = db.select({
        id: manualChunks.id,
        text: manualChunks.chunkText,
        metadata: manualChunks.metadata,
        score: sql`1.0`.as('text_score') // Fixed score since we're doing simple text search
      })
      .from(manualChunks)
      .where(sql`chunk_text ILIKE ${`%${query}%`}`)
      .limit(limit);
      
      // Apply filters if provided
      if (filter?.model) {
        queryBuilder = queryBuilder.where(sql`metadata->>'model' = ${filter.model}`);
      }
      
      if (filter?.brand) {
        queryBuilder = queryBuilder.where(sql`metadata->>'brand' = ${filter.brand}`);
      }
      
      const results = await queryBuilder;
      
      return results.map(r => ({
        id: r.id,
        text: r.text,
        metadata: r.metadata as ChunkMetadata,
        score: r.score
      }));
    } catch (error) {
      console.error('Error searching vector store:', error);
      return [];
    }
  }
  
  /**
   * Generate embedding for a query
   */
  async generateQueryEmbedding(query: string): Promise<number[]> {
    return await this.embeddings.embedQuery(query);
  }
  
  /**
   * Search with NVIDIA API reranking for better results
   */
  async searchWithReranking(query: string, limit: number = 5, filter?: Partial<ChunkMetadata>): Promise<SearchResult[]> {
    try {
      // First get more results than needed for reranking
      const initialResults = await this.search(query, limit * 2, filter);
      
      if (initialResults.length === 0) {
        return [];
      }
      
      // If NVIDIA API key is not available, return initial results
      if (!process.env.NVIDIA_API_KEY) {
        console.log('NVIDIA API key not available, skipping reranking');
        return initialResults.slice(0, limit);
      }
      
      try {
        // Use NVIDIA API for reranking
        const response = await fetch('https://integrate.api.nvidia.com/v1/reranking', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
          },
          body: JSON.stringify({
            query: query,
            passages: initialResults.map(r => r.text),
          }),
        });
        
        if (!response.ok) {
          throw new Error(`NVIDIA API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Reorder results based on reranking scores
        const rerankedResults = [...initialResults];
        rerankedResults.sort((a, b) => {
          const aIndex = initialResults.findIndex(r => r.id === a.id);
          const bIndex = initialResults.findIndex(r => r.id === b.id);
          return data.scores[bIndex] - data.scores[aIndex];
        });
        
        return rerankedResults.slice(0, limit);
      } catch (error) {
        console.error('Reranking failed, returning initial results:', error);
        return initialResults.slice(0, limit);
      }
    } catch (error) {
      console.error('Search with reranking failed:', error);
      return [];
    }
  }
  
  async search(query: string, limit: number = 5, filter?: Partial<ChunkMetadata>): Promise<SearchResult[]> {
    try {
      const queryEmbedding = await this.generateQueryEmbedding(query);
      
      let whereConditions = [];
      if (filter?.manualId) {
        whereConditions.push(eq(manualChunks.manualId, filter.manualId));
      }

      // Use pgvector cosine similarity search
      const embeddingVector = `[${queryEmbedding.join(',')}]`;

      const results = await db
        .select({
          id: manualChunks.id,
          text: manualChunks.chunkText,
          manualId: manualChunks.manualId,
          pageNum: manualChunks.pageNum,
          startOffset: manualChunks.startOffset,
          endOffset: manualChunks.endOffset,
          metadata: manualChunks.metadata,
          similarity: sql<number>`1 - (embedding <=> ${embeddingVector}::vector)`,
        })
        .from(manualChunks)
        .where(whereConditions.length > 0 ? whereConditions[0] : undefined) // Simple filter for now
        .orderBy(desc(sql`1 - (embedding <=> ${embeddingVector}::vector)`))
        .limit(limit);

      // Format results
      const searchResults: SearchResult[] = results.map(result => ({
        id: result.id,
        text: result.text,
        score: result.similarity,
        metadata: {
          manualId: result.manualId,
          pageNum: result.pageNum || undefined,
          startOffset: result.startOffset || undefined,
          endOffset: result.endOffset || undefined,
          ...(result.metadata as any), // Spread metadata fields
        },
      }));

      return searchResults;
    } catch (error) {
      console.error('❌ Error searching PostgreSQL vector store:', error);
      return [];
    }
  }

  /**
   * Delete chunks for a specific manual
   */
  async deleteManualChunks(manualId: string): Promise<void> {
    try {
      await db.delete(manualChunks).where(eq(manualChunks.manualId, manualId));
      console.log(`✅ Deleted chunks for manual ${manualId} from PostgreSQL`);
    } catch (error) {
      console.error('❌ Error deleting manual chunks from PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Get collection statistics
   */
  async getStats(): Promise<{ count: number; manuals: string[] }> {
    try {
      // Get total count
      const countResult = await db.$count(manualChunks);
      const count = countResult || 0;

      // Get unique manual IDs
      const manualResults = await db
        .selectDistinct({ manualId: manualChunks.manualId })
        .from(manualChunks);

      const manuals = manualResults.map(result => result.manualId);

      return { count, manuals };
    } catch (error) {
      console.error('❌ Error getting PostgreSQL vector store stats:', error);
      return { count: 0, manuals: [] };
    }
  }

  /**
   * Process and chunk text content
   */
  async processText(text: string, metadata: ChunkMetadata): Promise<Array<{ text: string; metadata: ChunkMetadata; id: string }>> {
    try {
      // Use simple text splitter - more reliable than langchain
      const simpleSplitter = new SimpleTextSplitter(1000, 200);
      const chunks = simpleSplitter.splitText(text);

      // Convert to chunks with IDs and metadata
      const result = chunks.map((chunkText, index) => ({
        text: chunkText,
        metadata: {
          ...metadata,
          startOffset: index * 800, // Approximate offset calculation
          endOffset: (index + 1) * 800,
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

  /**
   * Generate embeddings for a query (used by RAG service)
   */
  async generateQueryEmbedding(query: string): Promise<number[]> {
    return await this.embeddings.embedQuery(query);
  }

  /**
   * Enhanced search with reranking (using free LLM via NVIDIA API)
   */
  async searchWithReranking(query: string, limit: number = 10, filter?: Partial<ChunkMetadata>): Promise<SearchResult[]> {
    // First, get more results than needed
    const initialResults = await this.search(query, limit * 2, filter);

    if (initialResults.length === 0) return [];

    // Use NVIDIA API to rerank results based on relevance to query
    try {
      const rerankPrompt = `Given the query: "${query}"

Rank these text chunks by their relevance to the query. Return only the indices of the top ${limit} most relevant chunks in order of relevance, separated by commas.

Text chunks:
${initialResults.map((result, index) => `${index}: ${result.text.substring(0, 200)}...`).join('\n\n')}`;

      // Use NVIDIA API instead of OpenAI
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'meta/llama3-8b-instruct', // Free NVIDIA model
          messages: [{ role: 'user', content: rerankPrompt }],
          max_tokens: 100,
          temperature: 0,
        }),
      });

      if (!response.ok) {
        throw new Error(`NVIDIA API error: ${response.status}`);
      }

      const data = await response.json();
      const rerankedIndices = data.choices[0]?.message?.content
        ?.split(',')
        .map(s => parseInt(s.trim()))
        .filter(n => !isNaN(n) && n < initialResults.length)
        .slice(0, limit) || [];

      return rerankedIndices.map(index => initialResults[index]);
    } catch (error) {
      console.error('Error reranking results:', error);
      // Fall back to original results
      return initialResults.slice(0, limit);
    }
  }
}

// Export singleton instance
export const vectorStore = new VectorStoreService();
