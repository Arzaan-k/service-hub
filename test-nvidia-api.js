// Simple NVIDIA API test
import 'dotenv/config';

async function testNvidiaAPI() {
  const apiKey = process.env.NVIDIA_API_KEY;

  if (!apiKey) {
    console.log('❌ NVIDIA_API_KEY not found');
    return;
  }

  console.log('🔍 Testing NVIDIA API...');

  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'meta/llama3-8b-instruct',
        messages: [{ role: 'user', content: 'Say hello and confirm you are working.' }],
        max_tokens: 50,
        temperature: 0.1,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ NVIDIA API working!');
      console.log('Response:', data.choices[0]?.message?.content);
    } else {
      console.log('❌ NVIDIA API error:', response.status, response.statusText);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testNvidiaAPI();




