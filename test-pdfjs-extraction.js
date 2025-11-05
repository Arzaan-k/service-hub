import fs from 'fs';
import path from 'path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { TextLayer } from 'pdfjs-dist/legacy/build/pdf.mjs';

// Set up worker
import { GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';

// Test PDF extraction with pdfjs-dist
async function testPDFJSExtraction() {
  try {
    // Get one PDF file from uploads
    const uploadsDir = path.join(process.cwd(), 'uploads', 'manuals');
    const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.pdf'));
    
    if (files.length === 0) {
      console.log('❌ No PDF files found in uploads directory');
      return;
    }
    
    const testFile = files[0];
    const filePath = path.join(uploadsDir, testFile);
    
    console.log(`🔍 Testing PDF extraction with pdfjs-dist on: ${testFile}`);
    console.log(`📁 File path: ${filePath}`);
    
    // Read file
    const dataBuffer = fs.readFileSync(filePath);
    console.log(`📊 File size: ${dataBuffer.length} bytes`);
    
    // Check if it's actually a PDF file
    const header = dataBuffer.toString('utf8', 0, 10);
    console.log(`📄 File header: ${header}`);
    
    if (!header.includes('%PDF')) {
      console.log('❌ This is not a valid PDF file');
      return;
    }
    
    // Load PDF document
    try {
      console.log('\n🔄 Loading PDF with pdfjs-dist...');
      const loadingTask = getDocument({ data: new Uint8Array(dataBuffer) });
      const pdf = await loadingTask.promise;
      
      console.log(`✅ PDF loaded successfully!`);
      console.log(`📄 PDF Info:`);
      console.log(`  Pages: ${pdf.numPages}`);
      
      // Extract text from first few pages
      let fullText = '';
      const pagesToExtract = Math.min(3, pdf.numPages);
      
      for (let pageNum = 1; pageNum <= pagesToExtract; pageNum++) {
        console.log(`\n📖 Extracting text from page ${pageNum}...`);
        
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Combine text items
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ');
        
        fullText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
        console.log(`  Page ${pageNum} extracted: ${pageText.length} characters`);
        
        if (pageNum === 1) {
          console.log(`  Sample text: ${pageText.substring(0, 200)}...`);
        }
      }
      
      console.log(`\n📝 Total extracted text: ${fullText.length} characters`);
      
      // Check if text contains readable content
      const readableChars = fullText.replace(/[^a-zA-Z0-9\s]/g, '').length;
      const totalChars = fullText.length;
      const readabilityRatio = totalChars > 0 ? readableChars / totalChars : 0;
      
      console.log(`\n📊 Text Analysis:`);
      console.log(`  Total characters: ${totalChars}`);
      console.log(`  Readable characters: ${readableChars}`);
      console.log(`  Readability ratio: ${(readabilityRatio * 100).toFixed(2)}%`);
      
      if (readabilityRatio < 0.3) {
        console.log(`⚠️  Warning: Text appears to be mostly unreadable`);
      } else {
        console.log(`✅ Text appears to be readable`);
        
        // Look for some specific terms to verify content
        const testTerms = ['Alarm', 'sensor', 'temperature', 'maintenance', 'manual', 'DAIKIN', 'LXE'];
        console.log(`\n🔍 Searching for test terms:`);
        testTerms.forEach(term => {
          const found = fullText.toLowerCase().includes(term.toLowerCase());
          console.log(`  ${term}: ${found ? '✅ Found' : '❌ Not found'}`);
        });
        
        // Count some specific patterns
        const alarmCount = (fullText.match(/alarm\s*\d+/gi) || []).length;
        const sensorCount = (fullText.match(/sensor/gi) || []).length;
        const tempCount = (fullText.match(/temperature/gi) || []).length;
        
        console.log(`\n📈 Content counts:`);
        console.log(`  Alarm codes found: ${alarmCount}`);
        console.log(`  Sensor mentions: ${sensorCount}`);
        console.log(`  Temperature mentions: ${tempCount}`);
      }
      
      // Show first 500 characters of text
      if (fullText.length > 0) {
        console.log(`\n📝 First 500 characters of extracted text:`);
        console.log(fullText.substring(0, 500));
      }
      
    } catch (pdfError) {
      console.error(`❌ PDF parsing failed:`, pdfError.message);
      console.error(`Stack trace:`, pdfError.stack);
    }
    
  } catch (error) {
    console.error('❌ Error in test:', error);
  }
}

testPDFJSExtraction();
