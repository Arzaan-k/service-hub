import axios from 'axios';
import { config } from 'dotenv';

config();

const PHONE_ID = '895398020326880';
const ACCESS_TOKEN = 'EAAMV6tsVqF4BQIeANyhUQ48CrubIv2y8zXBkgfr5BKtci5rELtrEGQupdq39MjYRCy8lUGRwZB1JyzvOc3bLOZBrRktWDzlDEA1jQlObg8gUWJTD3nQicGUooLIP3akH8yfOwffApupIUTNbR2G8pBglknZCjK14ZCsUvALSrtOh2oAhZBwGrYi2fDkTHjCYwCwZDZD';
const GRAPH_VERSION = 'v20.0';

// Get phone number from command line argument
const recipientPhone = process.argv[2];

if (!recipientPhone) {
    console.error('❌ Error: Please provide a recipient phone number');
    console.log('Usage: node test-send-message.mjs <phone_number>');
    console.log('Example: node test-send-message.mjs 919876543210');
    process.exit(1);
}

// Clean phone number (remove +, spaces, etc.)
const cleanPhone = recipientPhone.replace(/[^0-9]/g, '');

console.log('='.repeat(80));
console.log('WhatsApp Message Send Test');
console.log('='.repeat(80));
console.log(`Recipient: ${cleanPhone}`);
console.log('');

async function sendTestMessage() {
    try {
        console.log('📤 Sending test message...');

        const response = await axios.post(
            `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_ID}/messages`,
            {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: cleanPhone,
                type: 'text',
                text: {
                    preview_url: false,
                    body: 'Hello! This is a test message from Crystal Group WhatsApp Business API. 👋\n\nIf you receive this, the sending functionality is working correctly!'
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ Message sent successfully!');
        console.log('');
        console.log('Response:');
        console.log(JSON.stringify(response.data, null, 2));
        console.log('');
        console.log('Message ID:', response.data.messages[0].id);
        console.log('');
        console.log('⚠️  IMPORTANT:');
        console.log('1. Check if the recipient received the message');
        console.log('2. Try replying to the message');
        console.log('3. Check your server logs to see if the reply is received via webhook');
        console.log('');

    } catch (error) {
        console.error('❌ Error sending message:');
        console.error('');

        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Error Details:', JSON.stringify(error.response.data, null, 2));
            console.error('');

            if (error.response.status === 400) {
                console.error('⚠️  BAD REQUEST - Possible issues:');
                console.error('   - Invalid phone number format');
                console.error('   - Phone number not registered with WhatsApp');
                console.error('   - Message format is incorrect');
            } else if (error.response.status === 401) {
                console.error('⚠️  UNAUTHORIZED - Access token may be expired');
            } else if (error.response.status === 403) {
                console.error('⚠️  FORBIDDEN - Insufficient permissions or rate limit exceeded');
            }
        } else {
            console.error(error.message);
        }
    }
}

sendTestMessage();

console.log('='.repeat(80));
