import { ChromaClient } from 'chromadb';
import { pipeline } from '@xenova/transformers';

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

export interface ChunkData {
  text: string;
  metadata: ChunkMetadata;
  id: string;
}

class ChromaVectorStore {
  private client: ChromaClient;
  private extractor: any = null;
  private collection: any = null;
  private collectionName = 'manual_chunks';

  constructor() {
    this.client = new ChromaClient({
      path: process.env.CHROMA_URL || 'http://localhost:8000'
    });
  }

  async initialize() {
    try {
      // Initialize embeddings model
      if (!this.extractor) {
        console.log('Initializing free embeddings model...');
        this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log('Free embeddings model loaded successfully');
      }

      // Get or create collection
      try {
        this.collection = await this.client.getCollection({ name: this.collectionName });
        console.log('Using existing ChromaDB collection');
      } catch (error) {
        console.log('Creating new ChromaDB collection...');
        this.collection = await this.client.createCollection({
          name: this.collectionName,
          metadata: { "hnsw:space": "cosine" }
        });
        console.log('ChromaDB collection created');
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize ChromaDB:', error);
      return false;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.extractor) {
      await this.initialize();
    }

    try {
      const output = await this.extractor(text, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    } catch (error) {
      console.error('Error generating embedding:', error);
      return new Array(384).fill(0);
    }
  }

  async addChunks(chunks: ChunkData[]): Promise<void> {
    if (!this.collection) {
      await this.initialize();
    }

    try {
      // Generate embeddings for all chunks
      console.log(`Generating embeddings for ${chunks.length} chunks...`);
      const texts = chunks.map(chunk => chunk.text);
      const embeddings = [];

      for (let i = 0; i < texts.length; i++) {
        const embedding = await this.generateEmbedding(texts[i]);
        embeddings.push(embedding);

        if ((i + 1) % 50 === 0) {
          console.log(`Generated embeddings for ${i + 1}/${texts.length} chunks`);
        }
      }

      // Prepare data for ChromaDB
      const ids = chunks.map(chunk => chunk.id);
      const metadatas = chunks.map(chunk => ({
        manualId: chunk.metadata.manualId,
        pageNum: chunk.metadata.pageNum || 0,
        brand: chunk.metadata.brand || 'Unknown',
        model: chunk.metadata.model || 'Unknown',
        alarmCodes: JSON.stringify(chunk.metadata.alarmCodes || []),
        partNumbers: JSON.stringify(chunk.metadata.partNumbers || [])
      }));

      // Add to ChromaDB
      await this.collection.add({
        ids: ids,
        embeddings: embeddings,
        metadatas: metadatas,
        documents: texts
      });

      console.log(`Successfully added ${chunks.length} chunks to ChromaDB`);

    } catch (error) {
      console.error('Error adding chunks to ChromaDB:', error);
      throw error;
    }
  }

  async search(query: string, limit: number = 10): Promise<SearchResult[]> {
    if (!this.collection) {
      await this.initialize();
    }

    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);

      // Search in ChromaDB
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit,
        include: ['documents', 'metadatas', 'distances']
      });

      // Format results
      const searchResults: SearchResult[] = [];
      if (results.ids && results.ids[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          const metadata = results.metadatas[0][i];
          searchResults.push({
            id: results.ids[0][i],
            text: results.documents[0][i],
            metadata: {
              manualId: metadata.manualId,
              pageNum: metadata.pageNum,
              brand: metadata.brand,
              model: metadata.model,
              alarmCodes: JSON.parse(metadata.alarmCodes || '[]'),
              partNumbers: JSON.parse(metadata.partNumbers || '[]')
            },
            score: 1 - results.distances[0][i] // Convert distance to similarity score
          });
        }
      }

      return searchResults;

    } catch (error) {
      console.error('Error searching ChromaDB:', error);
      return [];
    }
  }

  async getStats() {
    if (!this.collection) {
      await this.initialize();
    }

    try {
      const count = await this.collection.count();
      return {
        count: count,
        collection: this.collectionName,
        provider: 'chromadb'
      };
    } catch (error) {
      console.error('Error getting ChromaDB stats:', error);
      return { count: 0, collection: this.collectionName, provider: 'chromadb' };
    }
  }

  async clearAll() {
    try {
      await this.client.deleteCollection({ name: this.collectionName });
      console.log('Cleared all data from ChromaDB');
    } catch (error) {
      console.error('Error clearing ChromaDB:', error);
    }
  }
}

export const chromaVectorStore = new ChromaVectorStore();
