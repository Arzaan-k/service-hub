#!/usr/bin/env node

/**
 * Test NVIDIA API Key Format
 */

import { readFileSync } from 'fs';

console.log('🔍 Testing NVIDIA API Key Format...\n');

// Read .env file
const envContent = readFileSync('.env', 'utf8');
const nvidiaMatch = envContent.match(/NVIDIA_API_KEY=(.+)/);
const apiKey = nvidiaMatch ? nvidiaMatch[1].trim() : null;

console.log('1. API Key Check:');
if (!apiKey) {
  console.log('❌ No NVIDIA API key found');
  console.log('   Please add: NVIDIA_API_KEY=nvapi-...your-key...');
  process.exit(1);
}

if (apiKey === 'YOUR_NVIDIA_API_KEY_HERE') {
  console.log('❌ Still showing placeholder - please update with real API key');
  console.log('   Should look like: NVIDIA_API_KEY=nvapi-1234567890abcdef...');
  process.exit(1);
}

if (!apiKey.startsWith('nvapi-')) {
  console.log('❌ API key format incorrect');
  console.log('   Should start with "nvapi-"');
  console.log('   Your key:', apiKey.substring(0, 10) + '...');
  process.exit(1);
}

console.log('✅ API key format looks correct');
console.log('   Starts with: nvapi-...');
console.log('   Length:', apiKey.length, 'characters');

console.log('\n2. Testing API Connection...');

try {
  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'meta/llama3-8b-instruct',
      messages: [{
        role: 'user',
        content: 'Hello! This is a test message to verify the NVIDIA API key is working.'
      }],
      max_tokens: 50,
      temperature: 0.1,
    }),
  });

  console.log('Response status:', response.status);

  if (response.ok) {
    const data = await response.json();
    const responseText = data.choices[0]?.message?.content?.trim();
    console.log('✅ SUCCESS! NVIDIA API is working!');
    console.log('Response:', responseText);
  } else {
    const errorText = await response.text();
    console.log('❌ API Error:', response.status, response.statusText);
    console.log('Details:', errorText);

    if (response.status === 403) {
      console.log('\n🔍 Troubleshooting 403 Forbidden:');
      console.log('1. Check if API key is correct');
      console.log('2. Verify you have access to NVIDIA API');
      console.log('3. Make sure API key starts with "nvapi-"');
      console.log('4. Check if API key has expired');
    }
  }
} catch (error) {
  console.log('❌ Error:', error.message);
}

console.log('\n💡 Tips:');
console.log('- Get your API key from: https://build.nvidia.com/explore/discover');
console.log('- Make sure you copy the entire key (starts with "nvapi-")');
console.log('- No spaces or extra characters');
console.log('- Save .env file after editing');