import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { db } from './server/db.js';
import { manuals, manualChunks } from './shared/schema.js';
import { eq, sql } from 'drizzle-orm';
import { fileVectorStore } from './server/services/fileVectorStore.js';

// Simple text splitter
class SimpleSplitter {
  splitText(text, chunkSize = 800, overlap = 150) {
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

async function rebuildKnowledgeBase() {
  console.log('🔄 REBUILDING RAG KNOWLEDGE BASE');
  console.log('Using file-based vector storage (no database limits!)');
  console.log('═'.repeat(60));

  // Initialize file vector store
  await fileVectorStore.initializeCollection();

  const allManuals = await db.select().from(manuals);
  console.log(`📚 Processing ${allManuals.length} manuals...`);

  let processed = 0;
  let totalChunks = 0;
  const startTime = Date.now();

  for (const manual of allManuals) {
    const manualId = manual.id;
    console.log(`\n🔄 Processing: ${manual.name.substring(0, 40)}...`);

    const uploadDir = path.join(process.cwd(), 'uploads', 'manuals');
    const sourceUrl = manual.sourceUrl;
    const filePath = path.isAbsolute(sourceUrl) ? sourceUrl : path.join(uploadDir, sourceUrl);

    if (!fs.existsSync(filePath)) {
      console.log(`❌ File not found: ${path.basename(filePath)}`);
      continue;
    }

    try {
      // Read and clean file
      const data = fs.readFileSync(filePath);
      let text = data.toString('utf8');

      // Clean text
      text = text.replace(/\0/g, '');
      text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      text = text.replace(/\s+/g, ' ');

      // Split into chunks
      const splitter = new SimpleSplitter();
      const chunks = splitter.splitText(text, 800, 150);
      console.log(`📊 ${text.length} chars → ${chunks.length} chunks`);

      // Convert to vector store format
      const vectorChunks = chunks.map((chunkText, index) => ({
        text: chunkText,
        metadata: {
          manualId: manualId,
          pageNum: Math.floor(index / 15) + 1,
          startOffset: index * 650,
          endOffset: (index + 1) * 650,
          brand: 'Unknown',
          model: 'Unknown',
        },
        id: `${manualId}_chunk_${index}_${Date.now()}`,
      }));

      // Add to vector store
      await fileVectorStore.addChunks(vectorChunks);

      processed++;
      totalChunks += chunks.length;

      console.log(`✅ Completed: ${chunks.length} chunks stored`);

    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('\n🎉 KNOWLEDGE BASE REBUILT!');
  console.log('═'.repeat(60));
  console.log(`✅ Processed: ${processed}/${allManuals.length} manuals`);
  console.log(`📊 Total chunks in vector store: ${totalChunks}`);
  console.log(`⏱️ Total time: ${totalTime} minutes`);
  console.log(`💾 Vectors stored in: ./vectors.json (no database limits!)`);

  // Test the system
  console.log('\n🧪 Testing RAG functionality...');
  const testResults = await fileVectorStore.search('What causes Alarm 17?', 3);
  console.log(`📝 Test query returned ${testResults.length} results`);

  console.log('\n🚀 RAG system ready with file-based vectors!');
  console.log('💡 Benefits: No database storage limits, fast local processing');
}

rebuildKnowledgeBase().catch(console.error);



