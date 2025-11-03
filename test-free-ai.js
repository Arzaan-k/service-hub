#!/usr/bin/env node

/**
 * Test Free AI Components
 *
 * Tests the free embeddings and NVIDIA API integration
 */

import { pipeline } from '@xenova/transformers';

console.log('🧪 Testing Free AI Components...\n');

// Test 1: Free Embeddings
console.log('1. Testing Free Embeddings (HuggingFace all-MiniLM-L6-v2)...');
try {
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  const result = await extractor('This is a test sentence for embeddings.', { pooling: 'mean', normalize: true });
  const embedding = Array.from(result.data);
  console.log(`✅ Free embeddings working! Generated ${embedding.length}-dimensional vector`);
  console.log(`   Sample values: [${embedding.slice(0, 5).map(x => x.toFixed(4)).join(', ')}...]`);
} catch (error) {
  console.log('❌ Free embeddings failed:', error.message);
}

// Test 2: NVIDIA API
console.log('\n2. Testing NVIDIA API...');
try {
  const nvidiaApiKey = process.env.NVIDIA_API_KEY;
  if (!nvidiaApiKey) {
    console.log('❌ NVIDIA_API_KEY not found in environment');
  } else {
    console.log('   Found NVIDIA API key, testing connection...');

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${nvidiaApiKey}`,
      },
      body: JSON.stringify({
        model: 'meta/llama3-8b-instruct',
        messages: [{ role: 'user', content: 'Hello, can you tell me what 2+2 equals?' }],
        max_tokens: 50,
        temperature: 0.1,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const answer = data.choices[0]?.message?.content || 'No response';
      console.log('✅ NVIDIA API working!');
      console.log(`   Response: "${answer.trim()}"`);
    } else {
      console.log(`❌ NVIDIA API error: ${response.status} ${response.statusText}`);
    }
  }
} catch (error) {
  console.log('❌ NVIDIA API test failed:', error.message);
}

console.log('\n🎯 Free AI Components Test Complete!');
console.log('\nIf both tests passed, your FREE RAG system is ready! 🚀💰');




