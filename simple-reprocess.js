import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { db } from './server/db.ts';
import { manuals, manualChunks } from './shared/schema.ts';
import { eq } from 'drizzle-orm';

// Simple text splitter
class SimpleSplitter {
  splitText(text, chunkSize = 1000, overlap = 200) {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start = Math.max(start + chunkSize - overlap, start + 1);
    }

    return chunks;
  }
}

async function generateEmbedding(text) {
  // For now, just return a simple hash-based vector
  // In production, this would use HuggingFace or OpenAI embeddings
  const vector = [];
  for (let i = 0; i < 384; i++) {
    vector.push(Math.sin(text.length * i) * 0.1);
  }
  return vector;
}

async function reprocessManual(manualId) {
  console.log(`\n🔄 Reprocessing manual: ${manualId}`);

  const manual = await db.select().from(manuals).where(eq(manuals.id, manualId)).limit(1);
  if (!manual.length) {
    console.log('❌ Manual not found');
    return;
  }

  const uploadDir = path.join(process.cwd(), 'uploads', 'manuals');
  const sourceUrl = manual[0].sourceUrl;
  const filePath = path.isAbsolute(sourceUrl) ? sourceUrl : path.join(uploadDir, sourceUrl);

  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filePath}`);
    return;
  }

  console.log(`📄 Processing: ${manual[0].name}`);

  // Clear existing chunks
  await db.delete(manualChunks).where(eq(manualChunks.manualId, manualId));
  console.log('🧹 Cleared existing chunks');

  // Read file
  const data = fs.readFileSync(filePath);
  let text = data.toString('utf8');
  console.log(`📊 File size: ${(data.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📝 Raw text length: ${text.length} characters`);

  // Clean the text to remove null bytes and other problematic characters
  text = text.replace(/\0/g, ''); // Remove null bytes
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove control characters
  text = text.replace(/\s+/g, ' '); // Normalize whitespace

  console.log(`📝 Cleaned text length: ${text.length} characters`);

  // Split text into chunks
  const splitter = new SimpleSplitter();
  const chunks = splitter.splitText(text, 1000, 200);
  console.log(`✂️ Created ${chunks.length} text chunks`);

  // Generate embeddings and store chunks
  let stored = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (chunk.trim().length < 50) continue; // Skip very small chunks

      try {
        // Skip chunks that are too short or contain only whitespace
        if (chunk.trim().length < 10) continue;

        const embedding = await generateEmbedding(chunk);

        await db.insert(manualChunks).values({
          id: `${manualId}_chunk_${i}_${Date.now()}`,
          manualId: manualId,
          chunkText: chunk,
          chunkEmbeddingId: `${manualId}_chunk_${i}`,
          embedding: embedding,
          pageNum: Math.floor(i / 10) + 1, // Rough page estimate
          startOffset: i * 800,
          endOffset: (i + 1) * 800,
          metadata: {
            brand: 'Unknown',
            model: 'Unknown',
            processing_method: 'simple_reprocess'
          },
          createdAt: new Date(),
        });

        stored++;
        if (stored % 10 === 0) {
          console.log(`💾 Stored ${stored}/${chunks.length} chunks...`);
        }
      } catch (error) {
        // Skip this chunk and continue with others
        console.log(`⚠️ Skipping chunk ${i} due to error: ${error.message.substring(0, 50)}...`);
      }
  }

  console.log(`✅ Successfully stored ${stored} chunks with embeddings`);
}

async function main() {
  const manualId = process.argv[2];
  if (!manualId) {
    console.log('Usage: node simple-reprocess.js <manual_id>');
    console.log('Example: node simple-reprocess.js cc6cc475-a5fd-4f41-8500-ff6cabc5e5b6');
    process.exit(1);
  }

  await reprocessManual(manualId);
  process.exit(0);
}

main().catch(console.error);
