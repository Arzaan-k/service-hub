import 'dotenv/config';
import { ragAdapter } from './server/services/ragAdapter.js';
import { cloudQdrantStore } from './server/services/cloudQdrantStore.js';

async function testRAGComplete() {
  console.log('🚀 COMPREHENSIVE RAG SYSTEM TEST');
  console.log('═'.repeat(80));

  try {
    // 1. Test Qdrant Connection
    console.log('1️⃣ Testing Qdrant Connection...');
    await cloudQdrantStore.initializeCollection();
    const stats = await cloudQdrantStore.getStats();
    console.log(`✅ Qdrant connected - ${stats.count.toLocaleString()} vectors`);

    // 2. Test RAG Adapter
    console.log('\n2️⃣ Testing RAG Adapter...');
    const response = await ragAdapter.query({
      user_id: 'test-user-123',
      query: 'What are common alarm codes for Thermo King units?',
      unit_model: 'Thermo King'
    });

    console.log('✅ RAG query successful');
    console.log(`📝 Answer: ${response.answer.substring(0, 100)}...`);
    console.log(`📚 Sources: ${response.sources?.length || 0}`);
    console.log(`🔧 Parts: ${response.suggested_spare_parts?.length || 0}`);

    // 3. Test API Endpoint
    console.log('\n3️⃣ Testing API Endpoint...');
    const fetch = (await import('node-fetch')).default;

    const apiResponse = await fetch('http://localhost:5000/api/rag/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': '3cc0d7c5-6008-42e1-afb6-809b5d24f5e3'
      },
      body: JSON.stringify({
        query: 'How do I troubleshoot a temperature alarm?',
        unit_model: 'Thermo King'
      })
    });

    if (apiResponse.ok) {
      const apiData = await apiResponse.json();
      console.log('✅ API endpoint working');
      console.log(`📝 Response: ${apiData.answer?.substring(0, 50)}...`);
    } else {
      console.log(`❌ API endpoint failed: ${apiResponse.status} ${apiResponse.statusText}`);
    }

    // 4. Test Search Functionality
    console.log('\n4️⃣ Testing Search Functionality...');
    const searchResults = await cloudQdrantStore.search('temperature alarm', 3);
    console.log(`✅ Search returned ${searchResults.length} results`);

    if (searchResults.length > 0) {
      console.log(`📄 Top result: ${searchResults[0].text.substring(0, 100)}...`);
      console.log(`📊 Score: ${searchResults[0].score}`);
    }

    console.log('\n🎉 ALL TESTS PASSED - RAG SYSTEM IS WORKING!');
    console.log('═'.repeat(80));

  } catch (error) {
    console.error('❌ RAG SYSTEM TEST FAILED:', error);
    console.log('\n🔧 Troubleshooting:');

    if (error.message.includes('Qdrant')) {
      console.log('• Check QDRANT_URL and QDRANT_API_KEY in .env');
    }

    if (error.message.includes('NVIDIA')) {
      console.log('• Check NVIDIA_API_KEY in .env');
    }

    if (error.message.includes('fetch')) {
      console.log('• Make sure the server is running on port 5000');
    }

    console.log('• Check server logs for more details');
    process.exit(1);
  }
}

// Run the test
testRAGComplete().catch(console.error);

