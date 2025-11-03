#!/usr/bin/env node

/**
 * WhatsApp Business API Setup Script
 *
 * This script helps you set up the required environment variables for WhatsApp Business API integration.
 *
 * Prerequisites:
 * 1. Facebook Developer Account
 * 2. WhatsApp Business Account
 * 3. WhatsApp Business API access
 *
 * Steps to get WhatsApp credentials:
 * 1. Go to https://developers.facebook.com
 * 2. Create a new app or use existing one
 * 3. Add WhatsApp product to your app
 * 4. Configure webhook URL (your server URL + /api/webhook/whatsapp)
 * 5. Get Phone Number ID from WhatsApp > API Setup
 * 6. Generate access token from Meta Business > Settings > Access Tokens
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function setupWhatsApp() {
  console.log('🚀 WhatsApp Business API Setup\n');

  console.log('📋 Prerequisites:');
  console.log('1. Facebook Developer Account');
  console.log('2. WhatsApp Business Account');
  console.log('3. WhatsApp Business API access\n');

  console.log('🔗 Setup Instructions:');
  console.log('1. Go to https://developers.facebook.com');
  console.log('2. Create/select your app');
  console.log('3. Add WhatsApp product');
  console.log('4. Configure webhook URL: https://your-domain.com/api/webhook/whatsapp');
  console.log('5. Get Phone Number ID and Access Token\n');

  const phoneNumberId = await ask('📱 Enter your Phone Number ID: ');
  const accessToken = await ask('🔑 Enter your Cloud API Access Token: ');
  const webhookToken = await ask('🛡️ Enter your Webhook Verification Token: ');

  const envContent = `# WhatsApp Business API Configuration
WA_PHONE_NUMBER_ID=${phoneNumberId}
CLOUD_API_ACCESS_TOKEN=${accessToken}
WEBHOOK_VERIFICATION_TOKEN=${webhookToken}

# Database Configuration (update these)
DATABASE_URL=postgresql://username:password@localhost:5432/containerdb

# Other required environment variables
NODE_ENV=development
PORT=5000
JWT_SECRET=your_jwt_secret_key_change_in_production
ENCRYPTION_KEY=your_encryption_key_change_in_production
CORS_ORIGIN=http://localhost:3000

# Orbcomm Configuration (if using)
ORBCOMM_URL=wss://integ.tms-orbcomm.com:44355/cdh
ORBCOMM_USERNAME=your_username
ORBCOMM_PASSWORD=your_password

# Google AI Configuration (if using)
GOOGLE_AI_API_KEY=your_google_ai_api_key
`;

  const envPath = path.join(__dirname, '.env');
  fs.writeFileSync(envPath, envContent);

  console.log('\n✅ Environment file created at .env');
  console.log('\n📋 Next Steps:');
  console.log('1. Update the database URL in .env');
  console.log('2. Run: npm run dev');
  console.log('3. Test WhatsApp integration');

  rl.close();
}

if (require.main === module) {
  setupWhatsApp().catch(console.error);
}

module.exports = { setupWhatsApp };












