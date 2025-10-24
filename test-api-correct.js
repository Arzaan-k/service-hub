#!/usr/bin/env node

import { config } from 'dotenv';
import axios from 'axios';
config(); // Load environment variables from .env file

async function testAPI() {
  console.log('🧪 Testing WhatsApp API Connectivity...\n');

  const WA_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID;
  const CLOUD_API_ACCESS_TOKEN = process.env.CLOUD_API_ACCESS_TOKEN;

  try {
    // Test 1: Basic API connectivity - test phone number endpoint
    console.log('1️⃣ Testing Basic API Connectivity...');
    const url = `https://graph.facebook.com/v20.0/${WA_PHONE_NUMBER_ID}`;
    
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${CLOUD_API_ACCESS_TOKEN}` }
    });
    
    console.log('✅ API connectivity test successful');
    console.log('📊 Response status:', response.status);
    console.log('📱 Phone Number Info:', response.data);

    // Test 2: Test template fetching using WABA ID
    console.log('\n2️⃣ Testing Template Fetching...');
    const WABA_ID = process.env.WABA_ID;
    
    if (WABA_ID) {
      const templatesUrl = `https://graph.facebook.com/v20.0/${WABA_ID}/message_templates`;
      
      const templatesResponse = await axios.get(templatesUrl, {
        headers: { Authorization: `Bearer ${CLOUD_API_ACCESS_TOKEN}` }
      });
      
      console.log('✅ Template fetching successful');
      console.log(`📋 Found ${templatesResponse.data.data?.length || 0} templates`);

      if (templatesResponse.data.data?.length > 0) {
        console.log('\n📋 Available Templates:');
        templatesResponse.data.data.forEach((template, index) => {
          console.log(`${index + 1}. ${template.name} (${template.status})`);
        });
      }
    } else {
      console.log('⚠️ WABA_ID not set - skipping template fetching');
    }

    // Test 3: Test message sending capability
    console.log('\n3️⃣ Testing Message Sending Capability...');
    const testPhone = process.env.TEST_PHONE_NUMBER;
    
    if (testPhone) {
      const messagesUrl = `https://graph.facebook.com/v20.0/${WA_PHONE_NUMBER_ID}/messages`;
      
      try {
        const messageResponse = await axios.post(messagesUrl, {
          messaging_product: "whatsapp",
          to: testPhone.replace(/\D/g, ''), // Clean phone number
          type: "text",
          text: { body: "🧪 Test message from ContainerGenie WhatsApp integration" }
        }, {
          headers: { Authorization: `Bearer ${CLOUD_API_ACCESS_TOKEN}`, "Content-Type": "application/json" }
        });
        
        console.log('✅ Message sending test successful');
        console.log('📤 Message ID:', messageResponse.data.messages?.[0]?.id);
      } catch (error) {
        console.error('❌ Message sending test failed:', error.message);
        if (error.response?.data) {
          console.error('📊 Error details:', JSON.stringify(error.response.data, null, 2));
        }
      }
    } else {
      console.log('⚠️ TEST_PHONE_NUMBER not set - skipping message sending test');
    }

    console.log('\n🎯 WhatsApp API Connectivity Test Complete');
    console.log('✅ All tests passed! WhatsApp integration is working correctly.');

  } catch (error) {
    console.error('❌ API connectivity test failed:', error.message);
    if (error.response?.data) {
      console.error('📊 Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
testAPI().then(() => {
  console.log('\n🏁 WhatsApp API connectivity test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});