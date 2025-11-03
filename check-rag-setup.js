#!/usr/bin/env node

/**
 * RAG System Health Check
 *
 * Checks if all components of the RAG system are properly configured and running.
 *
 * Usage:
 *   node check-rag-setup.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔍 Checking RAG System Health...\n');

let allChecksPass = true;

function check(name, condition, message) {
  if (condition) {
    console.log(`✅ ${name}: OK`);
  } else {
    console.log(`❌ ${name}: FAILED - ${message}`);
    allChecksPass = false;
  }
}

// 1. Environment variables
console.log('1. Environment Variables:');
check('NVIDIA_API_KEY', !!process.env.NVIDIA_API_KEY, 'Set NVIDIA_API_KEY in .env file (get from https://build.nvidia.com/explore/discover)');
check('OPENAI_API_KEY', !!process.env.OPENAI_API_KEY, 'Optional: Set OPENAI_API_KEY for enhanced reranking');
check('DATABASE_URL', !!process.env.DATABASE_URL, 'Set DATABASE_URL in .env file');

// 2. File system
console.log('\n2. File System:');
const uploadDir = path.join(__dirname, 'uploads', 'manuals');
check('Upload directory', fs.existsSync(uploadDir), `Create directory: ${uploadDir}`);

// 3. Dependencies
console.log('\n3. Dependencies:');
try {
  await import('pdf-parse');
  check('pdf-parse', true, '');
} catch {
  check('pdf-parse', false, 'Run: npm install pdf-parse');
}

try {
  await import('chromadb');
  check('chromadb', true, '');
} catch {
  check('chromadb', false, 'Run: npm install chromadb');
}

try {
  await import('@xenova/transformers');
  check('@xenova/transformers (free embeddings)', true, '');
} catch {
  check('@xenova/transformers (free embeddings)', false, 'Run: npm install @xenova/transformers onnxruntime-node');
}

try {
  await import('langchain');
  check('langchain', true, '');
} catch {
  check('langchain', false, 'Run: npm install langchain');
}

// 4. Services
console.log('\n4. Services:');
try {
  const { vectorStore } = await import('./server/services/vectorStore.js');
  await vectorStore.initializeCollection();
  const stats = await vectorStore.getStats();
  check('Vector Store', true, `${stats.count} chunks, ${stats.manuals.length} manuals`);
} catch (error) {
  check('Vector Store', false, `Chroma not running or connection failed: ${error.message}`);
}

try {
  const { documentProcessor } = await import('./server/services/documentProcessor.js');
  const stats = await documentProcessor.getProcessingStats();
  check('Document Processor', true, `${stats.totalFiles} files processed`);
} catch (error) {
  check('Document Processor', false, `Failed to initialize: ${error.message}`);
}

try {
  const { ragAdapter } = await import('./server/services/ragAdapter.js');
  check('RAG Adapter', true, 'Initialized successfully');
} catch (error) {
  check('RAG Adapter', false, `Failed to initialize: ${error.message}`);
}

// 5. Database
console.log('\n5. Database:');
try {
  const { db } = await import('./server/db.js');
  // Simple query to check if RAG tables exist
  await db.select().from(await import('./shared/schema.js').then(m => m.manuals)).limit(1);
  check('Database Tables', true, 'RAG tables exist');
} catch (error) {
  check('Database Tables', false, `Database connection or tables missing: ${error.message}`);
}

// Summary
console.log('\n' + '='.repeat(50));
if (allChecksPass) {
  console.log('🎉 All RAG system checks passed!');
  console.log('\n🚀 The system is ready for manual uploads and AI queries.');
  console.log('\n💡 Quick start:');
  console.log('   1. npm run dev');
  console.log('   2. Login as admin');
  console.log('   3. Go to Manuals section');
  console.log('   4. Upload a PDF service manual');
} else {
  console.log('⚠️  Some checks failed. Please resolve the issues above.');
  console.log('\n🔧 Common fixes:');
  console.log('   - Install missing dependencies: npm install');
  console.log('   - Start Chroma: docker run -p 8000:8000 chromadb/chroma:latest');
  console.log('   - Set environment variables in .env file');
  console.log('   - Run migrations if database tables are missing');
}
console.log('='.repeat(50) + '\n');
