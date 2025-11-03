import 'dotenv/config';

interface SupermemoryDocumentPayload {
  content: string;
  metadata?: Record<string, any>;
}

export class SupermemoryService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.SUPERMEMORY_API_KEY || '';
    this.baseUrl = process.env.SUPERMEMORY_BASE_URL || 'https://api.supermemory.ai/v3';
    if (!this.apiKey) {
      console.warn('[Supermemory] SUPERMEMORY_API_KEY not set. Calls will fail.');
    }
  }

  async createDocument(payload: SupermemoryDocumentPayload): Promise<any> {
    const url = `${this.baseUrl}/documents`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`[Supermemory] ${res.status} ${res.statusText}: ${text}`);
    }
    return await res.json();
  }
}

export const supermemory = new SupermemoryService();





