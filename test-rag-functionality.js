// Test script for RAG functionality
// This script tests the RAG endpoints directly

const testRagFunctionality = async () => {
  console.log('🧪 Testing RAG functionality...\n');

  const baseUrl = 'http://localhost:5000';
  const userId = '3cc0d7c5-6008-42e1-afb6-809b5d24f5e3'; // Admin user from earlier

  try {
    // Test 1: RAG Query
    console.log('1. Testing RAG Query endpoint...');
    const queryResponse = await fetch(`${baseUrl}/api/rag/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId
      },
      body: JSON.stringify({
        user_id: userId,
        query: 'What causes Alarm 17?',
        unit_model: 'Thermo King SL-500'
      })
    });

    console.log('Query response status:', queryResponse.status);
    if (queryResponse.ok) {
      const result = await queryResponse.json();
      console.log('✅ RAG Query successful!');
      console.log('Response:', JSON.stringify(result, null, 2));
    } else {
      const error = await queryResponse.text();
      console.log('❌ RAG Query failed:', error);
    }

    // Test 2: Manuals endpoint
    console.log('\n2. Testing Manuals endpoint...');
    const manualsResponse = await fetch(`${baseUrl}/api/manuals`, {
      method: 'GET',
      headers: {
        'x-user-id': userId
      }
    });

    console.log('Manuals response status:', manualsResponse.status);
    if (manualsResponse.ok) {
      const manuals = await manualsResponse.json();
      console.log('✅ Manuals endpoint successful!');
      console.log(`Found ${manuals.length} manuals`);
    } else {
      const error = await manualsResponse.text();
      console.log('❌ Manuals endpoint failed:', error);
    }

    // Test 3: RAG History
    console.log('\n3. Testing RAG History endpoint...');
    const historyResponse = await fetch(`${baseUrl}/api/rag/history`, {
      method: 'GET',
      headers: {
        'x-user-id': userId
      }
    });

    console.log('History response status:', historyResponse.status);
    if (historyResponse.ok) {
      const history = await historyResponse.json();
      console.log('✅ RAG History successful!');
      console.log(`Found ${history.length} history items`);
    } else {
      const error = await historyResponse.text();
      console.log('❌ RAG History failed:', error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

testRagFunctionality();






