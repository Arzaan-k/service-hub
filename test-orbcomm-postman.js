/**
 * Postman-style Orbcomm CDH WebSocket connection test
 * This replicates the exact Postman configuration you provided
 */

import WebSocket from 'ws';

async function testPostmanConnection() {
  console.log('🔌 Testing Orbcomm CDH connection (Postman-style)...');

  const url = 'wss://integ.tms-orbcomm.com:44355/cdh';
  const authToken = 'Y2RoUXVhZHJlOlA0Y0QjUUFAIURAcmU=';

  console.log(`📍 URL: ${url}`);
  console.log(`🔐 Authorization: Basic ${authToken}`);
  console.log(`📡 Subprotocol: cdh.orbcomm.com`);

  try {
    // Create WebSocket connection exactly as in Postman
    const ws = new WebSocket(url, 'cdh.orbcomm.com', {
      headers: {
        'Authorization': `Basic ${authToken}`,
        'User-Agent': 'PostmanRuntime/7.42.0',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'Upgrade'
      },
      handshakeTimeout: 30000,
      perMessageDeflate: false
    });

    return new Promise((resolve, reject) => {
      ws.on('open', () => {
        console.log('✅ WebSocket connection established (HTTP 101 Switching Protocols)');
        console.log('🔐 Authentication successful');

        // Send a test message to verify the connection is working
        const testMessage = {
          type: 'test',
          timestamp: new Date().toISOString(),
          message: 'Postman test message'
        };

        ws.send(JSON.stringify(testMessage));
        console.log('📨 Sent test message');

        // Close connection after a short delay
        setTimeout(() => {
          ws.close(1000, 'Test completed');
          console.log('🔌 Connection closed gracefully');
          resolve(true);
        }, 3000);
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('📨 Received message:', message);
        } catch (error) {
          console.log('📨 Received raw data:', data.toString());
        }
      });

      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);

        // Check if it's an authentication error
        if (error.message.includes('401') || error.message.includes('403')) {
          console.error('🔐 Authentication failed - check your token');
        } else if (error.message.includes('404')) {
          console.error('🌐 URL not found - check the endpoint');
        } else if (error.message.includes('426')) {
          console.error('📡 Subprotocol not supported - check Sec-WebSocket-Protocol');
        }

        reject(error);
      });

      ws.on('close', (code, reason) => {
        console.log(`🔌 Connection closed. Code: ${code}, Reason: ${reason.toString()}`);

        if (code === 1000) {
          console.log('✅ Normal closure');
        } else if (code === 1006) {
          console.log('❌ Abnormal closure - connection lost');
        } else if (code === 1011) {
          console.log('❌ Server error');
        }
      });

      // Timeout after 15 seconds
      setTimeout(() => {
        ws.close();
        reject(new Error('Connection timeout'));
      }, 15000);
    });

  } catch (error) {
    console.error('❌ Connection setup failed:', error.message);
    throw error;
  }
}

// Run the test
testPostmanConnection()
  .then(() => {
    console.log('🎉 Postman-style Orbcomm connection test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Postman-style Orbcomm connection test failed:', error.message);
    process.exit(1);
  });













