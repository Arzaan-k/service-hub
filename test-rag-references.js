#!/usr/bin/env node

/**
 * Test script to verify the RAG adapter reference formatting
 */

import 'dotenv/config';
import { ragAdapter } from './server/services/ragAdapter.js';

async function testRagReferences() {
  console.log('🧪 Testing RAG Adapter Reference Formatting\n');

  try {
    // Test query
    const testRequest = {
      user_id: 'test-user',
      query: 'What is the MP4000 controller?',
      unit_model: 'MP4000'
    };

    console.log('📝 Test Query:', testRequest.query);
    console.log('🔍 Unit Model:', testRequest.unit_model);
    console.log('\n⏳ Processing...\n');

    const response = await ragAdapter.query(testRequest);

    console.log('📄 Response:');
    console.log('─'.repeat(50));
    console.log(response.answer);
    console.log('─'.repeat(50));

    console.log('\n📚 Sources:');
    response.sources?.forEach((source, index) => {
      console.log(`${index + 1}. ${source.manual_name} (Page ${source.page})`);
    });

    console.log('\n🔗 References Array:');
    response.references?.forEach((ref, index) => {
      console.log(`${index + 1}. ${ref}`);
    });

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testRagReferences();
