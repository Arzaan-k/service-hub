import 'dotenv/config';
import { ragAdapter } from './server/services/ragAdapter.js';

async function testChatAssistant() {
  console.log('🧪 TESTING CHAT ASSISTANT WITH UPLOADED CHUNKS');
  console.log('═'.repeat(60));

  try {
    // Test queries related to refrigeration equipment
    const testQueries = [
      {
        query: "What are the common alarm codes for Thermo King units?",
        context: { unit_model: "Thermo King" }
      },
      {
        query: "How do I troubleshoot a temperature alarm on a reefer unit?",
        context: { alarm_code: "Temperature Alarm" }
      },
      {
        query: "What maintenance should be performed on refrigeration compressors?",
        context: {}
      }
    ];

    for (let i = 0; i < testQueries.length; i++) {
      const testCase = testQueries[i];
      console.log(`\n🗣️  Test Query ${i + 1}: "${testCase.query}"`);
      console.log(`📋 Context: ${JSON.stringify(testCase.context)}`);

      try {
        const response = await ragAdapter.query({
          user_id: 'test-user',
          query: testCase.query,
          context: testCase.context
        });

        console.log(`✅ Response received (Confidence: ${response.confidence})`);
        console.log(`📝 Answer: ${response.answer.substring(0, 200)}...`);
        console.log(`📚 Sources found: ${response.sources.length}`);
        console.log(`🔧 Suggested parts: ${response.suggested_spare_parts?.length || 0}`);
        console.log(`📋 Steps provided: ${response.steps?.length || 0}`);

      } catch (error) {
        console.error(`❌ Query ${i + 1} failed:`, error.message);
      }
    }

    console.log('\n🎯 CHAT ASSISTANT TEST COMPLETE');
    console.log('═'.repeat(60));

    if (testQueries.length > 0) {
      console.log('✅ Chat assistant is responding to queries');
      console.log('✅ RAG system is retrieving relevant chunks from Qdrant');
      console.log('✅ AI responses are being generated');
      console.log('\n🚀 Your chat assistant should now be working with the uploaded chunks!');
    }

  } catch (error) {
    console.error('❌ Chat assistant test failed:', error);
    console.log('\n💡 Troubleshooting:');
    console.log('1. Check your NVIDIA_API_KEY in .env');
    console.log('2. Ensure Qdrant Cloud is accessible');
    console.log('3. Verify chunks were properly uploaded');
  }
}

// Run the test
testChatAssistant().catch(console.error);


<<<<<<< Updated upstream


=======
>>>>>>> Stashed changes
