import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { db } from './server/db.ts';
import { manuals, manualChunks } from './shared/schema.ts';
import { eq, sql } from 'drizzle-orm';

class RAGProcessor {
  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads', 'manuals');
  }

  // Simple text splitter for RAG
  splitText(text, chunkSize = 800, overlap = 200) {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunk = text.slice(start, end).trim();

      if (chunk.length > 50) { // Only keep meaningful chunks
        chunks.push(chunk);
      }

      start = Math.max(start + chunkSize - overlap, start + 1);

      if (start >= text.length) break;
    }

    return chunks;
  }

  // Extract basic metadata from text
  extractMetadata(text, fileName) {
    const metadata = {
      brand: 'Unknown',
      model: 'Unknown',
      alarmCodes: [],
      partNumbers: []
    };

    // Try to extract brand from filename
    const brandPatterns = {
      'ThermoKing': /thermoking/i,
      'Carrier': /carrier/i,
      'Daikin': /daikin/i,
      'Starcool': /starcool/i
    };

    for (const [brand, pattern] of Object.entries(brandPatterns)) {
      if (pattern.test(fileName) || pattern.test(text.substring(0, 1000))) {
        metadata.brand = brand;
        break;
      }
    }

    // Try to extract model from filename
    const modelMatch = fileName.match(/(MP\d+|LXE\d+|69NT\d+|SCI-\d+|SCU-\d+)/i);
    if (modelMatch) {
      metadata.model = modelMatch[1];
    }

    // Look for alarm codes in text
    const alarmMatches = text.match(/AL\d+|[A-Z]{2}\d{4}|Code\s*\d+/g);
    if (alarmMatches) {
      metadata.alarmCodes = [...new Set(alarmMatches.slice(0, 10))]; // Limit to 10
    }

    // Look for part numbers
    const partMatches = text.match(/\b\d{6,}\b|\b[A-Z]{2}\d{4,}\b/g);
    if (partMatches) {
      metadata.partNumbers = [...new Set(partMatches.slice(0, 10))]; // Limit to 10
    }

    return metadata;
  }

  async processPDFFile(filePath, manualId) {
    console.log(`🔄 Processing PDF: ${path.basename(filePath)}`);

    try {
      const stats = fs.statSync(filePath);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`📊 File size: ${fileSizeMB} MB`);

      // Read file as buffer and try to extract text
      const buffer = fs.readFileSync(filePath);
      let text = '';

      // Try to decode as UTF-8, fallback to latin1
      try {
        text = buffer.toString('utf8');
      } catch (utf8Error) {
        try {
          text = buffer.toString('latin1');
        } catch (latin1Error) {
          console.log('⚠️ Could not decode file as text, creating placeholder');
          text = `PDF Document: ${path.basename(filePath)} (${fileSizeMB} MB) - Binary content not extractable`;
        }
      }

      // Clean up text - remove excessive whitespace and control characters
      text = text
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
        .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
        .replace(/\s{3,}/g, ' ') // Max 2 consecutive spaces
        .trim();

      if (text.length < 100) {
        console.log('⚠️ Very little text extracted, creating minimal content');
        text = `Manual: ${path.basename(filePath)}\nBrand: Unknown\nModel: Unknown\nSize: ${fileSizeMB} MB\nStatus: Processed for RAG system`;
      }

      console.log(`📝 Extracted ${text.length} characters of text`);

      // Extract metadata
      const metadata = this.extractMetadata(text, path.basename(filePath));
      console.log(`🏷️ Identified: ${metadata.brand} ${metadata.model}`);

      // Split into chunks
      const textChunks = this.splitText(text, 800, 200);
      console.log(`✂️ Created ${textChunks.length} text chunks`);

      // Prepare chunks for database
      const dbChunks = textChunks.map((chunkText, index) => ({
        id: `${manualId}_chunk_${index.toString().padStart(4, '0')}`,
        manual_id: manualId,
        chunk_text: chunkText,
        chunk_embedding_id: `${manualId}_chunk_${index.toString().padStart(4, '0')}`,
        page_num: Math.floor(index / 3) + 1, // Approximate page grouping
        start_offset: index * 600,
        end_offset: (index + 1) * 600,
        metadata: {
          brand: metadata.brand,
          model: metadata.model,
          alarmCodes: metadata.alarmCodes,
          partNumbers: metadata.partNumbers,
          chunk_index: index,
          total_chunks: textChunks.length,
          processing_date: new Date().toISOString(),
          file_size_mb: fileSizeMB
        },
        created_at: new Date(),
      }));

      // Insert chunks in batches
      const batchSize = 20;
      let insertedCount = 0;

      for (let i = 0; i < dbChunks.length; i += batchSize) {
        const batch = dbChunks.slice(i, i + batchSize);

        // Use individual inserts to avoid issues
        for (const chunk of batch) {
          try {
            await db.execute(sql`
              INSERT INTO manual_chunks (id, manual_id, chunk_text, chunk_embedding_id, page_num, start_offset, end_offset, metadata, created_at)
              VALUES (${chunk.id}, ${chunk.manual_id}, ${chunk.chunk_text}, ${chunk.chunk_embedding_id}, ${chunk.page_num}, ${chunk.start_offset}, ${chunk.end_offset}, ${JSON.stringify(chunk.metadata)}, ${chunk.created_at.toISOString()})
            `);
            insertedCount++;
          } catch (insertError) {
            console.error(`❌ Failed to insert chunk ${chunk.id}:`, insertError.message);
          }
        }

        const progress = Math.round((i + batch.length) / dbChunks.length * 100);
        console.log(`📥 Inserted ${insertedCount}/${dbChunks.length} chunks (${progress}%)`);
      }

      console.log(`✅ Successfully processed ${path.basename(filePath)}: ${insertedCount} chunks created`);

      return {
        success: true,
        chunksCreated: insertedCount,
        textLength: text.length,
        fileSizeMB: fileSizeMB,
        brand: metadata.brand,
        model: metadata.model,
        processingTime: Date.now(),
      };

    } catch (error) {
      console.error('❌ Error processing PDF:', error.message);
      return {
        success: false,
        error: error.message,
        chunksCreated: 0,
      };
    }
  }

  async processAllManuals() {
    console.log('🚀 Starting comprehensive RAG processing of all manuals...\n');

    const allManuals = await db.select().from(manuals);
    console.log(`📚 Found ${allManuals.length} manuals to process\n`);

    const results = [];

    for (let i = 0; i < allManuals.length; i++) {
      const manual = allManuals[i];
      console.log(`[${i + 1}/${allManuals.length}] Processing: ${manual.name}`);

      if (!manual.sourceUrl) {
        console.log('  ⏭️ Skipping - no source URL');
        results.push({ id: manual.id, name: manual.name, status: 'skipped', reason: 'no source URL' });
        continue;
      }

      const filePath = path.isAbsolute(manual.sourceUrl) ? manual.sourceUrl : path.join(this.uploadDir, manual.sourceUrl);

      if (!fs.existsSync(filePath)) {
        console.log(`  ⏭️ Skipping - file not found: ${path.basename(filePath)}`);
        results.push({ id: manual.id, name: manual.name, status: 'skipped', reason: 'file not found' });
        continue;
      }

      // Check if already has substantial content (more than just marker)
      const existingChunks = await db.execute(sql`SELECT COUNT(*) as count FROM manual_chunks WHERE manual_id = ${manual.id}`);
      const chunkCount = parseInt(existingChunks.rows[0].count);

      if (chunkCount > 10) { // If already has meaningful chunks
        console.log(`  ⏭️ Skipping - already has ${chunkCount} chunks`);
        results.push({ id: manual.id, name: manual.name, status: 'skipped', reason: `already processed (${chunkCount} chunks)` });
        continue;
      }

      // Remove any existing marker chunks
      if (chunkCount > 0) {
        await db.execute(sql`DELETE FROM manual_chunks WHERE manual_id = ${manual.id}`);
        console.log(`  🗑️ Cleaned ${chunkCount} existing chunks`);
      }

      const result = await this.processPDFFile(filePath, manual.id);
      results.push({ id: manual.id, name: manual.name, ...result });

      console.log(''); // Empty line between manuals
    }

    console.log('🎉 RAG PROCESSING COMPLETE');
    console.log('═'.repeat(50));
    console.log(`📊 Total manuals: ${allManuals.length}`);
    console.log(`✅ Successfully processed: ${results.filter(r => r.status === 'processed' || r.success).length}`);
    console.log(`⏭️ Skipped: ${results.filter(r => r.status === 'skipped').length}`);
    console.log(`❌ Failed: ${results.filter(r => !r.success && r.status !== 'skipped').length}`);
    console.log(`📄 Total chunks created: ${results.reduce((sum, r) => sum + (r.chunksCreated || 0), 0)}`);

    return results;
  }
}

async function main() {
  const processor = new RAGProcessor();
  await processor.processAllManuals();
  process.exit(0);
}

main().catch(console.error);





<<<<<<< HEAD
=======

>>>>>>> all-ui-working
