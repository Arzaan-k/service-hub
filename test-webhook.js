#!/usr/bin/env node

import { config } from 'dotenv';
import axios from 'axios';
config(); // Load environment variables from .env file

async function testWebhook() {
  console.log('🧪 Testing WhatsApp Webhook Configuration...\n');

  const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
  const webhookUrl = 'https://a50a6eab66a9.ngrok-free.app/api/whatsapp/webhook';

  try {
    // Test 1: Webhook verification endpoint
    console.log('1️⃣ Testing Webhook Verification Endpoint...');
    
    const verificationUrl = `${webhookUrl}?hub.mode=subscribe&hub.verify_token=${WHATSAPP_VERIFY_TOKEN}&hub.challenge=test123`;
    
    try {
      const response = await axios.get(verificationUrl);
      console.log('✅ Webhook verification endpoint accessible');
      console.log('📊 Response status:', response.status);
      console.log('📊 Response data:', response.data);
    } catch (error) {
      console.error('❌ Webhook verification endpoint test failed:', error.message);
      if (error.response?.status === 403) {
        console.error('🔒 Access forbidden - check webhook token');
      }
    }

    // Test 2: Test webhook POST endpoint
    console.log('\n2️⃣ Testing Webhook POST Endpoint...');
    
    const testWebhookPayload = {
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
                name: "Test User"
              },
              wa_id: "1234567890"
            }],
            messages: [{
              from: "1234567890",
              id: "ABGGFlA5FpafZgo1K",
              timestamp: "1504902988",
              text: {
                body: "Hello, this is a test message"
              },
              type: "text"
            }]
          },
          field: "messages"
        }]
      }]
    };

    try {
      const response = await axios.post(webhookUrl, testWebhookPayload, {
        headers: { "Content-Type": "application/json" }
      });
      
      console.log('✅ Webhook POST endpoint accessible');
      console.log('📊 Response status:', response.status);
      console.log('📊 Response data:', response.data);
    } catch (error) {
      console.error('❌ Webhook POST endpoint test failed:', error.message);
      if (error.response) {
        console.error('📊 Response status:', error.response.status);
        console.error('📊 Response data:', error.response.data);
      }
    }

    console.log('\n🎯 WhatsApp Webhook Test Complete');

  } catch (error) {
    console.error('💥 Webhook test failed:', error);
  }
}

// Run the test
testWebhook().then(() => {
  console.log('\n🏁 WhatsApp webhook test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});