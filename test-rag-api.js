import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testRagAPI() {
  console.log('🧪 Testing RAG API endpoints...\n');

  try {
    // Test 1: Get manuals
    console.log('1. Testing GET /api/manuals');
    const manualsResponse = await fetch(`${BASE_URL}/api/manuals`, {
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });

    if (manualsResponse.ok) {
      const manuals = await manualsResponse.json();
      console.log(`✅ Manuals endpoint works - ${manuals.length} manuals found`);
      if (manuals.length > 0) {
        console.log(`   Sample: ${manuals[0].name} (${manuals[0].version})`);
      }
    } else {
      console.log(`❌ Manuals endpoint failed: ${manualsResponse.status}`);
    }

    // Test 2: RAG Query
    console.log('\n2. Testing POST /api/rag/query');
    const queryResponse = await fetch(`${BASE_URL}/api/rag/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify({
        user_id: 'test-user',
        query: 'What causes Alarm 17?',
        unit_model: 'Thermo King SL-500'
      })
    });

    if (queryResponse.ok) {
      const result = await queryResponse.json();
      console.log('✅ RAG query works');
      console.log(`   Response: ${result.answer?.substring(0, 50)}...`);
      console.log(`   Confidence: ${result.confidence}`);
      console.log(`   Steps: ${result.steps?.length || 0}`);
    } else {
      const error = await queryResponse.text();
      console.log(`❌ RAG query failed: ${queryResponse.status} - ${error}`);
    }

    // Test 3: RAG History
    console.log('\n3. Testing GET /api/rag/history');
    const historyResponse = await fetch(`${BASE_URL}/api/rag/history`, {
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });

    if (historyResponse.ok) {
      const history = await historyResponse.json();
      console.log(`✅ History endpoint works - ${history.length} queries found`);
    } else {
      console.log(`❌ History endpoint failed: ${historyResponse.status}`);
    }

  } catch (error) {
    console.error('❌ API test failed:', error.message);
  }
}

testRagAPI();






