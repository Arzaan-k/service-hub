import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { db } from './server/db.ts';
import { manuals, manualChunks } from './shared/schema.ts';
import { eq, sql } from 'drizzle-orm';
import { documentProcessor } from './server/services/documentProcessor.ts';

class ManualReprocessor {
  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads', 'manuals');
  }

  async reprocessAllManuals() {
    console.log('🔄 Starting manual reprocessing with embeddings...\n');

    const allManuals = await db.select().from(manuals);
    console.log(`Found ${allManuals.length} manuals to process\n`);

    const results = [];

    for (const manual of allManuals) {
      console.log(`📄 Processing: ${manual.name}`);
      console.log(`   ID: ${manual.id}`);

      if (!manual.sourceUrl) {
        console.log('   ❌ Skipping - no source URL\n');
        results.push({ id: manual.id, name: manual.name, status: 'skipped', reason: 'no source URL' });
        continue;
      }

      const filePath = path.isAbsolute(manual.sourceUrl) ? manual.sourceUrl : path.join(this.uploadDir, manual.sourceUrl);

      if (!fs.existsSync(filePath)) {
        console.log(`   ❌ Skipping - file not found: ${filePath}\n`);
        results.push({ id: manual.id, name: manual.name, status: 'skipped', reason: 'file not found' });
        continue;
      }

      // Clear existing chunks for this manual
      console.log('   🧹 Clearing existing chunks...');
      await db.delete(manualChunks).where(eq(manualChunks.manualId, manual.id));

      // Process the manual with embeddings
      console.log('   🤖 Processing with AI embeddings...');
      const result = await documentProcessor.processPDFFile(filePath, manual.id);

      if (result.success) {
        console.log(`   ✅ Successfully processed: ${result.chunksCreated} chunks created`);
        console.log(`   📊 Text length: ${result.textLength} characters`);
        console.log(`   ⏱️  Processing time: ${result.processingTime}ms\n`);
      } else {
        console.log(`   ❌ Failed to process: ${result.error}\n`);
      }

      results.push({ id: manual.id, name: manual.name, status: result.success ? 'processed' : 'failed', ...result });
    }

    console.log('🎉 REPROCESSING COMPLETE');
    console.log('═'.repeat(50));
    console.log(`Total manuals: ${allManuals.length}`);
    console.log(`Successfully processed: ${results.filter(r => r.status === 'processed').length}`);
    console.log(`Skipped: ${results.filter(r => r.status === 'skipped').length}`);
    console.log(`Failed: ${results.filter(r => r.status === 'failed').length}`);
    console.log(`Total chunks created: ${results.filter(r => r.status === 'processed').reduce((sum, r) => sum + r.chunksCreated, 0)}`);

    return results;
  }
}

async function main() {
  const reprocessor = new ManualReprocessor();
  await reprocessor.reprocessAllManuals();
  process.exit(0);
}

main().catch(console.error);
