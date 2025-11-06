import fs from 'fs';
import path from 'path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { QdrantClient } from '@qdrant/js-client-rest';
import { FreeEmbeddings } from './server/services/cloudQdrantStore.js';

GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';

const QDRANT_URL = process.env.QDRANT_URL || 'https://7f02b3b5-b0f1-4a1c-9a6b-1c0b8f0c2f7a.us-east4-0.gcp.cloud.qdrant.io';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.64bUNfBLe8l3-nce12wzvpoA-feqxbg7uHgkgSAXC7o';
const COLLECTION = 'mp4000_manual_chunks';

const manualPath = path.join(process.cwd(), 'uploads', 'manuals', '0df5ac39-2078-4412-b2b7-f51e201bf3f5_1761817147967_ThermoKing Mp4000 TK-61110-4-OP.pdf');

async function main() {
  console.log('🔄 Chunking and uploading ThermoKing Mp4000 manual to collection:', COLLECTION);
  const dataBuffer = fs.readFileSync(manualPath);
  const loadingTask = getDocument({ data: new Uint8Array(dataBuffer) });
  const pdf = await loadingTask.promise;
  console.log(`✅ PDF loaded: ${pdf.numPages} pages`);

  // Extract text from all pages
  const pageTexts = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    pageTexts.push(pageText);
  }
  const fullText = pageTexts.join('\n\n--- PAGE BREAK ---\n\n');
  console.log(`Extracted ${fullText.length} characters of text.`);

  // Chunking
  const chunkSize = 1200;
  const overlap = 200;
  const chunks = [];
  let start = 0;
  while (start < fullText.length) {
    const end = Math.min(fullText.length, start + chunkSize);
    const chunkText = fullText.slice(start, end);
    chunks.push(chunkText);
    start += chunkSize - overlap;
  }
  console.log(`Created ${chunks.length} chunks.`);

  // Embedding and upload
  const embeddings = new FreeEmbeddings();
  const qdrant = new QdrantClient({ url: QDRANT_URL, apiKey: QDRANT_API_KEY, timeout: 60000 });

  // Ensure collection exists
  try {
    await qdrant.getCollection(COLLECTION);
    console.log('Collection exists.');
  } catch {
    await qdrant.createCollection(COLLECTION, { vectors: { size: 384, distance: 'Cosine', on_disk: true } });
    console.log('Created new collection:', COLLECTION);
  }

  // Upload chunks
  for (let i = 0; i < chunks.length; i++) {
    const text = chunks[i];
    const vector = await embeddings.embedQuery(text);
    await qdrant.upsert(COLLECTION, {
      points: [{
        id: crypto.randomUUID(),
        vector,
        payload: {
          page: Math.floor(i / 3) + 1,
          manual_name: 'ThermoKing Mp4000 TK-61110-4-OP',
          chunk_index: i,
          text,
        },
      }],
    });
    if (i % 20 === 0) console.log(`Uploaded chunk ${i + 1}/${chunks.length}`);
  }
  console.log('✅ All chunks uploaded to Qdrant collection:', COLLECTION);
}

main().catch(e => { console.error(e); process.exit(1); });
