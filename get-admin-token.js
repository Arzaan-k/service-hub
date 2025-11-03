import axios from 'axios';

async function getAdminToken() {
  try {
    console.log('🔐 Getting admin token...');

    // Try to login with the seeded admin user
    const response = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@containergenie.com',
      password: 'admin123' // Default password for seeded user
    });

    console.log('✅ Login successful!');
    console.log('🆔 Token:', response.data.token);
    console.log('👤 User:', response.data.user.name);

    console.log('\n📋 Copy this token to your bulk upload script:');
    console.log('AUTH_TOKEN="' + response.data.token + '"');

    return response.data.token;

  } catch (error) {
    console.error('❌ Login failed:');

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Message:', error.response.data.error);
    } else {
      console.error('No response - make sure server is running on http://localhost:5000');
    }

    console.log('\n💡 If login fails, you may need to:');
    console.log('1. Run: node create-admin-user.js');
    console.log('2. Or use the user ID directly as token');

    return null;
  }
}

getAdminToken();





