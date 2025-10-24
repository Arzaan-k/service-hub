#!/usr/bin/env node

import { config } from 'dotenv';
config(); // Load environment variables from .env file

async function testWhatsAppFlow() {
  console.log('🧪 Testing WhatsApp Flow...\n');

  try {
    // Import the WhatsApp service directly
    const { handleWebhook } = await import('./server/services/whatsapp.js');

    // Test 1: Simulate client sending "hi"
    console.log('1️⃣ Testing Client "hi" Message...');
    
    const clientTestPayload = {
      object: "whatsapp_business_account",
      entry: [{
        id: "WHATSAPP_BUSINESS_ACCOUNT_ID",
        changes: [{
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "15551920556",
              phone_number_id: "737570086113833"
            },
            contacts: [{
              profile: {
                name: "Test Client"
              },
              wa_id: "917021307474" // Test client number from the code
            }],
            messages: [{
              from: "917021307474",
              id: "CLIENT_TEST_001",
              timestamp: Math.floor(Date.now() / 1000).toString(),
              text: {
                body: "hi"
              },
              type: "text"
            }]
          },
          field: "messages"
        }]
      }]
    };

    try {
      const result = await handleWebhook(clientTestPayload);
      console.log('✅ Client "hi" message processed');
      console.log('📊 Result:', result);
    } catch (error) {
      console.error('❌ Client "hi" message failed:', error.message);
    }

    // Test 2: Simulate technician sending "hi"
    console.log('\n2️⃣ Testing Technician "hi" Message...');
    
    const technicianTestPayload = {
      object: "whatsapp_business_account",
      entry: [{
        id: "WHATSAPP_BUSINESS_ACCOUNT_ID",
        changes: [{
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "15551920556",
              phone_number_id: "737570086113833"
            },
            contacts: [{
              profile: {
                name: "Test Technician"
              },
              wa_id: "917021037474" // Test technician number from the code
            }],
            messages: [{
              from: "917021037474",
              id: "TECHNICIAN_TEST_001",
              timestamp: Math.floor(Date.now() / 1000).toString(),
              text: {
                body: "hi"
              },
              type: "text"
            }]
          },
          field: "messages"
        }]
      }]
    };

    try {
      const result = await handleWebhook(technicianTestPayload);
      console.log('✅ Technician "hi" message processed');
      console.log('📊 Result:', result);
    } catch (error) {
      console.error('❌ Technician "hi" message failed:', error.message);
    }

    console.log('\n🎯 WhatsApp Flow Test Complete');

  } catch (error) {
    console.error('💥 WhatsApp flow test failed:', error);
  }
}

// Run the test
testWhatsAppFlow().then(() => {
  console.log('\n🏁 WhatsApp flow test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});