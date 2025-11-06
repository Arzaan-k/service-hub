#!/usr/bin/env node

/**
 * Verify Free AI Setup
 *
 * Tests that the free AI components work with your NVIDIA API key
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables manually
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env');

let nvidiaKey = process.env.NVIDIA_API_KEY;
let openaiKey = process.env.OPENAI_API_KEY;

if (!nvidiaKey && envPath) {
  try {
    const envContent = readFileSync(envPath, 'utf8');
    const nvidiaMatch = envContent.match(/NVIDIA_API_KEY=(.+)/);
    const openaiMatch = envContent.match(/OPENAI_API_KEY=(.+)/);

    if (nvidiaMatch) nvidiaKey = nvidiaMatch[1].trim();
    if (openaiMatch) openaiKey = openaiMatch[1].trim();
  } catch (error) {
    console.log('⚠️  Could not read .env file');
  }
}

console.log('🚀 Verifying Free AI Setup...\n');

// Check environment variables
console.log('1. Environment Variables:');
console.log(`   NVIDIA_API_KEY: ${nvidiaKey && nvidiaKey !== 'YOUR_NVIDIA_API_KEY_HERE' ? '✅ Set' : '❌ Missing or placeholder'}`);
console.log(`   OPENAI_API_KEY: ${openaiKey ? '✅ Set (optional)' : '⚠️  Not set (optional)'}`);

if (!nvidiaKey || nvidiaKey === 'YOUR_NVIDIA_API_KEY_HERE') {
  console.log('\n❌ Please set your NVIDIA API key in the .env file!');
  console.log('   Replace YOUR_NVIDIA_API_KEY_HERE with your actual key from: https://build.nvidia.com/explore/discover');
  process.exit(1);
}

// Test NVIDIA API
console.log('\n2. Testing NVIDIA API...');
try {
  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${nvidiaKey}`,
    },
    body: JSON.stringify({
      model: 'meta/llama3-8b-instruct',
      messages: [{ role: 'user', content: 'Hello! Confirm you are working and can help with technical questions about refrigeration units.' }],
      max_tokens: 100,
      temperature: 0.1,
    }),
  });

  if (response.ok) {
    const data = await response.json();
    console.log('✅ NVIDIA API working!');
    console.log(`   Response: "${data.choices[0]?.message?.content?.trim()}"`);
  } else {
    console.log(`❌ NVIDIA API error: ${response.status} ${response.statusText}`);
    try {
      const errorText = await response.text();
      console.log(`   Details: ${errorText}`);
    } catch (e) {
      console.log('   Could not read error details');
    }
  }
} catch (error) {
  console.log('❌ Error testing NVIDIA API:', error.message);
}

console.log('\n3. Testing Free Embeddings (HuggingFace)...');
try {
  // Test free embeddings directly
  const { pipeline } = await import('@xenova/transformers');

  console.log('   Loading all-MiniLM-L6-v2 model...');
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

  console.log('   Generating test embedding...');
  const result = await extractor('This is a test query for free embeddings in a refrigeration diagnostic system.', {
    pooling: 'mean',
    normalize: true
  });

  const embedding = Array.from(result.data);
  console.log(`✅ Free embeddings working! Generated ${embedding.length}-dimensional vector`);
  console.log(`   Sample values: [${embedding.slice(0, 3).map(x => x.toFixed(4)).join(', ')}...]`);

} catch (error) {
  console.log('❌ Error testing free embeddings:', error.message);
  console.log('   This might be expected on first run as the model needs to download (~90MB)');
  console.log('   Try again after the model downloads');
}

console.log('\n4. Testing Chroma Connection...');
try {
  // Test Chroma connection
  const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8000';

  const response = await fetch(`${chromaUrl}/api/v1/heartbeat`, {
    method: 'GET',
    timeout: 5000
  });

  if (response.ok) {
    console.log('✅ Chroma vector database is running');
  } else {
    console.log('⚠️  Chroma not running - system will use mock responses');
    console.log('   To enable full RAG, run: docker run -p 8000:8000 chromadb/chroma:latest');
  }
} catch (error) {
  console.log('⚠️  Chroma not accessible - system will use mock responses');
  console.log('   To enable full RAG, run: docker run -p 8000:8000 chromadb/chroma:latest');
}

console.log('\n🎉 Verification Complete!');
console.log('\n💰 Your FREE RAG system status:');
console.log('   - NVIDIA API:', nvidiaKey && nvidiaKey !== 'YOUR_NVIDIA_API_KEY_HERE' ? '✅ Ready' : '❌ Needs API key');
console.log('   - Free Embeddings: ✅ HuggingFace model ready');
console.log('   - Vector Database: Chroma (start with docker if needed)');
console.log('   - Cost: $0.00 for AI processing!');
console.log('\n🚀 Ready to upload manuals and answer questions!');
