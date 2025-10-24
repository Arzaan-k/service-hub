#!/usr/bin/env node

// Advanced CDH WebSocket connection test
import WebSocket from 'ws';

async function testCDHAuthentication() {
  console.log('🧪 Testing CDH Authentication Methods...');
  
  const baseUrl = 'wss://integ.tms-orbcomm.com:44355';
  const username = 'cdhQuadre';
  const password = 'P4pD#QU@!D@re';
  
  console.log('📋 Testing different authentication approaches:');
  console.log('');
  
  // Test 1: Basic Auth in headers
  console.log('🔐 Test 1: Basic Auth in headers');
  try {
    const ws1 = new WebSocket(`${baseUrl}/cdh`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
        'User-Agent': 'ContainerGenie/1.0',
        'Origin': 'https://container-genie.com'
      },
      handshakeTimeout: 10000,
      rejectUnauthorized: false
    });
    
    await new Promise((resolve) => {
      ws1.on('open', () => {
        console.log('✅ Basic Auth successful!');
        ws1.close();
        resolve();
      });
      
      ws1.on('error', (error) => {
        console.log(`❌ Basic Auth failed: ${error.message}`);
        resolve();
      });
      
      ws1.on('close', (code, reason) => {
        console.log(`🔌 Connection closed: Code ${code}, Reason: ${reason}`);
        resolve();
      });
    });
  } catch (error) {
    console.log(`❌ Basic Auth error: ${error.message}`);
  }
  
  console.log('');
  
  // Test 2: Query parameters
  console.log('🔐 Test 2: Query parameters');
  try {
    const ws2 = new WebSocket(`${baseUrl}/cdh?username=${username}&password=${password}`, {
      headers: {
        'User-Agent': 'ContainerGenie/1.0',
        'Origin': 'https://container-genie.com'
      },
      handshakeTimeout: 10000,
      rejectUnauthorized: false
    });
    
    await new Promise((resolve) => {
      ws2.on('open', () => {
        console.log('✅ Query params successful!');
        ws2.close();
        resolve();
      });
      
      ws2.on('error', (error) => {
        console.log(`❌ Query params failed: ${error.message}`);
        resolve();
      });
      
      ws2.on('close', (code, reason) => {
        console.log(`🔌 Connection closed: Code ${code}, Reason: ${reason}`);
        resolve();
      });
    });
  } catch (error) {
    console.log(`❌ Query params error: ${error.message}`);
  }
  
  console.log('');
  
  // Test 3: Different subprotocols
  console.log('🔐 Test 3: Different subprotocols');
  const subprotocols = ['cdh.orbcomm.com', 'orbcomm', 'cdh', 'websocket'];
  
  for (const subprotocol of subprotocols) {
    try {
      console.log(`  Testing subprotocol: ${subprotocol}`);
      const ws3 = new WebSocket(`${baseUrl}/cdh`, subprotocol, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
          'User-Agent': 'ContainerGenie/1.0',
          'Origin': 'https://container-genie.com'
        },
        handshakeTimeout: 5000,
        rejectUnauthorized: false
      });
      
      await new Promise((resolve) => {
        ws3.on('open', () => {
          console.log(`✅ Subprotocol ${subprotocol} successful!`);
          ws3.close();
          resolve();
        });
        
        ws3.on('error', (error) => {
          console.log(`❌ Subprotocol ${subprotocol} failed: ${error.message}`);
          resolve();
        });
        
        ws3.on('close', (code, reason) => {
          console.log(`🔌 Connection closed: Code ${code}, Reason: ${reason}`);
          resolve();
        });
      });
    } catch (error) {
      console.log(`❌ Subprotocol ${subprotocol} error: ${error.message}`);
    }
  }
  
  console.log('');
  console.log('🏁 Authentication test completed');
  console.log('');
  console.log('💡 Recommendations:');
  console.log('  1. Verify credentials with ORBCOMM support');
  console.log('  2. Check if IP whitelisting is required');
  console.log('  3. Confirm the correct endpoint URL');
  console.log('  4. Check if the CDH service is running');
}

// Run the test
testCDHAuthentication().catch(console.error);
