import http from 'http';

// Test registration
const registerData = JSON.stringify({
  name: 'Test User',
  email: 'test@example.com',
  phoneNumber: '+1234567890',
  password: 'password123',
  role: 'admin'
});

const registerOptions = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(registerData)
  }
};

console.log('Testing registration...');

const registerReq = http.request(registerOptions, (res) => {
  console.log(`Registration STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`Registration BODY: ${chunk}`);
  });
  res.on('end', () => {
    console.log('Registration complete.');
    
    // Test login after registration
    setTimeout(() => {
      const loginData = JSON.stringify({
        email: 'test@example.com',
        password: 'password123'
      });

      const loginOptions = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(loginData)
        }
      };

      console.log('Testing login...');
      
      const loginReq = http.request(loginOptions, (res) => {
        console.log(`Login STATUS: ${res.statusCode}`);
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          console.log(`Login BODY: ${chunk}`);
        });
      });

      loginReq.on('error', (e) => {
        console.error(`Login problem: ${e.message}`);
      });

      loginReq.write(loginData);
      loginReq.end();
    }, 1000);
  });
});

registerReq.on('error', (e) => {
  console.error(`Registration problem: ${e.message}`);
});

registerReq.write(registerData);
registerReq.end();