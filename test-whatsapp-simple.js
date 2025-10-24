#!/usr/bin/env node

/**
 * Simple WhatsApp Integration Test Script
 * Tests WhatsApp configuration and basic functionality
 */

import('./dist/index.js').then(async (module) => {
  const { whatsappService } = module;

  async function testWhatsAppIntegration() {
    console.log('🧪 Testing WhatsApp Integration\n');

    try {
      // Test 1: Check WhatsApp Configuration
      console.log('1️⃣ Testing WhatsApp Configuration...');
      try {
        // Check if environment variables are set
        const WA_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID;
        const CLOUD_API_ACCESS_TOKEN = process.env.CLOUD_API_ACCESS_TOKEN;
        const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
        
        console.log('📱 WA_PHONE_NUMBER_ID:', WA_PHONE_NUMBER_ID ? 'SET' : 'NOT SET');
        console.log('🔑 CLOUD_API_ACCESS_TOKEN:', CLOUD_API_ACCESS_TOKEN ? 'SET' : 'NOT SET');
        console.log('🛡️ WHATSAPP_VERIFY_TOKEN:', WHATSAPP_VERIFY_TOKEN ? 'SET' : 'NOT SET');
        
        if (!WA_PHONE_NUMBER_ID || !CLOUD_API_ACCESS_TOKEN) {
          console.error('❌ WhatsApp configuration missing');
          console.log('\n📋 Please set these environment variables:');
          console.log('- WA_PHONE_NUMBER_ID');
          console.log('- CLOUD_API_ACCESS_TOKEN');
          console.log('- WHATSAPP_VERIFY_TOKEN');
          console.log('\nRun: node setup-whatsapp.js');
          return;
        }
        
        console.log('✅ WhatsApp configuration appears to be set');
      } catch (error) {
        console.error('❌ WhatsApp configuration check failed:', error.message);
        return;
      }

      // Test 2: Test Template Fetching
      console.log('\n2️⃣ Testing Template Fetching...');
      try {
        const templates = await whatsappService.getWhatsAppTemplates();
        console.log('✅ Templates fetched successfully');
        console.log(`Found ${templates.data?.length || 0} templates`);

        if (templates.data?.length > 0) {
          console.log('\n📋 Available Templates:');
          templates.data.forEach((template, index) => {
            console.log(`${index + 1}. ${template.name} (${template.status})`);
          });
        }
      } catch (error) {
        console.error('❌ Template fetching failed:', error.message);
      }

      // Test 3: Test Message Sending (optional - requires test phone number)
      console.log('\n3️⃣ Testing Message Sending...');
      const testPhone = process.env.TEST_PHONE_NUMBER;
      if (testPhone) {
        try {
          const result = await whatsappService.sendMessage(testPhone, '🧪 Test message from ContainerGenie WhatsApp integration');
          console.log('✅ Test message sent successfully');
          console.log('Message ID:', result.messages?.[0]?.id);
        } catch (error) {
          console.error('❌ Message sending failed:', error.message);
        }
      } else {
        console.log('⚠️ No TEST_PHONE_NUMBER set - skipping message sending test');
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

  return { testWhatsAppIntegration };
});