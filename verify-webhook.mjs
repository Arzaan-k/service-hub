import axios from 'axios';
import { config } from 'dotenv';

config();

const WEBHOOK_URL = 'https://service.crystalgroup.in/api/whatsapp/webhook';
const VERIFY_TOKEN = 'ab703f82d47668f0ef89a7a139d227ef';
const WABA_ID = '897376619493508';
const ACCESS_TOKEN = 'EAAMV6tsVqF4BQIeANyhUQ48CrubIv2y8zXBkgfr5BKtci5rELtrEGQupdq39MjYRCy8lUGRwZB1JyzvOc3bLOZBrRktWDzlDEA1jQlObg8gUWJTD3nQicGUooLIP3akH8yfOwffApupIUTNbR2G8pBglknZCjK14ZCsUvALSrtOh2oAhZBwGrYi2fDkTHjCYwCwZDZD';
const GRAPH_VERSION = 'v20.0';

console.log('='.repeat(80));
console.log('WhatsApp Webhook Verification Tool');
console.log('='.repeat(80));
console.log('');

async function verifyWebhook() {
    console.log('🌐 Webhook URL:', WEBHOOK_URL);
    console.log('🔑 Verify Token:', VERIFY_TOKEN);
    console.log('');

    // Test 1: Check if webhook endpoint is accessible
    console.log('📋 TEST 1: Checking webhook endpoint accessibility...');
    console.log('-'.repeat(80));
    try {
        const testUrl = `${WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=test123`;
        console.log('Testing URL:', testUrl);

        const response = await axios.get(testUrl, {
            timeout: 10000,
            validateStatus: () => true // Accept any status code
        });

        console.log('✓ Webhook endpoint is accessible');
        console.log('  Status:', response.status);
        console.log('  Response:', response.data);

        if (response.status === 200 && response.data === 'test123') {
            console.log('✅ Webhook verification endpoint is working correctly!');
        } else if (response.status === 403) {
            console.log('⚠️  Webhook returned 403 - verify token might not match');
        } else {
            console.log('⚠️  Unexpected response - check server logs');
        }
    } catch (error) {
        console.error('❌ Webhook endpoint is NOT accessible');
        console.error('  Error:', error.message);
        if (error.code === 'ENOTFOUND') {
            console.error('  → DNS resolution failed - domain might not exist');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('  → Connection refused - server might be down');
        } else if (error.code === 'ETIMEDOUT') {
            console.error('  → Connection timeout - server might be unreachable');
        }
    }
    console.log('');

    // Test 2: Check webhook subscriptions in Meta
    console.log('📋 TEST 2: Checking Meta webhook subscriptions...');
    console.log('-'.repeat(80));
    try {
        const subscriptionsResponse = await axios.get(
            `https://graph.facebook.com/${GRAPH_VERSION}/${WABA_ID}/subscribed_apps`,
            {
                headers: {
                    'Authorization': `Bearer ${ACCESS_TOKEN}`
                }
            }
        );

        const subscriptions = subscriptionsResponse.data.data || [];
        console.log(`Found ${subscriptions.length} webhook subscription(s)`);

        if (subscriptions.length > 0) {
            console.log('✅ Webhook is subscribed in Meta!');
            subscriptions.forEach((sub, index) => {
                console.log(`  ${index + 1}. App ID: ${sub.id}`);
                if (sub.subscribed_fields) {
                    console.log(`     Subscribed fields: ${sub.subscribed_fields.join(', ')}`);
                }
            });
        } else {
            console.log('❌ No webhook subscriptions found in Meta');
            console.log('');
            console.log('⚠️  ACTION REQUIRED:');
            console.log('   You need to subscribe the webhook in Meta App Dashboard:');
            console.log('   1. Go to: https://developers.facebook.com/apps');
            console.log('   2. Select your app');
            console.log('   3. Navigate to WhatsApp → Configuration');
            console.log('   4. Click "Edit" on Webhook');
            console.log('   5. Enter:');
            console.log(`      - Callback URL: ${WEBHOOK_URL}`);
            console.log(`      - Verify Token: ${VERIFY_TOKEN}`);
            console.log('   6. Click "Verify and Save"');
            console.log('   7. Subscribe to "messages" field');
        }
    } catch (error) {
        console.error('❌ Error checking subscriptions:', error.response?.data || error.message);
    }
    console.log('');

    // Test 3: Send a test webhook payload
    console.log('📋 TEST 3: Sending test webhook payload...');
    console.log('-'.repeat(80));
    try {
        const testPayload = {
            object: 'whatsapp_business_account',
            entry: [{
                id: WABA_ID,
                changes: [{
                    value: {
                        messaging_product: 'whatsapp',
                        metadata: {
                            display_phone_number: '+91 90826 74866',
                            phone_number_id: '895398020326880'
                        },
                        messages: [{
                            from: '919876543210',
                            id: 'test_message_id',
                            timestamp: Math.floor(Date.now() / 1000).toString(),
                            type: 'text',
                            text: {
                                body: 'Test message from verification script'
                            }
                        }]
                    },
                    field: 'messages'
                }]
            }]
        };

        console.log('Sending test payload to webhook...');
        const webhookResponse = await axios.post(WEBHOOK_URL, testPayload, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000,
            validateStatus: () => true
        });

        console.log('✓ Webhook received the test payload');
        console.log('  Status:', webhookResponse.status);
        console.log('  Response:', JSON.stringify(webhookResponse.data, null, 2));

        if (webhookResponse.status === 200) {
            console.log('✅ Webhook is processing messages correctly!');
        } else {
            console.log('⚠️  Webhook returned non-200 status - check server logs');
        }
    } catch (error) {
        console.error('❌ Error sending test payload:', error.message);
    }
    console.log('');

    // Summary
    console.log('='.repeat(80));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('='.repeat(80));
    console.log('');
    console.log('Next Steps:');
    console.log('1. If webhook endpoint is accessible but no subscriptions found:');
    console.log('   → Configure webhook in Meta App Dashboard');
    console.log('');
    console.log('2. If webhook is subscribed but messages not arriving:');
    console.log('   → Check server logs for incoming webhook requests');
    console.log('   → Ensure server is running and accessible');
    console.log('');
    console.log('3. Test by sending a real message:');
    console.log('   → Send "hi" to +91 90826 74866 from WhatsApp');
    console.log('   → Check server logs for webhook POST request');
    console.log('');
    console.log('4. Monitor server logs:');
    console.log('   → Look for: "📱 [WEBHOOK] POST request received"');
    console.log('   → Look for: "✅ [WEBHOOK] Processed successfully"');
    console.log('');
    console.log('='.repeat(80));
}

verifyWebhook();
