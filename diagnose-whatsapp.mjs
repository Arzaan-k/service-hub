import axios from 'axios';
import { config } from 'dotenv';

// Load environment variables
config();

// Your provided credentials
const PROVIDED_WABA_ID = '897376619493508';
const PROVIDED_PHONE_ID = '895398020326880';
const PROVIDED_ACCESS_TOKEN = 'EAAMV6tsVqF4BQIeANyhUQ48CrubIv2y8zXBkgfr5BKtci5rELtrEGQupdq39MjYRCy8lUGRwZB1JyzvOc3bLOZBrRktWDzlDEA1jQlObg8gUWJTD3nQicGUooLIP3akH8yfOwffApupIUTNbR2G8pBglknZCjK14ZCsUvALSrtOh2oAhZBwGrYi2fDkTHjCYwCwZDZD';
const PROVIDED_VERIFY_TOKEN = 'ab703f82d47668f0ef89a7a139d227ef';

// Environment variables from .env
const ENV_WABA_ID = process.env.WABA_ID;
const ENV_PHONE_ID = process.env.WA_PHONE_NUMBER_ID;
const ENV_ACCESS_TOKEN = process.env.CLOUD_API_ACCESS_TOKEN;
const ENV_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const ENV_APP_ID = process.env.META_APP_ID;
const ENV_APP_SECRET = process.env.META_APP_SECRET;
const ENV_GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v20.0';

console.log('='.repeat(80));
console.log('WhatsApp Business API Diagnostic Tool');
console.log('='.repeat(80));
console.log('');

// Step 1: Check environment variables
console.log('📋 STEP 1: Environment Variables Check');
console.log('-'.repeat(80));
console.log(`WABA_ID (env):              ${ENV_WABA_ID ? '✓ SET' : '✗ NOT SET'} ${ENV_WABA_ID ? `(${ENV_WABA_ID})` : ''}`);
console.log(`WA_PHONE_NUMBER_ID (env):   ${ENV_PHONE_ID ? '✓ SET' : '✗ NOT SET'} ${ENV_PHONE_ID ? `(${ENV_PHONE_ID})` : ''}`);
console.log(`CLOUD_API_ACCESS_TOKEN:     ${ENV_ACCESS_TOKEN ? '✓ SET' : '✗ NOT SET'} ${ENV_ACCESS_TOKEN ? `(${ENV_ACCESS_TOKEN.substring(0, 20)}...)` : ''}`);
console.log(`WHATSAPP_VERIFY_TOKEN:      ${ENV_VERIFY_TOKEN ? '✓ SET' : '✗ NOT SET'} ${ENV_VERIFY_TOKEN ? `(${ENV_VERIFY_TOKEN})` : ''}`);
console.log(`META_APP_ID:                ${ENV_APP_ID ? '✓ SET' : '✗ NOT SET'} ${ENV_APP_ID || ''}`);
console.log(`META_APP_SECRET:            ${ENV_APP_SECRET ? '✓ SET' : '✗ NOT SET'} ${ENV_APP_SECRET ? '(hidden)' : ''}`);
console.log(`META_GRAPH_API_VERSION:     ${ENV_GRAPH_VERSION}`);
console.log('');

// Step 2: Compare with provided credentials
console.log('🔍 STEP 2: Credential Comparison');
console.log('-'.repeat(80));
const wabaMatch = ENV_WABA_ID === PROVIDED_WABA_ID;
const phoneMatch = ENV_PHONE_ID === PROVIDED_PHONE_ID;
const tokenMatch = ENV_ACCESS_TOKEN === PROVIDED_ACCESS_TOKEN;
const verifyMatch = ENV_VERIFY_TOKEN === PROVIDED_VERIFY_TOKEN;

console.log(`WABA_ID matches:            ${wabaMatch ? '✓ YES' : '✗ NO'}`);
console.log(`PHONE_ID matches:           ${phoneMatch ? '✓ YES' : '✗ NO'}`);
console.log(`ACCESS_TOKEN matches:       ${tokenMatch ? '✓ YES' : '✗ NO'}`);
console.log(`VERIFY_TOKEN matches:       ${verifyMatch ? '✓ YES' : '✗ NO'}`);
console.log('');

// Use provided credentials for testing
const WABA_ID = PROVIDED_WABA_ID;
const PHONE_ID = PROVIDED_PHONE_ID;
const ACCESS_TOKEN = PROVIDED_ACCESS_TOKEN;
const GRAPH_VERSION = ENV_GRAPH_VERSION;

// Step 3: Test API Connection
console.log('🌐 STEP 3: Testing WhatsApp API Connection');
console.log('-'.repeat(80));

