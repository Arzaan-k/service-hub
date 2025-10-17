/**
 * Test script to verify Orbcomm CDH connection
 * Run with: node test-orbcomm-connection.js
 */

import WebSocket from 'ws';

async function testOrbcommConnection() {
  console.log('🔌 Testing Orbcomm CDH connection...');

  const url = 'wss://integ.tms-orbcomm.com:44355/cdh';
  const username = 'cdhQuadre';
  const password = 'P4cD#QA@!D@re';

  console.log(`📍 Connecting to: ${url}`);
  console.log(`👤 Username: ${username}`);

  try {
    // Create WebSocket connection with required subprotocol
    const ws = new WebSocket(url, 'cdh.orbcomm.com', {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
        'User-Agent': 'ContainerGenie-Test/1.0'
      },
      handshakeTimeout: 10000
    });

    return new Promise((resolve, reject) => {
      ws.on('open', () => {
        console.log('✅ Successfully connected to Orbcomm CDH!');
        console.log('🔐 Authentication appears to work');

        // Try to send a simple message to test if the connection is working
        const testMessage = {
          type: 'test',
          timestamp: new Date().toISOString()
        };

        ws.send(JSON.stringify(testMessage));
        console.log('📨 Sent test message');

        // Close connection after a short delay
        setTimeout(() => {
          ws.close();
          console.log('🔌 Connection closed');
          resolve(true);
        }, 2000);
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
        reject(error);
      });

      ws.on('close', (code, reason) => {
        console.log(`🔌 Connection closed. Code: ${code}, Reason: ${reason.toString()}`);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        ws.close();
        reject(new Error('Connection timeout'));
      }, 10000);
    });

  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    throw error;
  }
}

testOrbcommConnection()
  .then(() => {
    console.log('🎉 Orbcomm connection test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Orbcomm connection test failed:', error.message);
    process.exit(1);
  });













