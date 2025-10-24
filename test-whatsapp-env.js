#!/usr/bin/env node

/**
 * WhatsApp Environment Configuration Test
 * Tests WhatsApp configuration and basic functionality
 */

async function testWhatsAppIntegration() {
  console.log('🧪 Testing WhatsApp Integration\n');

  try {
    // Test 1: Check WhatsApp Configuration
    console.log('1️⃣ Testing WhatsApp Configuration...');
    
    // Check if environment variables are set
    const WA_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID;
    const CLOUD_API_ACCESS_TOKEN = process.env.CLOUD_API_ACCESS_TOKEN;
    const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
    const WABA_ID = process.env.WABA_ID;
    
    console.log('📱 WA_PHONE_NUMBER_ID:', WA_PHONE_NUMBER_ID ? WA_PHONE_NUMBER_ID : 'NOT SET');
    console.log('🔑 CLOUD_API_ACCESS_TOKEN:', CLOUD_API_ACCESS_TOKEN ? 'SET' : 'NOT SET');
    console.log('🛡️ WHATSAPP_VERIFY_TOKEN:', WHATSAPP_VERIFY_TOKEN ? 'SET' : 'NOT SET');
    console.log('🏢 WABA_ID:', WABA_ID ? WABA_ID : 'NOT SET');
    
    if (!WA_PHONE_NUMBER_ID || !CLOUD_API_ACCESS_TOKEN) {
      console.error('❌ WhatsApp configuration missing');
      console.log('\n📋 Please set these environment variables:');
      console.log('- WA_PHONE_NUMBER_ID');
      console.log('- CLOUD_API_ACCESS_TOKEN');
      console.log('- WHATSAPP_VERIFY_TOKEN');
      console.log('- WABA_ID');
      console.log('\nRun: node setup-whatsapp.js');
      return;
    }
    
    console.log('✅ WhatsApp configuration appears to be set');

    // Test 2: Test API connectivity
    console.log('\n2️⃣ Testing API Connectivity...');
    try {
      const axios = await import('axios');
      const url = `https://graph.facebook.com/v20.0/${WA_PHONE_NUMBER_ID}?fields=whatsapp_business_account`;
      
      const response = await axios.default.get(url, {
        headers: { Authorization: `Bearer ${CLOUD_API_ACCESS_TOKEN}` }
      });
      
      console.log('✅ API connectivity test successful');
      console.log('📊 Response status:', response.status);
      
      if (response.data?.whatsapp_business_account?.id) {
        console.log('🏢 WhatsApp Business Account ID:', response.data.whatsapp_business_account.id);
      }
    } catch (error) {
      console.error('❌ API connectivity test failed:', error.message);
      if (error.response?.data) {
        console.error('📊 Error details:', error.response.data);
      }
    }

    console.log('\n🎯 WhatsApp Integration Test Complete');
    console.log('\n📋 Next Steps:');
    console.log('1. Test with real phone numbers');
    console.log('2. Set up webhook URL in Meta Business');
    console.log('3. Test client and technician flows');

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Run the test if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testWhatsAppIntegration().then(() => {
    console.log('\n🏁 WhatsApp integration test completed');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
}

export { testWhatsAppIntegration };