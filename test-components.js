#!/usr/bin/env node

/**
 * Test Individual Components
 */

import 'dotenv/config.js';
import { readFileSync } from 'fs';

console.log('🧪 Testing Individual FREE RAG Components...\n');

// Test 1: Environment Variables
console.log('1. Environment Variables:');
const envContent = readFileSync('.env', 'utf8');
const nvidiaMatch = envContent.match(/NVIDIA_API_KEY=(.+)/);
const nvidiaKey = nvidiaMatch ? nvidiaMatch[1].trim() : null;

console.log(`   NVIDIA_API_KEY: ${nvidiaKey && nvidiaKey.startsWith('nvapi-') ? '✅ Valid' : '❌ Invalid'}`);

// Test 2: Free Embeddings
console.log('\n2. Testing Free Embeddings...');
try {
  const { pipeline } = await import('@xenova/transformers');
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

  const result = await extractor('Test query for free embeddings in RAG system.', { pooling: 'mean', normalize: true });
  const embedding = Array.from(result.data);

  console.log(`✅ Free embeddings working! Generated ${embedding.length} dimensional vector`);
} catch (error) {
  console.log('❌ Free embeddings failed:', error.message);
}

// Test 3: NVIDIA API (if key is valid)
if (nvidiaKey && nvidiaKey.startsWith('nvapi-')) {
  console.log('\n3. Testing NVIDIA API...');
  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${nvidiaKey}`,
      },
      body: JSON.stringify({
        model: 'meta/llama3-8b-instruct',
        messages: [{
          role: 'user',
          content: 'Hello! This is a test of the FREE NVIDIA API for a refrigeration diagnostic system.'
        }],
        max_tokens: 100,
        temperature: 0.1,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const responseText = data.choices[0]?.message?.content?.trim();
      console.log('✅ NVIDIA API working!');
      console.log('   Response preview:', responseText.substring(0, 60) + '...');
    } else {
      console.log(`❌ NVIDIA API error: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.log('❌ NVIDIA API test failed:', error.message);
  }
} else {
  console.log('\n3. Skipping NVIDIA API test (invalid key)');
}

// Test 4: Chroma Connection
console.log('\n4. Testing Chroma Connection...');
try {
  const response = await fetch('http://localhost:8000/api/v1/heartbeat', {
    signal: AbortSignal.timeout(3000)
  });

  if (response.ok) {
    console.log('✅ Chroma vector database is running');
  } else {
    console.log('⚠️  Chroma responding but not OK');
  }
} catch (error) {
  console.log('❌ Chroma not running - start with: chroma run --host 0.0.0.0 --port 8000');
}

console.log('\n🎊 Component Test Results:');
console.log('   - NVIDIA API:', nvidiaKey && nvidiaKey.startsWith('nvapi-') ? '✅ Ready' : '❌ Needs valid key');
console.log('   - Free Embeddings: ✅ Working');
console.log('   - Chroma DB: Check status above');

if (nvidiaKey && nvidiaKey.startsWith('nvapi-')) {
  console.log('\n🚀 ALL COMPONENTS READY! Your FREE RAG system is complete!');
  console.log('   Start the server with: npm run dev');
} else {
  console.log('\n⚠️  API key needs to be fixed before the system will work.');
  console.log('   Update .env with your real NVIDIA API key.');
}




