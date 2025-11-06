import fs from 'fs';
import path from 'path';

// Test PDF extraction with the correct PDFParse class
async function testPDFExtraction() {
  try {
    // Import pdf-parse with PDFParse class
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const { PDFParse } = require('pdf-parse');
    
    // Get one PDF file from uploads
    const uploadsDir = path.join(process.cwd(), 'uploads', 'manuals');
    const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.pdf'));
    
    if (files.length === 0) {
      console.log('❌ No PDF files found in uploads directory');
      return;
    }
    
    const testFile = files[0];
    const filePath = path.join(uploadsDir, testFile);
    
    console.log(`🔍 Testing PDF extraction on: ${testFile}`);
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
    
    // Try to extract text using PDFParse class
    try {
      console.log('\n🔄 Using PDFParse class...');
      // Convert Buffer to Uint8Array as required by pdf-parse
      const uint8Array = new Uint8Array(dataBuffer);
      const parser = new PDFParse(uint8Array);
      await parser.load();
      const text = parser.getText();
      const info = parser.getInfo();
      
      console.log(`✅ PDF parsing successful!`);
      console.log(`📄 PDF Info:`);
      console.log(`  Pages: ${info?.pages || 'Unknown'}`);
      console.log(`  Text length: ${text?.length || 0} characters`);
      console.log(`  Title: ${info?.Title || 'No title'}`);
      console.log(`  Author: ${info?.Author || 'No author'}`);
      
      // Show first 500 characters of text
      if (text && text.length > 0) {
        console.log(`\n📝 First 500 characters of extracted text:`);
        console.log(text.substring(0, 500));
        
        // Check if text contains readable content
        const readableChars = text.replace(/[^a-zA-Z0-9\s]/g, '').length;
        const totalChars = text.length;
        const readabilityRatio = readableChars / totalChars;
        
        console.log(`\n📊 Text Analysis:`);
        console.log(`  Total characters: ${totalChars}`);
        console.log(`  Readable characters: ${readableChars}`);
        console.log(`  Readability ratio: ${(readabilityRatio * 100).toFixed(2)}%`);
        
        if (readabilityRatio < 0.5) {
          console.log(`⚠️  Warning: Text appears to be mostly binary/corrupted`);
        } else {
          console.log(`✅ Text appears to be readable`);
          
          // Look for some specific terms to verify content
          const testTerms = ['Alarm', 'sensor', 'temperature', 'maintenance', 'manual', 'DAIKIN', 'LXE'];
          console.log(`\n🔍 Searching for test terms:`);
          testTerms.forEach(term => {
            const found = text.toLowerCase().includes(term.toLowerCase());
            console.log(`  ${term}: ${found ? '✅ Found' : '❌ Not found'}`);
          });
          
          // Count some specific patterns
          const alarmCount = (text.match(/alarm\s*\d+/gi) || []).length;
          const sensorCount = (text.match(/sensor/gi) || []).length;
          const tempCount = (text.match(/temperature/gi) || []).length;
          
          console.log(`\n📈 Content counts:`);
          console.log(`  Alarm codes found: ${alarmCount}`);
          console.log(`  Sensor mentions: ${sensorCount}`);
          console.log(`  Temperature mentions: ${tempCount}`);
        }
      } else {
        console.log(`❌ No text extracted from PDF`);
      }
      
    } catch (pdfError) {
      console.error(`❌ PDF parsing failed:`, pdfError.message);
      console.error(`Stack trace:`, pdfError.stack);
    }
    
  } catch (error) {
    console.error('❌ Error in test:', error);
  }
}

testPDFExtraction();
