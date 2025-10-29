import 'dotenv/config';

async function testRegistration() {
  console.log('🧪 Testing live registration flow...\n');

  const timestamp = Date.now();
  const testUser = {
    name: 'Test User',
    email: `test-${timestamp}@example.com`, // Unique email
    phoneNumber: `+1${timestamp.toString().slice(-10)}`, // Unique phone number
    password: 'testpass123',
    role: 'client'
  };

  try {
    console.log('📝 Registering user:', testUser.email);

    const registerResponse = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUser),
    });

    const registerData = await registerResponse.json();

    if (!registerResponse.ok) {
      console.error('❌ Registration failed:', registerData);
      return;
    }

    console.log('✅ Registration successful:');
    console.log('   Message:', registerData.message);
    console.log('   Email sent:', registerData.emailSent);
    if (registerData.verificationCode) {
      console.log('   Verification code:', registerData.verificationCode);
    }
    console.log('');

    // If we have a verification code, try to verify the email
    if (registerData.verificationCode) {
      console.log('🔐 Verifying email with code:', registerData.verificationCode);

      const verifyResponse = await fetch('http://localhost:5000/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: testUser.email,
          code: registerData.verificationCode,
        }),
      });

      const verifyData = await verifyResponse.json();

      if (verifyResponse.ok) {
        console.log('✅ Email verification successful');
        console.log('   User ID:', verifyData.user.id);
        console.log('   Token:', verifyData.token ? 'Present' : 'Missing');
      } else {
        console.error('❌ Email verification failed:', verifyData);
      }
    }

    // Test login
    console.log('\n🔑 Testing login...');

    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password,
      }),
    });

    const loginData = await loginResponse.json();

    if (loginResponse.ok) {
      console.log('✅ Login successful');
      console.log('   User:', loginData.user.name);
      console.log('   Role:', loginData.user.role);
      console.log('   Email verified:', loginData.user.emailVerified);
    } else {
      console.log('❌ Login failed:', loginData.error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testRegistration();
