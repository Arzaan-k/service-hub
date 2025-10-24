#!/usr/bin/env node

console.log('🧪 Testing WhatsApp Configuration...');

// Check if environment variables are set
const WA_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID;
const CLOUD_API_ACCESS_TOKEN = process.env.CLOUD_API_ACCESS_TOKEN;
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const WABA_ID = process.env.WABA_ID;

console.log('📱 WA_PHONE_NUMBER_ID:', WA_PHONE_NUMBER_ID || 'NOT SET');
console.log('🔑 CLOUD_API_ACCESS_TOKEN:', CLOUD_API_ACCESS_TOKEN ? 'SET' : 'NOT SET');
console.log('🛡️ WHATSAPP_VERIFY_TOKEN:', WHATSAPP_VERIFY_TOKEN ? 'SET' : 'NOT SET');
console.log('🏢 WABA_ID:', WABA_ID || 'NOT SET');

if (!WA_PHONE_NUMBER_ID || !CLOUD_API_ACCESS_TOKEN) {
  console.error('❌ WhatsApp configuration missing');
} else {
  console.log('✅ WhatsApp configuration appears to be set');
}