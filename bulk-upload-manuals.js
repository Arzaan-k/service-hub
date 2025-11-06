import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SERVER_URL = 'http://localhost:5000';
const MANUALS_DIR = 'C:/Users/Arzaan Ali Khan/Downloads/Reefer Manuals';
// GET YOUR AUTH TOKEN FIRST:
// 1. Start the server: npm run dev
// 2. Run: node get-admin-token.js
// 3. Copy the token and set it below:
const AUTH_TOKEN = process.env.AUTH_TOKEN || '3cc0d7c5-6008-42e1-afb6-809b5d24f5e3'; // Replace with your token

// Extract manual name from filename
function extractManualName(filename) {
  // Remove file extension and clean up the name
  const nameWithoutExt = filename.replace(/\.(pdf|PDF)$/, '');
  // Extract brand and model info
  const parts = nameWithoutExt.split(' ');
  return {
    name: nameWithoutExt,
    brand: parts[0], // First word is usually the brand
    model: parts.slice(1).join(' ') // Rest is model info
  };
}

// Upload a single manual
async function uploadManual(filePath, filename) {
  try {
    console.log(`\n=== UPLOADING: ${filename} ===`);

    const { name, brand, model } = extractManualName(filename);

    // Create form data
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath), {
      filename: filename,
      contentType: 'application/pdf'
    });
    formData.append('name', name);
    formData.append('version', '1.0');
    formData.append('meta', JSON.stringify({
      brand: brand,
      model: model,
      source: 'bulk_upload',
      original_filename: filename
    }));

    console.log('Uploading to:', `${SERVER_URL}/api/manuals/upload`);

    const response = await axios.post(`${SERVER_URL}/api/manuals/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
        'x-user-id': AUTH_TOKEN
      },
      timeout: 300000 // 5 minutes timeout for large files
    });

    console.log('✅ Upload successful:', response.data.message);
    console.log('📁 File saved to:', response.data.fileInfo?.savedPath);
    console.log('🆔 Manual ID:', response.data.id);

    return response.data;

  } catch (error) {
    console.error('❌ Upload failed for', filename, ':');
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', error.response.data);
    } else {
      console.error('  Error:', error.message);
    }
    return null;
  }
}

// Process a manual for RAG (extract text and create chunks)
async function processManualForRAG(manualData) {
  try {
    console.log(`🔄 Processing ${manualData.name} for RAG...`);

    const response = await axios.post(`${SERVER_URL}/api/manuals/${manualData.id}/process`, {}, {
      headers: {
        'x-user-id': AUTH_TOKEN
      },
      timeout: 600000 // 10 minutes for processing
    });

    console.log('✅ RAG processing completed:', response.data.message);
    return response.data;

  } catch (error) {
    console.error('❌ RAG processing failed for', manualData.name, ':');
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', error.response.data);
    } else {
      console.error('  Error:', error.message);
    }
    return null;
  }
}

// Main bulk upload function
async function bulkUploadManuals() {
  try {
    console.log('🚀 Starting bulk upload of Reefer Manuals...\n');

    // Check auth token
    if (AUTH_TOKEN === 'your-admin-token-here') {
      console.error('❌ AUTH_TOKEN not set!');
      console.log('📋 To get your auth token:');
      console.log('   1. Start server: npm run dev');
      console.log('   2. Run: node get-admin-token.js');
      console.log('   3. Copy the token and set AUTH_TOKEN in this file');
      return;
    }

    // Check if manuals directory exists
    if (!fs.existsSync(MANUALS_DIR)) {
      console.error('❌ Manuals directory not found:', MANUALS_DIR);
      return;
    }

    // Get all PDF files
    const files = fs.readdirSync(MANUALS_DIR)
      .filter(file => file.toLowerCase().endsWith('.pdf'))
      .map(file => ({
        filename: file,
        filepath: path.join(MANUALS_DIR, file),
        stats: fs.statSync(path.join(MANUALS_DIR, file))
      }))
      .sort((a, b) => a.stats.size - b.stats.size); // Upload smaller files first

    console.log(`📋 Found ${files.length} PDF files to upload:`);
    files.forEach((file, index) => {
      const sizeMB = (file.stats.size / (1024 * 1024)).toFixed(1);
      console.log(`  ${index + 1}. ${file.filename} (${sizeMB} MB)`);
    });

    console.log('\n⚠️  IMPORTANT: Make sure the server is running and you have a valid admin auth token!');
    console.log('   Set AUTH_TOKEN environment variable or edit this script.\n');

    // Process each file
    const results = {
      total: files.length,
      successful: 0,
      failed: 0,
      processed: []
    };

    for (const file of files) {
      const uploadResult = await uploadManual(file.filepath, file.filename);

      if (uploadResult) {
        results.successful++;
        results.processed.push({
          filename: file.filename,
          manualId: uploadResult.id,
          status: 'uploaded'
        });

        // Optionally process for RAG (uncomment if you want to process immediately)
        // const ragResult = await processManualForRAG(uploadResult);
        // if (ragResult) {
        //   results.processed[results.processed.length - 1].status = 'processed';
        // }

      } else {
        results.failed++;
        results.processed.push({
          filename: file.filename,
          status: 'failed'
        });
      }

      // Small delay between uploads to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Summary
    console.log('\n📊 BULK UPLOAD SUMMARY:');
    console.log(`   Total files: ${results.total}`);
    console.log(`   Successful: ${results.successful}`);
    console.log(`   Failed: ${results.failed}`);
    console.log(`   Success rate: ${((results.successful / results.total) * 100).toFixed(1)}%`);

    if (results.successful > 0) {
      console.log('\n✅ Successfully uploaded manuals:');
      results.processed
        .filter(r => r.status !== 'failed')
        .forEach(r => console.log(`   • ${r.filename} (ID: ${r.manualId})`));
    }

    if (results.failed > 0) {
      console.log('\n❌ Failed to upload:');
      results.processed
        .filter(r => r.status === 'failed')
        .forEach(r => console.log(`   • ${r.filename}`));
    }

  } catch (error) {
    console.error('💥 Bulk upload failed:', error.message);
  }
}

// Run the bulk upload
bulkUploadManuals();
