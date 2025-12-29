import axios from 'axios';

// Your credentials
const WABA_ID = '897376619493508';
const PHONE_ID = '895398020326880';
const ACCESS_TOKEN = 'EAAMV6tsVqF4BQIeANyhUQ48CrubIv2y8zXBkgfr5BKtci5rELtrEGQupdq39MjYRCy8lUGRwZB1JyzvOc3bLOZBrRktWDzlDEA1jQlObg8gUWJTD3nQicGUooLIP3akH8yfOwffApupIUTNbR2G8pBglknZCjK14ZCsUvALSrtOh2oAhZBwGrYi2fDkTHjCYwCwZDZD';

async function checkWhatsAppStatus() {
    console.log('=== WhatsApp Business API Status Check ===\n');

    try {
        // 1. Check Phone Number Details
        console.log('1. Checking Phone Number Details...');
        const phoneResponse = await axios.get(
            `https://graph.facebook.com/v18.0/${PHONE_ID}`,
            {
                headers: {
                    'Authorization': `Bearer ${ACCESS_TOKEN}`
                },
                params: {
                    fields: 'id,verified_name,display_phone_number,quality_rating,account_mode'
                }
            }
        );
        console.log('Phone Details:', JSON.stringify(phoneResponse.data, null, 2));
        console.log('✓ Phone number is accessible\n');

        // 2. Check WABA Details
        console.log('2. Checking WhatsApp Business Account Details...');
        const wabaResponse = await axios.get(
            `https://graph.facebook.com/v18.0/${WABA_ID}`,
            {
                headers: {
                    'Authorization': `Bearer ${ACCESS_TOKEN}`
                },
                params: {
                    fields: 'id,name,timezone_id,message_template_namespace'
                }
            }
        );
        console.log('WABA Details:', JSON.stringify(wabaResponse.data, null, 2));
        console.log('✓ WABA is accessible\n');

        // 3. Check Message Templates
        console.log('3. Checking Available Message Templates...');
        const templatesResponse = await axios.get(
            `https://graph.facebook.com/v18.0/${WABA_ID}/message_templates`,
            {
                headers: {
                    'Authorization': `Bearer ${ACCESS_TOKEN}`
                },
                params: {
                    limit: 10
                }
            }
        );
        console.log('Templates:', JSON.stringify(templatesResponse.data, null, 2));
        console.log(`✓ Found ${templatesResponse.data.data?.length || 0} templates\n`);

        // 4. Test Sending a Message (you'll need to replace with your test number)
        console.log('4. Testing Message Send Capability...');
        console.log('⚠️  To test sending, uncomment the code below and add your test phone number\n');

        /*
        const testPhoneNumber = 'YOUR_TEST_PHONE_NUMBER'; // Format: 919876543210
        const sendResponse = await axios.post(
          `https://graph.facebook.com/v18.0/${PHONE_ID}/messages`,
          {
            messaging_product: 'whatsapp',
            to: testPhoneNumber,
            type: 'text',
            text: {
              body: 'Test message from WhatsApp Business API'
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${ACCESS_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log('Send Response:', JSON.stringify(sendResponse.data, null, 2));
        console.log('✓ Message sent successfully\n');
        */

        // 5. Check Webhook Configuration
        console.log('5. Webhook Configuration:');
        console.log('Note: Webhook settings must be configured in Meta App Dashboard');
        console.log('Verify Token:', 'ab703f82d47668f0ef89a7a139d227ef');
        console.log('Make sure your webhook URL is publicly accessible and verified\n');

        console.log('=== Summary ===');
        console.log('✓ Access Token is valid');
        console.log('✓ Phone ID is accessible');
        console.log('✓ WABA ID is accessible');
        console.log('\nNext Steps:');
        console.log('1. Verify webhook is configured in Meta App Dashboard');
        console.log('2. Ensure webhook URL is publicly accessible');
        console.log('3. Test sending a message by uncommenting the send code above');
        console.log('4. Check webhook logs to see if messages are being received');

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);

        if (error.response?.status === 401) {
            console.error('\n⚠️  Authentication Error: Access token may be expired or invalid');
        } else if (error.response?.status === 403) {
            console.error('\n⚠️  Permission Error: Check if the access token has required permissions');
        } else if (error.response?.status === 404) {
            console.error('\n⚠️  Not Found: Check if WABA_ID or PHONE_ID are correct');
        }
    }
}

// Run the check
checkWhatsAppStatus();