try {
    // Test 1: Get Phone Number Info
    console.log('Test 1: Fetching phone number details...');
    const phoneResponse = await axios.get(
        `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_ID}`,
        {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`
            },
            params: {
                fields: 'id,verified_name,display_phone_number,quality_rating,account_mode,name_status,code_verification_status'
            }
        }
    );

    console.log('✓ Phone Number Details:');
    console.log(`  - ID: ${phoneResponse.data.id}`);
    console.log(`  - Verified Name: ${phoneResponse.data.verified_name || 'N/A'}`);
    console.log(`  - Display Number: ${phoneResponse.data.display_phone_number || 'N/A'}`);
    console.log(`  - Quality Rating: ${phoneResponse.data.quality_rating || 'N/A'}`);
    console.log(`  - Account Mode: ${phoneResponse.data.account_mode || 'N/A'}`);
    console.log(`  - Name Status: ${phoneResponse.data.name_status || 'N/A'}`);
    console.log(`  - Code Verification: ${phoneResponse.data.code_verification_status || 'N/A'}`);
    console.log('');

    // Test 2: Get WABA Info
    console.log('Test 2: Fetching WABA details...');
    const wabaResponse = await axios.get(
        `https://graph.facebook.com/${GRAPH_VERSION}/${WABA_ID}`,
        {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`
            },
            params: {
                fields: 'id,name,timezone_id,message_template_namespace,account_review_status'
            }
        }
    );

    console.log('✓ WABA Details:');
    console.log(`  - ID: ${wabaResponse.data.id}`);
    console.log(`  - Name: ${wabaResponse.data.name || 'N/A'}`);
    console.log(`  - Timezone: ${wabaResponse.data.timezone_id || 'N/A'}`);
    console.log(`  - Template Namespace: ${wabaResponse.data.message_template_namespace || 'N/A'}`);
    console.log(`  - Review Status: ${wabaResponse.data.account_review_status || 'N/A'}`);
    console.log('');

    // Test 3: Get Message Templates
    console.log('Test 3: Fetching message templates...');
    const templatesResponse = await axios.get(
        `https://graph.facebook.com/${GRAPH_VERSION}/${WABA_ID}/message_templates`,
        {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`
            },
            params: {
                limit: 10
            }
        }
    );

    const templates = templatesResponse.data.data || [];
    console.log(`✓ Found ${templates.length} message templates`);
    if (templates.length > 0) {
        console.log('  Templates:');
        templates.forEach((template, index) => {
            console.log(`  ${index + 1}. ${template.name} (${template.status}) - Language: ${template.language}`);
        });
    }
    console.log('');

    // Test 4: Check webhook subscriptions
    console.log('Test 4: Checking webhook subscriptions...');
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
        console.log(`✓ Found ${subscriptions.length} webhook subscriptions`);
        if (subscriptions.length > 0) {
            subscriptions.forEach((sub, index) => {
                console.log(`  ${index + 1}. App ID: ${sub.id}`);
            });
        } else {
            console.log('  ⚠️  No webhook subscriptions found - you need to configure webhooks!');
        }
    } catch (error) {
        console.log('  ⚠️  Could not fetch webhook subscriptions (may need additional permissions)');
    }
    console.log('');

    // Summary
    console.log('='.repeat(80));
    console.log('📊 DIAGNOSTIC SUMMARY');
    console.log('='.repeat(80));
    console.log('✓ Access Token is VALID');
    console.log('✓ Phone Number ID is CORRECT');
    console.log('✓ WABA ID is CORRECT');
    console.log('✓ API connection is WORKING');
    console.log('');

    console.log('⚠️  IMPORTANT NEXT STEPS:');
    console.log('');
    console.log('1. UPDATE .env FILE:');
    console.log('   Make sure these variables are set in your .env file:');
    console.log(`   WABA_ID=${PROVIDED_WABA_ID}`);
    console.log(`   WA_PHONE_NUMBER_ID=${PROVIDED_PHONE_ID}`);
    console.log(`   CLOUD_API_ACCESS_TOKEN=${PROVIDED_ACCESS_TOKEN}`);
    console.log(`   WHATSAPP_VERIFY_TOKEN=${PROVIDED_VERIFY_TOKEN}`);
    console.log('');

    console.log('2. CONFIGURE WEBHOOK:');
    console.log('   - Go to Meta App Dashboard: https://developers.facebook.com/apps');
    console.log('   - Navigate to WhatsApp > Configuration');
    console.log('   - Set Webhook URL to: https://your-domain.com/api/whatsapp/webhook');
    console.log(`   - Set Verify Token to: ${PROVIDED_VERIFY_TOKEN}`);
    console.log('   - Subscribe to: messages, message_status');
    console.log('');

    console.log('3. TEST MESSAGE SENDING:');
    console.log('   To test sending a message, run:');
    console.log('   node test-send-message.mjs YOUR_PHONE_NUMBER');
    console.log('   (Phone number format: 919876543210)');
    console.log('');

    console.log('4. CHECK WEBHOOK LOGS:');
    console.log('   Monitor your server logs to see if incoming messages are being received');
    console.log('   Check: server/routes.ts - /api/whatsapp/webhook endpoint');
    console.log('');

} catch (error) {
    console.error('❌ ERROR:', error.response?.data || error.message);
    console.log('');

    if (error.response?.status === 401) {
        console.error('⚠️  AUTHENTICATION ERROR');
        console.error('   - Access token may be expired or invalid');
        console.error('   - Generate a new access token from Meta App Dashboard');
        console.error('   - Go to: https://developers.facebook.com/apps');
    } else if (error.response?.status === 403) {
        console.error('⚠️  PERMISSION ERROR');
        console.error('   - Access token may not have required permissions');
        console.error('   - Required permissions: whatsapp_business_messaging, whatsapp_business_management');
    } else if (error.response?.status === 404) {
        console.error('⚠️  NOT FOUND ERROR');
        console.error('   - Check if WABA_ID or PHONE_ID are correct');
        console.error(`   - WABA_ID: ${WABA_ID}`);
        console.error(`   - PHONE_ID: ${PHONE_ID}`);
    }

    console.log('');
    console.log('Full error details:');
    console.log(JSON.stringify(error.response?.data || error.message, null, 2));
}

console.log('='.repeat(80));
