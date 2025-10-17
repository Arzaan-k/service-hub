#!/usr/bin/env node

/**
 * WhatsApp Integration Test Script
 *
 * This script tests the WhatsApp Business API integration including:
 * 1. Template registration
 * 2. Message sending
 * 3. Alert notifications
 * 4. Client communication
 */

import { whatsappService } from './server/services/whatsapp.ts';

async function testWhatsAppIntegration() {
  console.log('🧪 Testing WhatsApp Integration\n');

  try {
    // Test 1: Check WhatsApp Configuration
    console.log('1️⃣ Testing WhatsApp Configuration...');
    try {
      // This should throw an error if config is missing
      const { resolveWabaId } = require('./server/services/whatsapp');
      await resolveWabaId();
      console.log('✅ WhatsApp configuration appears to be set');
    } catch (error) {
      console.error('❌ WhatsApp configuration missing:', error.message);
      console.log('\n📋 Please set these environment variables:');
      console.log('- WA_PHONE_NUMBER_ID');
      console.log('- CLOUD_API_ACCESS_TOKEN');
      console.log('- WEBHOOK_VERIFICATION_TOKEN');
      console.log('\nRun: node setup-whatsapp.js');
      return;
    }

    // Test 2: Test Template Registration
    console.log('\n2️⃣ Testing Template Registration...');
    try {
      const { registerAllTemplates } = await import('./server/services/whatsapp.ts');
      const results = await registerAllTemplates();

      const successCount = results.filter(r => r.status === 'success').length;
      const errorCount = results.filter(r => r.status === 'error').length;

      console.log(`✅ Templates registered: ${successCount}/${results.length}`);
      if (errorCount > 0) {
        console.log(`❌ Failed templates: ${errorCount}`);
        results.filter(r => r.status === 'error').forEach(r => {
          console.log(`  - ${r.template}: ${r.error}`);
        });
      }
    } catch (error) {
      console.error('❌ Template registration failed:', error.message);
    }

    // Test 3: Test Message Sending
    console.log('\n3️⃣ Testing Message Sending...');
    try {
      // Send a test message to a phone number (replace with a test number)
      const testPhone = process.env.TEST_PHONE_NUMBER || '+1234567890';
      const { sendTextMessage } = await import('./server/services/whatsapp.ts');

      const result = await sendTextMessage(testPhone, '🧪 Test message from ContainerGenie WhatsApp integration');
      console.log('✅ Test message sent successfully');
      console.log('Message ID:', result.messages?.[0]?.id);
    } catch (error) {
      console.error('❌ Message sending failed:', error.message);
    }

    // Test 4: Test Template Fetching
    console.log('\n4️⃣ Testing Template Fetching...');
    try {
      const { getWhatsAppTemplates } = await import('./server/services/whatsapp.ts');
      const templates = await getWhatsAppTemplates();

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

    console.log('\n🎯 WhatsApp Integration Test Complete');
    console.log('\n📋 Next Steps:');
    console.log('1. Configure your WhatsApp credentials in .env');
    console.log('2. Test with real phone numbers');
    console.log('3. Set up webhook URL in Meta Business');

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
