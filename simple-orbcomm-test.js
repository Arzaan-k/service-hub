import WebSocket from 'ws';

console.log('🔌 Testing Orbcomm CDH connection...');
console.log('📍 URL: wss://integ.tms-orbcomm.com:44355/cdh');
console.log('🔐 Token: Y2RoUXVhZHJlOlA0Y0QjUUFAIURAcmU=');
console.log('📡 Subprotocol: cdh.orbcomm.com');

const ws = new WebSocket('wss://integ.tms-orbcomm.com:44355/cdh', 'cdh.orbcomm.com', {
  headers: {
    'Authorization': 'Basic Y2RoUXVhZHJlOlA0Y0QjUUFAIURAcmU=',
    'User-Agent': 'PostmanRuntime/7.42.0'
  }
});

ws.on('open', () => {
  console.log('✅ Connected successfully!');
  ws.close();
});

ws.on('error', (error) => {
  console.error('❌ Connection failed:', error.message);
});

ws.on('close', (code, reason) => {
  console.log('🔌 Closed:', code, reason.toString());
});






