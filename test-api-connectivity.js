#!/usr/bin/env node

import { config } from 'dotenv';
import axios from 'axios';
config(); // Load environment variables from .env file

async function testAPI() {
  console.log('🧪 Testing WhatsApp API Connectivity...\n');

  const WA_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID;
  const CLOUD_API_ACCESS_TOKEN = process.env.CLOUD_API_ACCESS_TOKEN;

  try {
    // Test 1: Basic API connectivity
    console.log('1️⃣ Testing Basic API Connectivity...');
    const url = `https://graph.facebook.com/v20.0/${WA_PHONE_NUMBER_ID}?fields=whatsapp_business_account`;
    
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${CLOUD_API_ACCESS_TOKEN}` }
    });
    
    console.log('✅ API connectivity test successful');
    console.log('📊 Response status:', response.status);
    
    if (response.data?.whatsapp_business_account?.id) {
      console.log('🏢 WhatsApp Business Account ID:', response.data.whatsapp_business_account.id);
    }

    // Test 2: Test template fetching
    console.log('\n2️⃣ Testing Template Fetching...');
    const templatesUrl = `https://graph.facebook.com/v20.0/${response.data.whatsapp_business_account.id}/message_templates`;
    
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