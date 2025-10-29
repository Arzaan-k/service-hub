import 'dotenv/config';

async function testPasswordReset() {
  console.log('🧪 Testing password reset flow...\n');

  // Use the user we just created
  const email = 'test-1761713944237@example.com';

  try {
    console.log('📧 Requesting password reset for:', email);

    const resetResponse = await fetch('http://localhost:5000/api/auth/forgot-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const resetData = await resetResponse.json();

    if (!resetResponse.ok) {
      console.error('❌ Password reset request failed:', resetData);
      return;
    }

    console.log('✅ Password reset request successful:');
    console.log('   Message:', resetData.message);
    console.log('   Email sent:', resetData.emailSent);
    if (resetData.resetCode) {
      console.log('   Reset code:', resetData.resetCode);
    }

    // If we have a reset code, try to reset the password
    if (resetData.resetCode) {
      console.log('\n🔑 Resetting password with code:', resetData.resetCode);

      const newPassword = 'newpassword123';

      const resetConfirmResponse = await fetch('http://localhost:5000/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code: resetData.resetCode,
          newPassword,
        }),
      });

      const resetConfirmData = await resetConfirmResponse.json();

      if (resetConfirmResponse.ok) {
        console.log('✅ Password reset successful');

        // Test login with new password
        console.log('\n🔑 Testing login with new password...');

        const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password: newPassword,
          }),
        });

        const loginData = await loginResponse.json();

        if (loginResponse.ok) {
          console.log('✅ Login with new password successful');
        } else {
          console.log('❌ Login with new password failed:', loginData.error);
        }

      } else {
        console.error('❌ Password reset confirmation failed:', resetConfirmData);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testPasswordReset();
