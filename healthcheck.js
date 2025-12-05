/**
 * Docker Health Check Script
 * 
 * This script is used by Docker to verify the application is healthy.
 * It checks:
 * 1. HTTP server is responding
 * 2. Database connection is alive (via /api/health endpoint)
 * 
 * Exit codes:
 * - 0: Healthy
 * - 1: Unhealthy
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: process.env.PORT || 5000,
  path: '/api/health',
  method: 'GET',
  timeout: 5000,
  headers: {
    'Accept': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      try {
        const health = JSON.parse(data);
        if (health.status === 'healthy') {
          console.log('✅ Health check passed:', JSON.stringify(health));
          process.exit(0);
        } else {
          console.error('❌ Health check failed - unhealthy status:', health);
          process.exit(1);
        }
      } catch (parseError) {
        console.error('❌ Health check failed - invalid JSON response');
        process.exit(1);
      }
    } else {
      console.error(`❌ Health check failed - HTTP ${res.statusCode}`);
      process.exit(1);
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Health check failed - connection error:', err.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('❌ Health check failed - timeout');
  req.destroy();
  process.exit(1);
});

req.end();
