#!/usr/bin/env node

// Test CDH WebSocket connection
import WebSocket from 'ws';

async function testCDHConnection() {
  console.log('🧪 Testing CDH WebSocket Connection...');
  
  // Connection parameters
  const url = process.env.ORBCOMM_URL || 'wss://integ.tms-orbcomm.com:44355/cdh';
  const username = process.env.ORBCOMM_USERNAME || 'cdhQuadre';
  const password = process.env.ORBCOMM_PASSWORD || 'P4pD#QU@!D@re'; // Fixed typo: was P4cD#QA@!D@re
  
  console.log('📋 Connection Parameters:');
  console.log(`  URL: ${url}`);
  console.log(`  Username: ${username}`);
  console.log(`  Password: ${password ? '***' : 'NOT SET'}`);
  console.log('');
  
  // Test different URL variations
  const testUrls = [
    url,
    'wss://integ.tms-orbcomm.com:44355/cdh',
    'wss://wamc.wamcentral.net:44355/cdh',
    'wss://integ.tms-orbcomm.com:44355',
    'wss://wamc.wamcentral.net:44355'
  ];
  
  for (const testUrl of testUrls) {
    console.log(`🔌 Testing URL: ${testUrl}`);
    
    try {
      const ws = new WebSocket(testUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
          'User-Agent': 'ContainerGenie-Test/1.0',
          'Origin': 'https://container-genie.com'
        },
        handshakeTimeout: 10000,
        perMessageDeflate: false,
        rejectUnauthorized: false
      });
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Connection timeout'));
        }, 15000);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          console.log(`✅ SUCCESS: Connected to ${testUrl}`);
          
          // Send test GetEvents message
          const testMessage = {
            "GetEvents": {
              "EventType": "all",
              "EventPartition": 1,
              "PrecedingEventID": "",
              "FollowingEventID": null,
              "MaxEventCount": 10
            }
          };
          
          console.log('📤 Sending test GetEvents message...');
          ws.send(JSON.stringify(testMessage));
          
          // Wait for response
          setTimeout(() => {
            ws.close();
            resolve();
          }, 5000);
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          console.log(`❌ FAILED: ${testUrl} - ${error.message}`);
          resolve(); // Continue to next URL
        });
        
        ws.on('close', (code, reason) => {
          clearTimeout(timeout);
          console.log(`🔌 Connection closed: Code ${code}, Reason: ${reason}`);
          resolve();
        });
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            console.log('📨 Received response:', JSON.stringify(message, null, 2));
          } catch (e) {
            console.log('📨 Received raw data:', data.toString());
          }
        });
      });
      
    } catch (error) {
      console.log(`❌ ERROR: ${testUrl} - ${error.message}`);
    }
    
    console.log(''); // Empty line for readability
  }
  
  console.log('🏁 Connection test completed');
}

// Run the test
testCDHConnection().catch(console.error);
