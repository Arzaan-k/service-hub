import { DocumentProcessor } from './server/services/documentProcessor.js';
import { cloudQdrantStore } from './server/services/cloudQdrantStore.js';

async function reprocessOneManual() {
  try {
    console.log('🔄 Starting manual reprocessing with new PDF extraction...');
    
    const processor = new DocumentProcessor();
    
    // Get one PDF file from uploads
    const fs = await import('fs');
    const path = await import('path');
    
    const uploadsDir = path.join(process.cwd(), 'uploads', 'manuals');
    const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.pdf'));
    
    if (files.length === 0) {
      console.log('❌ No PDF files found in uploads directory');
      return;
    }
    
    const testFile = files[0];
    const filePath = path.join(uploadsDir, testFile);
    const manualId = 'test-reprocess-' + Date.now();
    
    console.log(`📁 Processing: ${testFile}`);
    console.log(`🔑 Manual ID: ${manualId}`);
    
    // Process the PDF with the new document processor
    const result = await processor.processPDFFile(filePath, manualId);
    
    console.log(`\n📊 Processing Results:`);
    console.log(`  Success: ${result.success}`);
    console.log(`  Chunks created: ${result.chunksCreated}`);
    console.log(`  Text length: ${result.textLength}`);
    console.log(`  Processing time: ${result.processingTime}ms`);
    
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
    
    if (result.success && result.chunksCreated > 0) {
      console.log(`\n✅ Manual processed successfully!`);
      
      // Test search to verify the chunks are readable
      console.log(`\n🔍 Testing search in processed chunks...`);
      
      const searchResults = await cloudQdrantStore.search('Alarm 17', 3);
      console.log(`Found ${searchResults.length} results for "Alarm 17":`);
      
      searchResults.forEach((result, index) => {
        const isReadable = /[a-zA-Z]{3,}/.test(result.text);
        console.log(`\nResult ${index + 1} (Score: ${result.score}):`);
        console.log(`  Readable: ${isReadable ? '✅' : '❌'}`);
        console.log(`  Manual: ${result.metadata.manualId}`);
        console.log(`  Page: ${result.metadata.pageNum}`);
        if (isReadable) {
          console.log(`  Text: ${result.text.substring(0, 200)}...`);
        }
      });
      
      // Test search for other terms
      const testTerms = ['temperature', 'sensor', 'DAIKIN'];
      
      for (const term of testTerms) {
        console.log(`\n🔍 Testing search for "${term}":`);
        const termResults = await cloudQdrantStore.search(term, 2);
        
        let readableCount = 0;
        termResults.forEach((result, index) => {
          const isReadable = /[a-zA-Z]{3,}/.test(result.text);
          if (isReadable) {
            readableCount++;
            console.log(`  ✅ Result ${index + 1}: ${result.text.substring(0, 100)}...`);
          } else {
            console.log(`  ❌ Result ${index + 1}: Binary data`);
          }
        });
        
        console.log(`  📊 ${readableCount} readable results out of ${termResults.length}`);
      }
      
    } else {
      console.log(`\n❌ Manual processing failed`);
    }
    
  } catch (error) {
    console.error('❌ Error in reprocessing:', error);
  }
}

reprocessOneManual();
