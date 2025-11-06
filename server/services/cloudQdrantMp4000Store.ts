import { QdrantClient } from '@qdrant/js-client-rest';
import { FreeEmbeddings } from './cloudQdrantStore';

const COLLECTION = 'mp4000_manual_chunks';
const QDRANT_URL = process.env.QDRANT_URL || 'https://7f02b3b5-b0f1-4a1c-9a6b-1c0b8f0c2f7a.us-east4-0.gcp.cloud.qdrant.io';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.64bUNfBLe8l3-nce12wzvpoA-feqxbg7uHgkgSAXC7o';

export class Mp4000QdrantStore {
  private qdrant: QdrantClient;
  private embeddings: FreeEmbeddings;
  private collectionName = COLLECTION;

  constructor() {
    this.qdrant = new QdrantClient({ url: QDRANT_URL, apiKey: QDRANT_API_KEY });
    this.embeddings = new FreeEmbeddings();
  }

  async search(query: string, limit: number = 5) {
    const queryEmbedding = await this.embeddings.embedQuery(query);
    const searchResult = await this.qdrant.search(this.collectionName, {
      vector: queryEmbedding,
      limit,
      with_payload: true,
      with_vector: false
    });
    return searchResult.map(hit => ({
      id: hit.id,
      text: hit.payload?.text || '',
      page: hit.payload?.page,
      manual_name: hit.payload?.manual_name,
      score: hit.score || 0
    }));
  }
}

export const mp4000QdrantStore = new Mp4000QdrantStore();
